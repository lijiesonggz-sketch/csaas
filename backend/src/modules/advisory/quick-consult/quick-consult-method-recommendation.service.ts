import { Injectable } from '@nestjs/common'
import { ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import type { AdvisoryOrganizationPromptContext } from '../org-context/advisory-organization-context.service'
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
}

export interface QuickConsultRecommendationRequest {
  contextId: string
  classification: QuickConsultProblemClassificationResult
  providerStatus?: QuickConsultProviderStatus
  organizationContext?: AdvisoryOrganizationPromptContext | null
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
    if (request.classification.confidenceLevel === 'low') {
      return {
        confidence: QuickConsultRecommendationConfidence.None,
        recommendations: [],
        generatedAt,
        sourceRefCount: 0,
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
    const primaryRationale = [
      `${label}场景需要先围绕“${scenarioLanguage}”选择可执行的分析路径。`,
      ...(organizationFit ? [`已结合企业背景：${organizationFit}。`] : []),
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
      sourceRefs: this.toSafeSourceRefs(context.workflow),
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
}
