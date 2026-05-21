import { Injectable } from '@nestjs/common'
import { ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import type { AdvisoryOrganizationPromptContext } from '../org-context/advisory-organization-context.service'
import type {
  CsaasEnterpriseSignalFallbackReason,
  CsaasEnterpriseSignalsResult,
} from '../integration/csaas-enterprise-signals.service'
import type {
  QuickConsultProblemClassificationResult,
  QuickConsultProblemType,
  QuickConsultProviderStatus,
} from './quick-consult.service'

export enum QuickConsultRecommendationConfidence {
  None = 'none',
  Confident = 'confident',
}

export interface QuickConsultMethodRecommendation {
  id: string
  recommendationId: string
  workflowKey: string
  methodName: string
  rank: number
  rationale: string
  primaryRationale: string
  expandedRationale: string
  fitScenario: string
  durationMinutes: number
  expectedDuration: string
  expectedOutput: string
  classificationRefs: QuickConsultProblemType[]
  sourceRefs: string[]
}

export interface QuickConsultRecommendationSet {
  confidence: QuickConsultRecommendationConfidence
  recommendations: QuickConsultMethodRecommendation[]
  generatedAt: string
  sourceRefCount: number
  recommendationContext?: QuickConsultRecommendationContext
}

export interface QuickConsultRecommendationRequest {
  contextId: string
  classification: QuickConsultProblemClassificationResult
  providerStatus?: QuickConsultProviderStatus
  organizationContext?: AdvisoryOrganizationPromptContext | null
  enterpriseSignals?: CsaasEnterpriseSignalsResult | null
}

export type QuickConsultRecommendationContextMode = 'enterprise' | 'generic'
export type QuickConsultRecommendationContextSource =
  | 'organization_context'
  | 'csaas_it_maturity'
  | 'csaas_compliance'

export interface QuickConsultContextCompletionPrompt {
  missingFields: string[]
  message: string
  action: 'open_enterprise_background_settings'
}

export interface QuickConsultRecommendationContext {
  mode: QuickConsultRecommendationContextMode
  signalsApplied: string[]
  sources: QuickConsultRecommendationContextSource[]
  fallbackReason?: CsaasEnterpriseSignalFallbackReason
  contextCompletionPrompt?: QuickConsultContextCompletionPrompt
}

const RECOMMENDATION_WORKFLOW_PREFERENCES: Record<QuickConsultProblemType, string[]> = {
  strategy: ['product-brief', 'problem-solving', 'prd'],
  innovation: ['design-thinking', 'brainstorming', 'market-research'],
  architecture: ['design-thinking', 'problem-solving', 'prd'],
  team: ['problem-solving', 'design-thinking', 'storytelling'],
  budget: ['problem-solving', 'product-brief', 'prd'],
  process: ['problem-solving', 'design-thinking', 'prd'],
  compliance: ['domain-research', 'problem-solving', 'prd'],
  risk: ['problem-solving', 'design-thinking', 'domain-research'],
}

const FALLBACK_WORKFLOW_ORDER = [
  'problem-solving',
  'design-thinking',
  'product-brief',
  'domain-research',
  'market-research',
  'brainstorming',
  'prd',
  'storytelling',
]

const EXPECTED_OUTPUT_BY_WORKFLOW: Record<string, string> = {
  brainstorming: 'A focused option set with promising directions and next experiments.',
  'domain-research': 'A concise evidence map for the domain, constraints, and open questions.',
  'market-research': 'Customer segment, competitor, and market evidence for the decision.',
  'product-brief': 'A product framing brief with audience, value, risks, and next steps.',
  prd: 'A requirements outline with scope, success criteria, and implementation risks.',
  'problem-solving': 'A problem frame, root causes, constraints, and prioritized options.',
  'design-thinking': 'User assumptions, pain points, opportunity framing, and prototype direction.',
  storytelling: 'A stakeholder narrative with message structure and supporting proof points.',
}

const DURATION_BY_WORKFLOW: Record<string, number> = {
  brainstorming: 25,
  'domain-research': 45,
  'market-research': 45,
  'product-brief': 40,
  prd: 50,
  'problem-solving': 35,
  'design-thinking': 45,
  storytelling: 30,
}

@Injectable()
export class QuickConsultMethodRecommendationService {
  constructor(private readonly workflowRegistry: ThinkTankWorkflowRegistryService) {}

  async generateRecommendations(
    request: QuickConsultRecommendationRequest,
  ): Promise<QuickConsultRecommendationSet> {
    const generatedAt = new Date().toISOString()
    const recommendationContext = this.buildRecommendationContext(request)
    if (request.classification.confidenceLevel === 'low') {
      return {
        confidence: QuickConsultRecommendationConfidence.None,
        recommendations: [],
        generatedAt,
        sourceRefCount: 0,
        recommendationContext,
      }
    }

    const workflows = await this.workflowRegistry.discoverWorkflows()
    const workflowsByKey = new Map(workflows.map((workflow) => [workflow.key, workflow]))
    const rankedKeys = this.rankWorkflowKeys(request.classification, workflowsByKey)
    if (rankedKeys.length < 2) {
      throw new Error('Quick Consult recommendation catalog has fewer than two candidates.')
    }
    const recommendations = rankedKeys.slice(0, 3).map((workflowKey, index) => {
      const workflow = workflowsByKey.get(workflowKey)!
      const problemType = this.readClassificationRefForWorkflow(request.classification, workflowKey)

      return this.toRecommendation({
        contextId: request.contextId,
        workflow,
        rank: index + 1,
        problemType,
        classification: request.classification,
        organizationContext: request.organizationContext,
        enterpriseSignals: request.enterpriseSignals,
      })
    })

    return {
      confidence:
        recommendations.length >= 2
          ? QuickConsultRecommendationConfidence.Confident
          : QuickConsultRecommendationConfidence.None,
      recommendations: recommendations.length >= 2 ? recommendations : [],
      generatedAt,
      sourceRefCount: recommendations.reduce(
        (count, recommendation) => count + recommendation.sourceRefs.length,
        0,
      ),
      recommendationContext,
    }
  }

  private rankWorkflowKeys(
    classification: QuickConsultProblemClassificationResult,
    workflowsByKey: Map<string, ThinkTankWorkflowMetadata>,
  ): string[] {
    const ranked: string[] = []
    const add = (workflowKey: string) => {
      if (workflowsByKey.has(workflowKey) && !ranked.includes(workflowKey)) {
        ranked.push(workflowKey)
      }
    }

    for (const problemType of classification.problemTypes) {
      add(RECOMMENDATION_WORKFLOW_PREFERENCES[problemType.id][0])
      if (ranked.length >= 3) return ranked
    }

    for (const problemType of classification.problemTypes) {
      for (const workflowKey of RECOMMENDATION_WORKFLOW_PREFERENCES[problemType.id].slice(1)) {
        add(workflowKey)
        if (ranked.length >= 3) return ranked
      }
    }

    for (const workflowKey of FALLBACK_WORKFLOW_ORDER) {
      add(workflowKey)
      if (ranked.length >= 3) return ranked
    }

    return ranked
  }

  private readClassificationRefForWorkflow(
    classification: QuickConsultProblemClassificationResult,
    workflowKey: string,
  ): QuickConsultProblemType {
    return (
      classification.problemTypes.find((problemType) =>
        RECOMMENDATION_WORKFLOW_PREFERENCES[problemType.id].includes(workflowKey),
      )?.id ??
      classification.primaryProblemType ??
      classification.problemTypes[0]?.id ??
      'strategy'
    )
  }

  private toRecommendation(context: {
    contextId: string
    workflow: ThinkTankWorkflowMetadata
    rank: number
    problemType: QuickConsultProblemType
    classification: QuickConsultProblemClassificationResult
    organizationContext?: AdvisoryOrganizationPromptContext | null
    enterpriseSignals?: CsaasEnterpriseSignalsResult | null
  }): QuickConsultMethodRecommendation {
    const problemType = context.classification.problemTypes.find(
      (candidate) => candidate.id === context.problemType,
    )
    const label = problemType?.label ?? context.problemType
    const scenarioLanguage =
      problemType?.scenarioLanguage ?? context.classification.scenarioLanguage.label
    const id = `${context.contextId}:${context.workflow.key}:${context.rank}`
    const durationMinutes = DURATION_BY_WORKFLOW[context.workflow.key] ?? 35
    const expectedDuration = `${Math.max(durationMinutes - 10, 15)}-${durationMinutes} minutes`
    const organizationFit = this.createOrganizationFitSummary(context.organizationContext)
    const enterpriseFit = this.createEnterpriseFitSummary(context.enterpriseSignals)
    const primaryRationale = [
      `${label}场景需要先围绕“${scenarioLanguage}”选择可执行的分析路径。`,
      ...(organizationFit ? [`已结合企业背景：${organizationFit}。`] : []),
      ...(enterpriseFit ? [`已结合CSAAS信号：${enterpriseFit}。`] : []),
    ].join(' ')

    return {
      id,
      recommendationId: id,
      workflowKey: context.workflow.key,
      methodName: context.workflow.displayName,
      rank: context.rank,
      rationale: primaryRationale,
      primaryRationale,
      expandedRationale: [
        primaryRationale,
        `${context.workflow.displayName} 能把当前问题转成结构化步骤，帮助你比较约束、风险和下一步输出。`,
      ].join(' '),
      fitScenario: context.workflow.scenarioLabel,
      durationMinutes,
      expectedDuration,
      expectedOutput:
        EXPECTED_OUTPUT_BY_WORKFLOW[context.workflow.key] ??
        'A structured decision artifact and next-step plan.',
      classificationRefs: [context.problemType],
      sourceRefs: [
        ...this.toSafeSourceRefs(context.workflow),
        ...this.toEnterpriseSourceRefs(context.enterpriseSignals),
      ],
    }
  }

  private toSafeSourceRefs(workflow: ThinkTankWorkflowMetadata): string[] {
    return [
      `workflow:${workflow.key}`,
      workflow.methodLibraryPaths.length > 0
        ? `method:${workflow.key}:library-1`
        : `method:${workflow.key}:runtime`,
    ]
  }

  private createOrganizationFitSummary(
    context?: AdvisoryOrganizationPromptContext | null,
  ): string | null {
    if (!context?.organizationName) return null

    return [
      context.organizationName,
      ...(context.industry ? [`行业：${context.industry}`] : []),
      ...(context.size ? [`规模：${context.size}`] : []),
    ].join('，')
  }

  private createEnterpriseFitSummary(
    enterpriseSignals?: CsaasEnterpriseSignalsResult | null,
  ): string | null {
    if (
      enterpriseSignals?.mode !== 'enterprise' ||
      enterpriseSignals.signalsApplied.length === 0 ||
      !enterpriseSignals.summary
    ) {
      return null
    }

    const summary = enterpriseSignals.summary
    return [
      summary.overallMaturity ? `成熟度${summary.overallMaturity}` : null,
      summary.complianceGapLevel ? `合规缺口${summary.complianceGapLevel}` : null,
      ...(summary.topShortcomings?.slice(0, 2) ?? []),
      ...(summary.riskThemes?.slice(0, 2) ?? []),
    ]
      .filter((item): item is string => Boolean(item))
      .join('，')
  }

  private toEnterpriseSourceRefs(
    enterpriseSignals?: CsaasEnterpriseSignalsResult | null,
  ): string[] {
    if (enterpriseSignals?.mode !== 'enterprise' || enterpriseSignals.signalsApplied.length === 0) {
      return []
    }

    return enterpriseSignals.sources.flatMap((source) => {
      switch (source) {
        case 'csaas_it_maturity':
          return ['csaas:it-maturity']
        case 'csaas_compliance':
          return ['csaas:compliance']
        default:
          return []
      }
    })
  }

  private buildRecommendationContext(
    request: QuickConsultRecommendationRequest,
  ): QuickConsultRecommendationContext {
    const hasEnterpriseSignals =
      request.enterpriseSignals?.mode === 'enterprise' &&
      request.enterpriseSignals.signalsApplied.length > 0
    const sources: QuickConsultRecommendationContextSource[] = []
    if (request.organizationContext) {
      sources.push('organization_context')
    }
    if (hasEnterpriseSignals) {
      sources.push(...request.enterpriseSignals.sources)
    }

    const contextCompletionPrompt = this.createContextCompletionPrompt(request.organizationContext)
    const mode = hasEnterpriseSignals ? 'enterprise' : 'generic'

    return {
      mode,
      signalsApplied:
        mode === 'enterprise' ? (request.enterpriseSignals?.signalsApplied ?? []) : [],
      sources,
      ...(mode === 'generic' && request.enterpriseSignals?.fallbackReason
        ? { fallbackReason: request.enterpriseSignals.fallbackReason }
        : {}),
      ...(contextCompletionPrompt ? { contextCompletionPrompt } : {}),
    }
  }

  private createContextCompletionPrompt(
    organizationContext?: AdvisoryOrganizationPromptContext | null,
  ): QuickConsultContextCompletionPrompt | undefined {
    const missingFields = normalizeContextMissingFields(
      organizationContext?.completeness.missingFields,
    )
    const completenessScore =
      typeof organizationContext?.completenessScore === 'number'
        ? organizationContext.completenessScore
        : 0
    const normalizedMissingFields =
      missingFields.length > 0 ? missingFields : inferMissingContextFields(organizationContext)

    if (completenessScore >= 70 || normalizedMissingFields.length === 0) return undefined

    return {
      missingFields: normalizedMissingFields,
      message: `补充${formatMissingFields(normalizedMissingFields)}可提升推荐精度。`,
      action: 'open_enterprise_background_settings',
    }
  }
}

const CONTEXT_COMPLETION_FIELD_LABELS: Record<string, string> = {
  organizationName: '企业名称',
  industry: '行业',
  size: '规模',
}
const CONTEXT_COMPLETION_FIELDS = Object.keys(CONTEXT_COMPLETION_FIELD_LABELS)

function formatMissingFields(fields: string[]): string {
  return fields
    .map((field) => CONTEXT_COMPLETION_FIELD_LABELS[field])
    .filter(Boolean)
    .join('、')
}

function normalizeContextMissingFields(value: unknown): string[] {
  const allowed = new Set(CONTEXT_COMPLETION_FIELDS)
  const seen = new Set<string>()

  return (Array.isArray(value) ? value : [])
    .filter((field): field is string => typeof field === 'string' && allowed.has(field))
    .filter((field) => {
      if (seen.has(field)) return false
      seen.add(field)
      return true
    })
    .slice(0, CONTEXT_COMPLETION_FIELDS.length)
}

function inferMissingContextFields(
  organizationContext?: AdvisoryOrganizationPromptContext | null,
): string[] {
  if (!organizationContext) return [...CONTEXT_COMPLETION_FIELDS]

  const inferred = [
    organizationContext.organizationName?.trim() ? null : 'organizationName',
    organizationContext.industry?.trim() ? null : 'industry',
    organizationContext.size?.trim() ? null : 'size',
  ].filter((field): field is string => Boolean(field))

  return inferred.length > 0 ? inferred : [...CONTEXT_COMPLETION_FIELDS]
}
