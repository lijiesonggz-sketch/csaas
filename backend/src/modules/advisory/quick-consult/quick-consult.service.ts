import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import {
  AdvisoryQuickConsultClarificationAnswer,
  AdvisoryQuickConsultContext,
  AdvisoryQuickConsultContextMetadata,
  AdvisoryQuickConsultContextStatus,
} from '../../../database/entities/advisory-quick-consult-context.entity'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AdvisoryAccessService, AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { QUICK_CONSULT_PROBLEM_MAX_LENGTH } from './dto/start-quick-consult.dto'
import {
  QuickConsultMethodRecommendation,
  QuickConsultMethodRecommendationService,
  QuickConsultRecommendationConfidence,
  QuickConsultRecommendationSet,
} from './quick-consult-method-recommendation.service'
import { QuickConsultContextRepository } from './quick-consult.repository'
import {
  AdvisoryOrganizationContextService,
  AdvisoryOrganizationPromptContext,
} from '../org-context/advisory-organization-context.service'

export const THINKTANK_QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE = '请先描述你要咨询的问题。'
export const THINKTANK_QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE =
  '问题描述过长，请精简到 5000 字符以内。'
export const THINKTANK_QUICK_CONSULT_CONTEXT_REQUIRED_MESSAGE =
  '请先完成当前 Quick Consult 澄清上下文。'
export const THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE =
  'Quick Consult 上下文不存在或已不可用。'
export const THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE =
  '请先回答全部澄清问题后再继续。'
export const THINKTANK_QUICK_CONSULT_START_FAILED_MESSAGE =
  '暂时无法启动 Quick Consult，请稍后重试。'

const QUICK_CONSULT_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000
const LOW_CONFIDENCE_MANUAL_BROWSE_HINT = '你也可以先手动浏览工作流，不必等待系统给出确定推荐。'
const DEFAULT_MANUAL_BROWSE_HINT = '也可以手动浏览工作流，直接选择更熟悉的分析路径。'

interface ProblemTypeDefinition {
  id: QuickConsultProblemType
  label: string
  scenarioLanguage: string
  keywords: RegExp[]
}

const PROBLEM_TYPE_DEFINITIONS: ProblemTypeDefinition[] = [
  {
    id: 'budget',
    label: '预算约束',
    scenarioLanguage: '预算被砍，需要重新排优先级',
    keywords: [/预算|成本|降本|砍|压缩|投入产出|roi/i, /budget|cost|spend|funding|roi/i],
  },
  {
    id: 'architecture',
    label: '架构取舍',
    scenarioLanguage: '技术路线需要在成本和长期能力之间取舍',
    keywords: [
      /架构|技术路线|平台|系统|集成|数据平台|重构/i,
      /architecture|platform|system|integration|technical/i,
    ],
  },
  {
    id: 'strategy',
    label: '战略取舍',
    scenarioLanguage: '方向很多，需要先判断该押注什么',
    keywords: [
      /战略|方向|定位|增长|优先级|路线图|取舍/i,
      /strategy|growth|roadmap|priority|positioning/i,
    ],
  },
  {
    id: 'innovation',
    label: '创新探索',
    scenarioLanguage: '想验证新机会，但还不确定从哪里切入',
    keywords: [
      /创新|新产品|机会|探索|验证|试点|概念验证|poc/i,
      /innovation|new product|opportunity|experiment|pilot|poc/i,
    ],
  },
  {
    id: 'team',
    label: '团队协同',
    scenarioLanguage: '跨团队目标不齐，需要统一分工和决策节奏',
    keywords: [
      /跨团队|cross-functional/i,
      /团队|组织/i,
      /协同|分工|沟通|跨部门|负责人/i,
      /team|org|organization|alignment|stakeholder/i,
    ],
  },
  {
    id: 'process',
    label: '流程优化',
    scenarioLanguage: '流程卡住了，需要找到瓶颈并减少反复',
    keywords: [
      /流程|workflow|process/i,
      /效率|优化|自动化|efficiency|automation/i,
      /交付|审批|瓶颈|onboarding|delivery|bottleneck/i,
    ],
  },
  {
    id: 'compliance',
    label: '合规整改',
    scenarioLanguage: '合规要求临近，需要明确整改范围和优先级',
    keywords: [
      /合规|审计|整改|iso\s*27001|soc\s*2|监管|数据安全/i,
      /compliance|audit|remediation|iso\s*27001|soc\s*2|regulation/i,
    ],
  },
  {
    id: 'risk',
    label: '风险控制',
    scenarioLanguage: '风险正在影响决策，需要先判断影响面和缓解路径',
    keywords: [
      /风险|故障|中断|安全|不确定|失败|延期/i,
      /risk|failure|incident|security|uncertain|delay/i,
    ],
  },
]

export type QuickConsultProviderStatus = 'not_called' | 'fake' | 'available' | 'degraded'
export type QuickConsultProblemClarity = 'ambiguous' | 'clear'
export type QuickConsultStartStatus = 'clarification_required' | 'analysis_started'
export type QuickConsultProblemType =
  | 'strategy'
  | 'innovation'
  | 'architecture'
  | 'team'
  | 'budget'
  | 'process'
  | 'compliance'
  | 'risk'
export type QuickConsultConfidenceLevel = 'low' | 'medium' | 'high'

export interface QuickConsultProblemTypeClassification {
  id: QuickConsultProblemType
  label: string
  confidence: number
  scenarioLanguage: string
}

export interface QuickConsultScenarioLanguage {
  label: string
  summary: string
  guidance: string
}

export interface QuickConsultProblemClassificationResult {
  problemTypes: QuickConsultProblemTypeClassification[]
  primaryProblemType?: QuickConsultProblemType
  confidence: number
  confidenceLevel: QuickConsultConfidenceLevel
  scenarioLanguage: QuickConsultScenarioLanguage
  manualBrowseHint: string
}

export interface QuickConsultOriginalProblemContext {
  text: string
  language: 'zh-CN' | 'en' | 'unknown'
}

export interface QuickConsultClassification {
  clarity: QuickConsultProblemClarity
  confidence: number
  originalProblemContext: QuickConsultOriginalProblemContext
  problemTypes?: QuickConsultProblemTypeClassification[]
  primaryProblemType?: QuickConsultProblemType
  confidenceLevel?: QuickConsultConfidenceLevel
  scenarioLanguage?: QuickConsultScenarioLanguage
  manualBrowseHint?: string
  clarificationQuestions?: string[]
  normalizedProblem?: string
  provider?: string
  providerStatus?: QuickConsultProviderStatus
  latencyMs?: number
}

export interface QuickConsultStartInput {
  user: AdvisoryAccessUser
  tenantId: string
  problem: string
  contextId?: string
  originalProblem?: string
  clarificationAnswers?: QuickConsultClarificationAnswerInput[]
  metadata?: Record<string, unknown>
}

export interface QuickConsultClarificationAnswerInput {
  question: string
  answer: string
}

export interface QuickConsultAnalysisStartInput {
  tenantId: string
  actorId: string
  organizationId?: string | null
  organizationContext?: AdvisoryOrganizationPromptContext | null
  contextId?: string
  normalizedProblem: string
  originalProblemContext: QuickConsultOriginalProblemContext
  clarificationAnswers?: AdvisoryQuickConsultClarificationAnswer[]
  provider?: string
  providerStatus?: QuickConsultProviderStatus
  latencyMs?: number
  classification?: QuickConsultProblemClassificationResult
}

export interface QuickConsultAnalysisStartResult {
  consultationId: string
  contextId?: string
  status: 'analysis_started'
  provider?: string
  providerStatus?: QuickConsultProviderStatus
  latencyMs?: number
  analysisWindowMinutes?: number
  preview?: {
    nextStepLabel: string
    estimatedDurationMinutes?: number
  }
  operationalStatus?: string
  classification?: QuickConsultProblemClassificationResult
}

export type QuickConsultStartResult =
  | {
      status: 'clarification_required'
      contextId: string
      consultId: string
      originalProblemContext: QuickConsultOriginalProblemContext
      clarificationQuestions: string[]
      questions: string[]
      clarificationAnswers: AdvisoryQuickConsultClarificationAnswer[]
      providerStatus: QuickConsultProviderStatus
      latencyMs: number
      operationalStatus: string
      classification: QuickConsultProblemClassificationResult
      recommendations: QuickConsultMethodRecommendation[]
      recommendationConfidence: QuickConsultRecommendationConfidence
    }
  | {
      status: 'analysis_started'
      contextId: string
      consultId: string
      consultationId: string
      originalProblemContext: QuickConsultOriginalProblemContext
      clarificationAnswers: AdvisoryQuickConsultClarificationAnswer[]
      provider?: string
      providerStatus: QuickConsultProviderStatus
      latencyMs: number
      analysisWindowMinutes: number
      preview: {
        nextStepLabel: string
        estimatedDurationMinutes: number
      }
      operationalStatus: string
      classification: QuickConsultProblemClassificationResult
      recommendations: QuickConsultMethodRecommendation[]
      recommendationConfidence: QuickConsultRecommendationConfidence
    }

@Injectable()
export class QuickConsultIntakeAnalyzer {
  async classifyProblem(context: {
    problem: string
    tenantId?: string
    user?: AdvisoryAccessUser
  }): Promise<QuickConsultClassification> {
    const startedAt = Date.now()
    const problem = context.problem.trim()
    const originalProblemContext = {
      text: problem,
      language: detectProblemLanguage(problem),
    }
    const detectedClassification = detectProblemClassification(problem)

    if (isAmbiguousProblem(problem)) {
      return {
        clarity: 'ambiguous',
        confidence: 0.46,
        originalProblemContext,
        ...withClassificationConfidence(detectedClassification, 0.46, 'low'),
        providerStatus: 'not_called',
        latencyMs: elapsedMs(startedAt),
        clarificationQuestions: buildClarificationQuestions(problem),
      }
    }

    return {
      clarity: 'clear',
      confidence: 0.86,
      originalProblemContext,
      ...withClassificationConfidence(detectedClassification, 0.86, 'high'),
      normalizedProblem: normalizeProblemStatement(problem),
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: elapsedMs(startedAt),
    }
  }
}

@Injectable()
export class QuickConsultAnalysisRunner {
  async startAnalysis(
    input: QuickConsultAnalysisStartInput,
  ): Promise<QuickConsultAnalysisStartResult> {
    const startedAt = Date.now()
    const consultationId = input.contextId ?? `quick-consult-${randomUUID()}`

    return {
      consultationId,
      contextId: consultationId,
      status: 'analysis_started',
      provider: input.provider ?? 'fake',
      providerStatus: input.providerStatus ?? 'fake',
      latencyMs: Math.max(input.latencyMs ?? 0, elapsedMs(startedAt)),
      analysisWindowMinutes: 5,
      preview: {
        nextStepLabel: 'Quick Consult analysis',
        estimatedDurationMinutes: 5,
      },
      operationalStatus: 'Fake provider ready. 5-minute analysis path started.',
      classification: input.classification,
    }
  }
}

@Injectable()
export class QuickConsultService {
  constructor(
    private readonly accessService: AdvisoryAccessService,
    private readonly intakeAnalyzer: QuickConsultIntakeAnalyzer,
    private readonly analysisRunner: QuickConsultAnalysisRunner,
    private readonly eventService: AdvisoryEventService,
    private readonly contextRepository: QuickConsultContextRepository,
    private readonly methodRecommendationService: QuickConsultMethodRecommendationService,
    @Optional()
    private readonly organizationContextService?: AdvisoryOrganizationContextService,
  ) {}

  async startQuickConsult(context: QuickConsultStartInput): Promise<QuickConsultStartResult> {
    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)

    const problem = this.normalizeProblem(context.problem)
    const clarificationAnswers = this.normalizeClarificationAnswers(context.clarificationAnswers)
    const requestedContextId = this.normalizeOptionalContextId(context.contextId)

    if (clarificationAnswers.length > 0 && !requestedContextId) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_REQUIRED_MESSAGE],
      })
    }

    const existingContext = requestedContextId
      ? await this.contextRepository.findContextForActor(
          context.tenantId,
          requestedContextId,
          context.user.id,
        )
      : null
    if (requestedContextId && !existingContext) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE],
      })
    }
    if (requestedContextId) {
      this.assertContextCanAcceptClarification(existingContext)
      if (clarificationAnswers.length === 0) {
        throw new BadRequestException({
          message: [THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE],
        })
      }
    }
    const attachedClarificationAnswers = requestedContextId
      ? this.requireClarificationAnswersForContext(existingContext, clarificationAnswers)
      : []
    const originalProblem = this.resolveOriginalProblem({
      problem,
      originalProblem: context.originalProblem,
      existingContext,
      hasClarificationAnswers: attachedClarificationAnswers.length > 0,
    })
    const problemForClassification =
      attachedClarificationAnswers.length > 0
        ? buildClarifiedProblemStatement(originalProblem, attachedClarificationAnswers)
        : problem
    const classification = await this.intakeAnalyzer.classifyProblem({
      problem: problemForClassification,
      tenantId: context.tenantId,
      user: context.user,
    })
    const effectiveClassification =
      attachedClarificationAnswers.length > 0 && classification.clarity === 'ambiguous'
        ? {
            ...classification,
            clarity: 'clear' as const,
            normalizedProblem: buildClarifiedProblemStatement(
              originalProblem,
              attachedClarificationAnswers,
            ),
            provider: classification.provider ?? 'fake',
            providerStatus: classification.providerStatus ?? 'fake',
            originalProblemContext: {
              text: originalProblem,
              language: detectProblemLanguage(originalProblem),
            },
          }
        : {
            ...classification,
            originalProblemContext:
              attachedClarificationAnswers.length > 0
                ? {
                    text: originalProblem,
                    language: detectProblemLanguage(originalProblem),
                  }
                : classification.originalProblemContext,
          }
    const problemClassification = buildProblemClassification(effectiveClassification)
    const organizationContext = await this.loadOrganizationPromptContext(context.tenantId)
    const requiresClarification =
      effectiveClassification.clarity === 'ambiguous' ||
      (problemClassification.confidenceLevel === 'low' && attachedClarificationAnswers.length === 0)

    if (requiresClarification) {
      const questions = this.normalizeClarificationQuestions(
        effectiveClassification.clarificationQuestions,
      )
      const quickConsultContext = await this.contextRepository.createContext(context.tenantId, {
        actorId: context.user.id,
        originalProblem,
        normalizedProblem: null,
        status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
        clarificationQuestions: questions,
        clarificationAnswers: [],
        provider: null,
        providerStatus: effectiveClassification.providerStatus ?? 'not_called',
        latencyMs: this.toNonNegativeNumber(effectiveClassification.latencyMs),
        metadata: this.buildContextMetadata(problemClassification, organizationContext),
      })
      const contextId = quickConsultContext.id

      return {
        status: 'clarification_required',
        contextId,
        consultId: contextId,
        originalProblemContext: {
          text: originalProblem,
          language: detectProblemLanguage(originalProblem),
        },
        clarificationQuestions: questions,
        questions,
        clarificationAnswers: [],
        providerStatus: effectiveClassification.providerStatus ?? 'not_called',
        latencyMs: this.toNonNegativeNumber(effectiveClassification.latencyMs),
        operationalStatus: 'Clarification required before analysis starts.',
        classification: problemClassification,
        recommendations: [],
        recommendationConfidence: QuickConsultRecommendationConfidence.None,
      }
    }

    const normalizedProblem = effectiveClassification.normalizedProblem ?? problemForClassification
    const pendingContext = existingContext
      ? await this.contextRepository.updateContext(context.tenantId, existingContext.id, {
          originalProblem,
          normalizedProblem,
          status: AdvisoryQuickConsultContextStatus.AnalysisPending,
          clarificationAnswers: attachedClarificationAnswers,
          provider: effectiveClassification.provider ?? 'fake',
          providerStatus: effectiveClassification.providerStatus ?? 'fake',
          latencyMs: this.toNonNegativeNumber(effectiveClassification.latencyMs),
          metadata: this.buildContextMetadata(problemClassification, organizationContext),
        })
      : await this.contextRepository.createContext(context.tenantId, {
          actorId: context.user.id,
          originalProblem,
          normalizedProblem,
          status: AdvisoryQuickConsultContextStatus.AnalysisPending,
          clarificationQuestions: [],
          clarificationAnswers: attachedClarificationAnswers,
          provider: effectiveClassification.provider ?? 'fake',
          providerStatus: effectiveClassification.providerStatus ?? 'fake',
          latencyMs: this.toNonNegativeNumber(effectiveClassification.latencyMs),
          metadata: this.buildContextMetadata(problemClassification, organizationContext),
        })
    const quickConsultContext = pendingContext ?? existingContext
    const durableContextId = quickConsultContext?.id ?? `quick-consult-${randomUUID()}`
    let recommendationSet: QuickConsultRecommendationSet
    try {
      recommendationSet = await this.generateRecommendations({
        contextId: durableContextId,
        classification: problemClassification,
        providerStatus: effectiveClassification.providerStatus ?? 'fake',
        organizationContext,
      })
    } catch {
      if (quickConsultContext) {
        await this.contextRepository.updateContext(context.tenantId, quickConsultContext.id, {
          status: AdvisoryQuickConsultContextStatus.AnalysisFailed,
          provider: effectiveClassification.provider ?? null,
          providerStatus: 'degraded',
          latencyMs: this.toNonNegativeNumber(effectiveClassification.latencyMs),
          metadata: {
            ...this.buildContextMetadata(problemClassification, organizationContext),
            recommendations: this.buildFailedRecommendationMetadata(),
          },
        })
      }
      await this.emitQuickConsultFailed({
        tenantId: context.tenantId,
        user: context.user,
        contextId: durableContextId,
        providerStatus: 'degraded',
        classification: problemClassification,
        failureStage: 'recommendation_generation',
      })
      throw new ServiceUnavailableException({
        message: [THINKTANK_QUICK_CONSULT_START_FAILED_MESSAGE],
      })
    }

    let analysis: QuickConsultAnalysisStartResult
    try {
      analysis = await this.analysisRunner.startAnalysis({
        tenantId: context.tenantId,
        actorId: context.user.id,
        organizationId: context.user.organizationId ?? null,
        organizationContext,
        contextId: durableContextId,
        normalizedProblem,
        originalProblemContext: effectiveClassification.originalProblemContext,
        clarificationAnswers: attachedClarificationAnswers,
        provider: effectiveClassification.provider,
        providerStatus: effectiveClassification.providerStatus,
        latencyMs: effectiveClassification.latencyMs,
        classification: problemClassification,
      })
    } catch {
      if (quickConsultContext) {
        await this.contextRepository.updateContext(context.tenantId, quickConsultContext.id, {
          status: AdvisoryQuickConsultContextStatus.AnalysisFailed,
          provider: effectiveClassification.provider ?? null,
          providerStatus: 'degraded',
          latencyMs: this.toNonNegativeNumber(effectiveClassification.latencyMs),
          metadata: {
            ...this.buildContextMetadata(problemClassification, organizationContext),
            analysis_start_failed: true,
          },
        })
      }
      await this.emitQuickConsultFailed({
        tenantId: context.tenantId,
        user: context.user,
        contextId: durableContextId,
        providerStatus: 'degraded',
        classification: problemClassification,
        failureStage: 'analysis_start',
      })
      throw new ServiceUnavailableException({
        message: [THINKTANK_QUICK_CONSULT_START_FAILED_MESSAGE],
      })
    }
    const contextId = durableContextId
    const providerStatus =
      analysis.providerStatus ?? effectiveClassification.providerStatus ?? ('fake' as const)
    const latencyMs = this.toNonNegativeNumber(
      analysis.latencyMs ?? effectiveClassification.latencyMs,
    )
    const provider = analysis.provider ?? effectiveClassification.provider

    if (quickConsultContext) {
      await this.contextRepository.updateContext(context.tenantId, quickConsultContext.id, {
        status: AdvisoryQuickConsultContextStatus.AnalysisStarted,
        provider: provider ?? null,
        providerStatus,
        latencyMs,
        metadata: {
          ...this.buildContextMetadata(problemClassification, organizationContext),
          recommendations: this.buildRecommendationMetadata(recommendationSet),
        },
      })
    }

    await this.emitQuickConsultStarted({
      tenantId: context.tenantId,
      user: context.user,
      contextId,
      provider,
      providerStatus,
      latencyMs,
      inputLength: originalProblem.length,
      answerCount: attachedClarificationAnswers.length,
      clarity: effectiveClassification.clarity,
      classification: problemClassification,
    })
    await this.emitQuickConsultCompleted({
      tenantId: context.tenantId,
      user: context.user,
      contextId,
      provider,
      providerStatus,
      latencyMs,
      classification: problemClassification,
      recommendationSet,
    })

    return {
      status: 'analysis_started',
      contextId,
      consultId: contextId,
      consultationId: analysis.consultationId,
      originalProblemContext: effectiveClassification.originalProblemContext,
      clarificationAnswers: attachedClarificationAnswers,
      provider,
      providerStatus,
      latencyMs,
      analysisWindowMinutes: analysis.analysisWindowMinutes ?? 5,
      preview: {
        nextStepLabel: analysis.preview?.nextStepLabel ?? 'Quick Consult analysis',
        estimatedDurationMinutes: analysis.preview?.estimatedDurationMinutes ?? 5,
      },
      operationalStatus:
        analysis.operationalStatus ??
        '5-minute analysis started. You can keep browsing ThinkTank workflows.',
      classification: analysis.classification ?? problemClassification,
      recommendations: recommendationSet.recommendations,
      recommendationConfidence: recommendationSet.confidence,
    }
  }

  private normalizeProblem(problem: string): string {
    if (typeof problem !== 'string' || problem.trim().length === 0 || !hasVisibleText(problem)) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE],
      })
    }

    const normalized = problem.trim()
    if (normalized.length > QUICK_CONSULT_PROBLEM_MAX_LENGTH) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE],
      })
    }

    return normalized
  }

  private normalizeClarificationAnswers(
    answers: unknown,
  ): AdvisoryQuickConsultClarificationAnswer[] {
    if (answers === undefined || answers === null) return []
    if (!Array.isArray(answers)) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE],
      })
    }

    return answers
      .filter((answer) => answer && typeof answer === 'object')
      .map((answer) => ({
        question:
          typeof (answer as QuickConsultClarificationAnswerInput).question === 'string'
            ? (answer as QuickConsultClarificationAnswerInput).question.trim()
            : '',
        answer:
          typeof (answer as QuickConsultClarificationAnswerInput).answer === 'string'
            ? (answer as QuickConsultClarificationAnswerInput).answer.trim()
            : '',
      }))
      .filter((answer) => answer.question && answer.answer && hasVisibleText(answer.answer))
      .slice(0, 2)
  }

  private normalizeOptionalContextId(contextId: unknown): string | undefined {
    if (contextId === undefined || contextId === null) return undefined
    if (typeof contextId !== 'string' || !contextId.trim()) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_REQUIRED_MESSAGE],
      })
    }

    return contextId.trim()
  }

  private requireClarificationAnswersForContext(
    existingContext: AdvisoryQuickConsultContext | null,
    answers: AdvisoryQuickConsultClarificationAnswer[],
  ): AdvisoryQuickConsultClarificationAnswer[] {
    if (!existingContext) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE],
      })
    }

    const questions = normalizeQuestionList(existingContext.clarificationQuestions)
    if (questions.length === 0) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE],
      })
    }

    const answersByQuestion = new Map(answers.map((answer) => [answer.question, answer.answer]))
    const attachedAnswers = questions.map((question) => ({
      question,
      answer: answersByQuestion.get(question) ?? '',
    }))

    if (
      attachedAnswers.length !== questions.length ||
      attachedAnswers.some((answer) => !answer.answer || !hasVisibleText(answer.answer))
    ) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE],
      })
    }

    return attachedAnswers
  }

  private assertContextCanAcceptClarification(
    existingContext: AdvisoryQuickConsultContext | null,
  ): void {
    if (!existingContext) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE],
      })
    }

    if (existingContext.status !== AdvisoryQuickConsultContextStatus.ClarificationRequired) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE],
      })
    }

    if (isQuickConsultContextExpired(existingContext)) {
      throw new BadRequestException({
        message: [THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE],
      })
    }
  }

  private resolveOriginalProblem(context: {
    problem: string
    originalProblem?: string
    existingContext: AdvisoryQuickConsultContext | null
    hasClarificationAnswers: boolean
  }): string {
    const candidate =
      context.existingContext?.originalProblem ??
      (context.hasClarificationAnswers ? context.originalProblem : undefined) ??
      context.problem

    return this.normalizeProblem(candidate)
  }

  private normalizeClarificationQuestions(questions: string[] | undefined): string[] {
    const normalized = normalizeQuestionList(questions)

    return normalized.length > 0 ? normalized : buildClarificationQuestions('')
  }

  private async emitQuickConsultStarted(context: {
    tenantId: string
    user: AdvisoryAccessUser
    contextId: string
    provider?: string
    providerStatus: QuickConsultProviderStatus
    latencyMs: number
    inputLength: number
    answerCount: number
    clarity: QuickConsultProblemClarity
    classification: QuickConsultProblemClassificationResult
  }): Promise<void> {
    await this.eventService.emitAudit({
      eventName: ThinkTankEventName.QuickConsultStarted,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.QuickConsult,
      subjectId: context.contextId,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        provider: context.provider,
        latencyMs: context.latencyMs,
      },
      audit: {
        action: AuditAction.CREATE,
        entityType: 'ThinkTankQuickConsult',
        entityId: context.contextId,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        clarity: context.clarity,
        input_length: context.inputLength,
        clarification_required: false,
        question_count: context.answerCount,
        clarification_answer_count: context.answerCount,
        provider_status: context.providerStatus,
        classification_ids: context.classification.problemTypes.map(
          (problemType) => problemType.id,
        ),
        classification_count: context.classification.problemTypes.length,
        confidence: context.classification.confidence,
        confidence_level: context.classification.confidenceLevel,
        scenario_label: readSafeScenarioLabel(context.classification),
      },
    })
  }

  private async emitQuickConsultCompleted(context: {
    tenantId: string
    user: AdvisoryAccessUser
    contextId: string
    provider?: string
    providerStatus: QuickConsultProviderStatus
    latencyMs: number
    classification: QuickConsultProblemClassificationResult
    recommendationSet: QuickConsultRecommendationSet
  }): Promise<void> {
    await this.eventService.emitAudit({
      eventName: ThinkTankEventName.QuickConsultCompleted,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.QuickConsult,
      subjectId: context.contextId,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        provider: context.provider,
        latencyMs: context.latencyMs,
      },
      audit: {
        action: AuditAction.UPDATE,
        entityType: 'ThinkTankQuickConsult',
        entityId: context.contextId,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        recommendation_count: context.recommendationSet.recommendations.length,
        recommendation_ids: context.recommendationSet.recommendations.map(
          (recommendation) => recommendation.recommendationId,
        ),
        top_workflow_key: context.recommendationSet.recommendations[0]?.workflowKey ?? null,
        classification_ids: context.classification.problemTypes.map(
          (problemType) => problemType.id,
        ),
        classification_count: context.classification.problemTypes.length,
        confidence: context.classification.confidence,
        confidence_level: context.classification.confidenceLevel,
        provider_status: context.providerStatus,
        source_ref_count: context.recommendationSet.sourceRefCount,
      },
    })
  }

  private async emitQuickConsultFailed(context: {
    tenantId: string
    user: AdvisoryAccessUser
    contextId: string
    providerStatus: QuickConsultProviderStatus
    classification: QuickConsultProblemClassificationResult
    failureStage: 'recommendation_generation' | 'analysis_start'
  }): Promise<void> {
    await this.eventService.emitAudit({
      eventName: ThinkTankEventName.QuickConsultFailed,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.QuickConsult,
      subjectId: context.contextId,
      outcome: ThinkTankEventOutcome.Failure,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      audit: {
        action: AuditAction.UPDATE,
        entityType: 'ThinkTankQuickConsult',
        entityId: context.contextId,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        failure_stage: context.failureStage,
        provider_status: context.providerStatus,
        classification_ids: context.classification.problemTypes.map(
          (problemType) => problemType.id,
        ),
        classification_count: context.classification.problemTypes.length,
        confidence: context.classification.confidence,
        confidence_level: context.classification.confidenceLevel,
      },
    })
  }

  private async generateRecommendations(context: {
    contextId: string
    classification: QuickConsultProblemClassificationResult
    providerStatus: QuickConsultProviderStatus
    organizationContext?: AdvisoryOrganizationPromptContext | null
  }): Promise<QuickConsultRecommendationSet> {
    return this.methodRecommendationService.generateRecommendations(context)
  }

  private buildRecommendationMetadata(
    recommendationSet: QuickConsultRecommendationSet,
  ): AdvisoryQuickConsultContextMetadata['recommendations'] {
    return {
      status:
        recommendationSet.confidence === QuickConsultRecommendationConfidence.Confident
          ? 'generated'
          : 'none',
      confidence: recommendationSet.confidence,
      ids: recommendationSet.recommendations.map(
        (recommendation) => recommendation.recommendationId,
      ),
      workflowKeys: recommendationSet.recommendations.map(
        (recommendation) => recommendation.workflowKey,
      ),
      rationaleCategories: recommendationSet.recommendations.flatMap(
        (recommendation) => recommendation.classificationRefs,
      ),
      generatedAt: recommendationSet.generatedAt,
      sourceRefCount: recommendationSet.sourceRefCount,
    }
  }

  private buildFailedRecommendationMetadata(): AdvisoryQuickConsultContextMetadata['recommendations'] {
    return {
      status: 'failed',
      generatedAt: new Date().toISOString(),
      sourceRefCount: 0,
    }
  }

  private buildContextMetadata(
    classification: QuickConsultProblemClassificationResult,
    organizationContext?: AdvisoryOrganizationPromptContext | null,
  ): AdvisoryQuickConsultContextMetadata {
    return {
      confidence: classification.confidence,
      classification: {
        ids: classification.problemTypes.map((problemType) => problemType.id),
        labels: classification.problemTypes.map((problemType) => problemType.label),
        confidence: classification.confidence,
        confidenceLevel: classification.confidenceLevel,
        primaryProblemType: classification.primaryProblemType ?? null,
        scenarioLabel: readSafeScenarioLabel(classification),
        manualBrowseHint: classification.manualBrowseHint,
      },
      ...(organizationContext
        ? {
            organizationContext: this.buildOrganizationContextMetadata(organizationContext),
          }
        : {}),
    }
  }

  private buildOrganizationContextMetadata(
    context: AdvisoryOrganizationPromptContext,
  ): Record<string, string | number | boolean | string[]> {
    return {
      applied: true,
      contextId: context.contextId,
      completenessScore: context.completenessScore,
      requiredFieldsComplete: context.completeness.requiredFieldsComplete,
      missingFields: context.completeness.missingFields,
    }
  }

  private async loadOrganizationPromptContext(
    tenantId: string,
  ): Promise<AdvisoryOrganizationPromptContext | null> {
    if (!this.organizationContextService) {
      return null
    }

    try {
      return await this.organizationContextService.getPromptContext(tenantId)
    } catch {
      return null
    }
  }

  private toNonNegativeNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
  }
}

function elapsedMs(startedAt: number): number {
  return Math.max(Date.now() - startedAt, 0)
}

function detectProblemLanguage(problem: string): 'zh-CN' | 'en' | 'unknown' {
  if (/[\u4e00-\u9fa5]/.test(problem)) return 'zh-CN'
  if (/[A-Za-z]/.test(problem)) return 'en'
  return 'unknown'
}

function normalizeProblemStatement(problem: string): string {
  return problem.replace(/\s+/g, ' ').trim()
}

function detectProblemClassification(
  problem: string,
): Omit<QuickConsultProblemClassificationResult, 'confidence' | 'confidenceLevel'> {
  const matches = PROBLEM_TYPE_DEFINITIONS.flatMap((definition) => {
    const score =
      definition.keywords.filter((pattern) => pattern.test(problem)).length +
      readProblemTypePriorityBoost(problem, definition.id)
    if (score === 0) return []

    return [
      {
        definition,
        score,
      },
    ]
  }).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return (
      PROBLEM_TYPE_DEFINITIONS.findIndex((definition) => definition.id === left.definition.id) -
      PROBLEM_TYPE_DEFINITIONS.findIndex((definition) => definition.id === right.definition.id)
    )
  })
  const selectedDefinitions =
    matches.length > 0
      ? matches.map((match) => match.definition).slice(0, 4)
      : [PROBLEM_TYPE_DEFINITIONS.find((definition) => definition.id === 'strategy')!]
  const problemTypes = selectedDefinitions.map((definition, index) => ({
    id: definition.id,
    label: definition.label,
    confidence: clampConfidence(0.9 - index * 0.06),
    scenarioLanguage: definition.scenarioLanguage,
  }))
  const primaryProblemType = problemTypes[0]?.id
  const scenarioLanguage = buildScenarioLanguage(problemTypes)

  return {
    problemTypes,
    primaryProblemType,
    scenarioLanguage,
    manualBrowseHint: DEFAULT_MANUAL_BROWSE_HINT,
  }
}

function readProblemTypePriorityBoost(
  problem: string,
  problemType: QuickConsultProblemType,
): number {
  if (problemType === 'budget' && /预算|成本|budget|cost|funding|roi/i.test(problem)) {
    return 2
  }

  return 0
}

function readSafeScenarioLabel(classification: QuickConsultProblemClassificationResult): string {
  const primaryDefinition = PROBLEM_TYPE_DEFINITIONS.find(
    (definition) => definition.id === classification.primaryProblemType,
  )
  if (primaryDefinition) return primaryDefinition.scenarioLanguage

  const firstTypeDefinition = PROBLEM_TYPE_DEFINITIONS.find(
    (definition) => definition.id === classification.problemTypes[0]?.id,
  )

  return firstTypeDefinition?.scenarioLanguage ?? '问题边界还不够清楚'
}

function withClassificationConfidence(
  classification: Omit<QuickConsultProblemClassificationResult, 'confidence' | 'confidenceLevel'>,
  confidence: number,
  confidenceLevel: QuickConsultConfidenceLevel,
): Pick<
  QuickConsultClassification,
  | 'problemTypes'
  | 'primaryProblemType'
  | 'confidenceLevel'
  | 'scenarioLanguage'
  | 'manualBrowseHint'
> {
  return {
    problemTypes: classification.problemTypes.map((problemType, index) => ({
      ...problemType,
      confidence: clampConfidence(confidence - index * 0.04),
    })),
    primaryProblemType: classification.primaryProblemType,
    confidenceLevel,
    scenarioLanguage:
      confidenceLevel === 'low'
        ? {
            label: '问题边界还不够清楚',
            summary: '当前描述还不足以给出确定路径，需要先补充目标、团队或风险边界。',
            guidance: '先回答澄清问题；如果你已经知道要用哪类方法，也可以手动浏览工作流。',
          }
        : classification.scenarioLanguage,
    manualBrowseHint:
      confidenceLevel === 'low'
        ? LOW_CONFIDENCE_MANUAL_BROWSE_HINT
        : classification.manualBrowseHint,
  }
}

function buildProblemClassification(
  classification: QuickConsultClassification,
): QuickConsultProblemClassificationResult {
  const fallback = detectProblemClassification(
    classification.normalizedProblem ?? classification.originalProblemContext.text,
  )
  const problemTypes = normalizeProblemTypes(classification.problemTypes, fallback.problemTypes)
  const primaryProblemType =
    normalizeProblemType(classification.primaryProblemType) ?? problemTypes[0]?.id
  const confidence = clampConfidence(classification.confidence)
  const confidenceLevel = readConservativeConfidenceLevel(
    classification.confidenceLevel,
    confidence,
    classification.clarity,
  )
  const scenarioLanguage = classification.scenarioLanguage ?? buildScenarioLanguage(problemTypes)

  return {
    problemTypes,
    primaryProblemType,
    confidence,
    confidenceLevel,
    scenarioLanguage:
      confidenceLevel === 'low'
        ? {
            label: scenarioLanguage.label || '问题边界还不够清楚',
            summary:
              scenarioLanguage.summary ||
              '当前描述还不足以给出确定路径，需要先补充目标、团队或风险边界。',
            guidance:
              scenarioLanguage.guidance ||
              '先回答澄清问题；如果你已经知道要用哪类方法，也可以手动浏览工作流。',
          }
        : scenarioLanguage,
    manualBrowseHint:
      confidenceLevel === 'low' ? LOW_CONFIDENCE_MANUAL_BROWSE_HINT : DEFAULT_MANUAL_BROWSE_HINT,
  }
}

function normalizeProblemTypes(
  value: QuickConsultProblemTypeClassification[] | undefined,
  fallback: QuickConsultProblemTypeClassification[],
): QuickConsultProblemTypeClassification[] {
  const seen = new Set<QuickConsultProblemType>()
  const normalized = (Array.isArray(value) ? value : fallback)
    .map((problemType) => {
      const id = normalizeProblemType(problemType?.id)
      if (!id || seen.has(id)) return null
      seen.add(id)
      const definition = PROBLEM_TYPE_DEFINITIONS.find((candidate) => candidate.id === id)

      return {
        id,
        label: definition?.label ?? id,
        confidence: clampConfidence(problemType.confidence),
        scenarioLanguage: definition?.scenarioLanguage ?? '需要先明确问题类型和决策边界',
      }
    })
    .filter((problemType): problemType is QuickConsultProblemTypeClassification =>
      Boolean(problemType),
    )
    .slice(0, 4)

  return normalized.length > 0 ? normalized : fallback.slice(0, 1)
}

function normalizeProblemType(value: unknown): QuickConsultProblemType | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()

  return PROBLEM_TYPE_DEFINITIONS.some((definition) => definition.id === normalized)
    ? (normalized as QuickConsultProblemType)
    : undefined
}

function buildScenarioLanguage(
  problemTypes: QuickConsultProblemTypeClassification[],
): QuickConsultScenarioLanguage {
  const primary = problemTypes[0]
  if (!primary) {
    return {
      label: '问题边界还不够清楚',
      summary: '当前描述还不足以判断主要问题类型，需要先补充目标和业务场景。',
      guidance: '先回答澄清问题；如果你已有明确方向，也可以手动浏览工作流。',
    }
  }

  if (primary.id === 'budget') {
    return {
      label: primary.scenarioLanguage,
      summary: '当前问题更像是在预算收紧后重新判断优先级和关键取舍。',
      guidance: '先明确必须保留的业务目标，再比较路线的成本、风险和交付窗口。',
    }
  }

  if (primary.id === 'compliance') {
    return {
      label: primary.scenarioLanguage,
      summary: '当前问题更像是在合规压力下明确整改范围、优先级和业务影响。',
      guidance: '先厘清涉及系统、审计要求和整改成本，再选择深入分析路径。',
    }
  }

  if (primary.id === 'architecture') {
    return {
      label: primary.scenarioLanguage,
      summary: '当前问题更像是在技术路线、系统边界和长期能力之间做架构取舍。',
      guidance: '先列出业务目标和约束，再比较平台能力、交付风险和迁移成本。',
    }
  }

  return {
    label: primary.scenarioLanguage,
    summary: `当前问题更像是${primary.label}场景，需要先把目标、约束和决策边界讲清楚。`,
    guidance: '先收敛最关键的业务目标，再选择适合的工作流继续深入。',
  }
}

function readConfidenceLevel(
  confidence: number,
  clarity: QuickConsultProblemClarity,
): QuickConsultConfidenceLevel {
  if (clarity === 'ambiguous' || confidence < 0.55) return 'low'
  if (confidence < 0.75) return 'medium'
  return 'high'
}

function readConservativeConfidenceLevel(
  reportedLevel: QuickConsultConfidenceLevel | undefined,
  confidence: number,
  clarity: QuickConsultProblemClarity,
): QuickConsultConfidenceLevel {
  const inferredLevel = readConfidenceLevel(confidence, clarity)
  const rank: Record<QuickConsultConfidenceLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
  }
  if (!reportedLevel) return inferredLevel

  return rank[inferredLevel] <= rank[reportedLevel] ? inferredLevel : reportedLevel
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0

  return Math.min(Math.max(Number(value.toFixed(2)), 0), 1)
}

function normalizeQuestionList(questions: unknown): string[] {
  return (Array.isArray(questions) ? questions : [])
    .filter((question) => typeof question === 'string' && question.trim())
    .map((question) => question.trim())
    .slice(0, 2)
}

function hasVisibleText(value: string): boolean {
  return value.replace(/[\p{C}\s]/gu, '').length > 0
}

function isQuickConsultContextExpired(context: AdvisoryQuickConsultContext): boolean {
  const referenceDate = context.updatedAt ?? context.createdAt
  if (!(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) {
    return false
  }

  return Date.now() - referenceDate.getTime() > QUICK_CONSULT_CONTEXT_TTL_MS
}

function isAmbiguousProblem(problem: string): boolean {
  const normalized = problem.toLowerCase()
  const hasGenericAsk = /帮我|看看|怎么办|有点乱|help me|need help|ai strategy help/.test(
    normalized,
  )
  const specificitySignals = [
    /iso\s*27001/i,
    /soc\s*2/i,
    /访问控制|日志|整改|客户数据|数据平台|企业销售|预算|审计|合规整改/,
    /security|compliance|onboarding|workflow|enterprise|saas|customer data/i,
  ].filter((pattern) => pattern.test(problem)).length

  if (hasGenericAsk && specificitySignals < 2) return true
  if (specificitySignals > 0) return false
  if (problem.trim().length < 24) return true

  const tokenCount = /[\u4e00-\u9fa5]/.test(problem)
    ? Array.from(problem.replace(/\s+/g, '')).length
    : problem.trim().split(/\s+/).filter(Boolean).length

  return specificitySignals === 0 && tokenCount < 12
}

function buildClarifiedProblemStatement(
  originalProblem: string,
  answers: AdvisoryQuickConsultClarificationAnswer[],
): string {
  if (answers.length === 0) return normalizeProblemStatement(originalProblem)

  const answerText = answers.map((answer) => `${answer.question}: ${answer.answer}`).join(' ')

  return normalizeProblemStatement(`${originalProblem} ${answerText}`)
}

function buildClarificationQuestions(problem: string): string[] {
  const normalized = problem.toLowerCase()
  if (/合规|审计|iso|soc|security|compliance/i.test(normalized)) {
    return ['当前涉及哪个系统或业务范围？', '你最担心的是审计不通过、整改成本，还是业务中断？']
  }

  return [
    '你最想优先解决的是业务增长、风险控制、效率提升，还是合规整改？',
    '当前涉及哪个团队、系统或客户场景？',
  ]
}
