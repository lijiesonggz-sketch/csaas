import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { readAdvisoryMessage, unwrapAdvisoryEnvelope } from './envelope'

export const QUICK_CONSULT_PROBLEM_MAX_LENGTH = 5000
export const QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE = '请先描述你要咨询的问题。'
export const QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE = '问题描述过长，请精简到 5000 字以内。'
export const QUICK_CONSULT_START_FAILED_MESSAGE = '暂时无法启动 Quick Consult，请稍后重试。'
export const QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE = '暂时无法保存推荐反馈，请稍后重试。'
export const QUICK_CONSULT_FEEDBACK_REQUIRED_RATING_MESSAGE = '请选择 1 到 5 的推荐评分。'
export const QUICK_CONSULT_FEEDBACK_TOO_LONG_MESSAGE = '反馈内容过长，请精简到 2000 字以内。'
export const QUICK_CONSULT_FEEDBACK_MAX_LENGTH = 2000

const QUICK_CONSULT_DRAFT_STORAGE_PREFIX = 'thinktank:quick-consult-draft'

export interface QuickConsultStartInput {
  problem: string
  contextId?: string
  originalProblem?: string
  clarificationAnswers?: QuickConsultClarificationAnswer[]
}

export interface QuickConsultOriginalProblemContext {
  text: string
  language?: string
}

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
  manualBrowseHint?: string
}

export type QuickConsultRecommendationConfidence = 'none' | 'confident'

export interface QuickConsultMethodRecommendation {
  id: string
  recommendationId: string
  workflowKey: string
  methodName: string
  rank?: number
  rationale: string
  primaryRationale: string
  expandedRationale?: string
  fitScenario: string
  durationMinutes?: number
  expectedDuration: string
  expectedOutput: string
  classificationRefs: QuickConsultProblemType[]
  sourceRefs: string[]
}

export interface QuickConsultStartResult {
  status: 'clarification_required' | 'analysis_started'
  contextId: string
  consultId?: string
  consultationId?: string
  originalProblem?: string
  originalProblemContext?: QuickConsultOriginalProblemContext
  clarificationAnswers?: QuickConsultClarificationAnswer[]
  clarificationQuestions?: string[]
  questions?: string[]
  provider?: string
  providerStatus?: string
  latencyMs?: number
  analysisWindowMinutes?: number
  operationalStatus?: string
  preview?: {
    nextStepLabel?: string
    estimatedDurationMinutes?: number
  }
  classification?: QuickConsultProblemClassificationResult
  recommendations?: QuickConsultMethodRecommendation[]
  recommendationConfidence?: QuickConsultRecommendationConfidence
}

export interface QuickConsultClarificationAnswer {
  question: string
  answer: string
}

export interface QuickConsultDraftInput {
  userIdentity?: string | null
  problem: string
}

export interface QuickConsultRecommendationFeedbackInput {
  quickConsultContextId: string
  rating: number
  feedbackText?: string
  recommendationIds?: string[]
}

export interface QuickConsultRecommendationFeedbackResult {
  id: string
  quickConsultContextId: string
  rating: number
  createdAt?: string
}

export function readQuickConsultDraft(userIdentity?: string | null): string {
  if (typeof window === 'undefined') return ''
  const key = buildQuickConsultDraftKey(userIdentity)
  if (!key) return ''

  try {
    return window.sessionStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function saveQuickConsultDraft(input: QuickConsultDraftInput): void {
  if (typeof window === 'undefined') return

  const key = buildQuickConsultDraftKey(input.userIdentity)
  if (!key) return

  try {
    if (input.problem) {
      window.sessionStorage.setItem(key, input.problem)
      return
    }
    window.sessionStorage.removeItem(key)
  } catch {
    // Draft persistence is a convenience; intake state remains in React state.
  }
}

export async function startQuickConsult(
  input: QuickConsultStartInput
): Promise<QuickConsultStartResult> {
  const problem = normalizeQuickConsultProblem(input.problem)
  const clarificationAnswers = normalizeClarificationAnswers(input.clarificationAnswers)
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/quick-consult/start', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      problem,
      contextId: input.contextId,
      originalProblem:
        typeof input.originalProblem === 'string' && input.originalProblem.trim()
          ? input.originalProblem.trim()
          : undefined,
      clarificationAnswers: clarificationAnswers.length > 0 ? clarificationAnswers : undefined,
    }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? QUICK_CONSULT_START_FAILED_MESSAGE)
  }

  const data = unwrapAdvisoryEnvelope<QuickConsultStartResult>(body)
  if (!isValidQuickConsultResult(data)) {
    throw new Error(QUICK_CONSULT_START_FAILED_MESSAGE)
  }

  return normalizeQuickConsultResult(data)
}

export async function submitQuickConsultRecommendationFeedback(
  input: QuickConsultRecommendationFeedbackInput
): Promise<QuickConsultRecommendationFeedbackResult> {
  const quickConsultContextId = normalizeRequiredText(input.quickConsultContextId)
  const rating = normalizeRecommendationFeedbackRating(input.rating)
  const feedbackText = normalizeRecommendationFeedbackText(input.feedbackText)
  const recommendationIds = normalizeRecommendationIds(input.recommendationIds)
  const headers = await getAuthHeadersAsync()
  const response = await fetch('/api/advisory/quick-consult/recommendation-feedback', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quickConsultContextId,
      rating,
      feedbackText,
      recommendationIds: recommendationIds.length > 0 ? recommendationIds : undefined,
    }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readAdvisoryMessage(body) ?? QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE)
  }

  const data = unwrapAdvisoryEnvelope<QuickConsultRecommendationFeedbackResult>(body)
  if (!isValidRecommendationFeedbackResult(data)) {
    throw new Error(QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE)
  }

  return {
    ...data,
    quickConsultContextId: data.quickConsultContextId || quickConsultContextId,
    rating: data.rating,
  }
}

export function normalizeQuickConsultProblem(problem: string): string {
  if (typeof problem !== 'string' || problem.trim().length === 0) {
    throw new Error(QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE)
  }

  const normalized = problem.trim()
  if (normalized.length > QUICK_CONSULT_PROBLEM_MAX_LENGTH) {
    throw new Error(QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE)
  }

  return normalized
}

function buildQuickConsultDraftKey(userIdentity?: string | null): string {
  const normalizedIdentity = typeof userIdentity === 'string' ? userIdentity.trim() : ''
  return normalizedIdentity ? `${QUICK_CONSULT_DRAFT_STORAGE_PREFIX}:${normalizedIdentity}` : ''
}

function isValidQuickConsultResult(
  value: QuickConsultStartResult | null
): value is QuickConsultStartResult {
  if (!value || typeof value !== 'object') return false

  if (value.status === 'clarification_required') {
    return (
      Boolean(value.contextId || value.consultId) && readClarificationQuestions(value).length > 0
    )
  }
  if (value.status === 'analysis_started') {
    return Boolean(value.contextId || value.consultId || value.consultationId)
  }

  return false
}

function normalizeQuickConsultResult(result: QuickConsultStartResult): QuickConsultStartResult {
  const contextId = result.contextId ?? result.consultId ?? result.consultationId ?? ''
  const originalProblem = result.originalProblemContext?.text ?? result.originalProblem ?? undefined
  const clarificationQuestions = readClarificationQuestions(result)
  const clarificationAnswers = normalizeClarificationAnswers(result.clarificationAnswers)
  const classification = normalizeQuickConsultClassification(result.classification)
  const recommendations =
    classification?.confidenceLevel === 'low'
      ? []
      : normalizeQuickConsultRecommendations(result.recommendations)
  const hasEnoughRecommendations = recommendations.length >= 2

  return {
    ...result,
    contextId,
    consultId: result.consultId ?? contextId,
    originalProblem,
    originalProblemContext:
      result.originalProblemContext ??
      (originalProblem ? { text: originalProblem, language: 'unknown' } : undefined),
    clarificationQuestions,
    clarificationAnswers,
    classification,
    recommendations: hasEnoughRecommendations ? recommendations : [],
    recommendationConfidence: normalizeRecommendationConfidence(
      result.recommendationConfidence,
      hasEnoughRecommendations ? recommendations : []
    ),
  }
}

const QUICK_CONSULT_PROBLEM_TYPES = new Set<QuickConsultProblemType>([
  'strategy',
  'innovation',
  'architecture',
  'team',
  'budget',
  'process',
  'compliance',
  'risk',
])

function normalizeQuickConsultClassification(
  value: unknown
): QuickConsultProblemClassificationResult | undefined {
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const problemTypes = normalizeProblemTypeClassifications(record.problemTypes)
  if (problemTypes.length === 0) return undefined
  const confidence = clampConfidence(record.confidence)
  const confidenceLevel = normalizeConfidenceLevel(record.confidenceLevel, confidence)
  const primaryProblemType = normalizeProblemType(record.primaryProblemType) ?? problemTypes[0]?.id
  const scenarioLanguage = normalizeScenarioLanguage(record.scenarioLanguage, problemTypes[0])

  return {
    problemTypes,
    primaryProblemType,
    confidence,
    confidenceLevel,
    scenarioLanguage,
    manualBrowseHint:
      typeof record.manualBrowseHint === 'string' && record.manualBrowseHint.trim()
        ? record.manualBrowseHint.trim()
        : undefined,
  }
}

function normalizeProblemTypeClassifications(
  value: unknown
): QuickConsultProblemTypeClassification[] {
  const seen = new Set<QuickConsultProblemType>()

  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = normalizeProblemType(record.id)
      if (!id || seen.has(id)) return null
      const label = normalizeNonEmptyText(record.label)
      const scenarioLanguage = normalizeNonEmptyText(record.scenarioLanguage)
      if (!label || !scenarioLanguage) return null
      seen.add(id)

      return {
        id,
        label,
        confidence: clampConfidence(record.confidence),
        scenarioLanguage,
      }
    })
    .filter((item): item is QuickConsultProblemTypeClassification => Boolean(item))
    .slice(0, 4)
}

function normalizeScenarioLanguage(
  value: unknown,
  fallbackProblemType: QuickConsultProblemTypeClassification
): QuickConsultScenarioLanguage {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const label = normalizeNonEmptyText(record.label) ?? fallbackProblemType.scenarioLanguage

  return {
    label,
    summary:
      normalizeNonEmptyText(record.summary) ??
      `当前问题更像是${fallbackProblemType.label}场景，需要先收敛目标和约束。`,
    guidance:
      normalizeNonEmptyText(record.guidance) ??
      '先明确关键目标和决策边界，再选择适合的工作流继续深入。',
  }
}

function normalizeProblemType(value: unknown): QuickConsultProblemType | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim() as QuickConsultProblemType

  return QUICK_CONSULT_PROBLEM_TYPES.has(normalized) ? normalized : undefined
}

function normalizeQuickConsultRecommendations(value: unknown): QuickConsultMethodRecommendation[] {
  return (Array.isArray(value) ? value : [])
    .map((item): QuickConsultMethodRecommendation | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = normalizeNonEmptyText(record.id) ?? normalizeNonEmptyText(record.recommendationId)
      const workflowKey = normalizeWorkflowKey(record.workflowKey)
      const methodName = normalizeNonEmptyText(record.methodName)
      const fitScenario = normalizeNonEmptyText(record.fitScenario)
      const expectedOutput = normalizeNonEmptyText(record.expectedOutput)
      const primaryRationale =
        normalizeNonEmptyText(record.primaryRationale) ?? normalizeNonEmptyText(record.rationale)
      const expectedDuration =
        normalizeNonEmptyText(record.expectedDuration) ??
        normalizeDurationLabel(record.durationMinutes)
      const sourceRefs = normalizeRecommendationSourceRefs(record.sourceRefs)
      if (
        !id ||
        !workflowKey ||
        !methodName ||
        !fitScenario ||
        !expectedDuration ||
        !expectedOutput ||
        !primaryRationale ||
        sourceRefs.length === 0
      ) {
        return null
      }

      const rank = normalizePositiveInteger(record.rank)
      const expandedRationale = normalizeNonEmptyText(record.expandedRationale)
      const durationMinutes = normalizePositiveInteger(record.durationMinutes)

      return {
        id,
        recommendationId: normalizeNonEmptyText(record.recommendationId) ?? id,
        workflowKey,
        methodName,
        rationale: normalizeNonEmptyText(record.rationale) ?? primaryRationale,
        primaryRationale,
        fitScenario,
        expectedDuration,
        expectedOutput,
        classificationRefs: normalizeClassificationRefs(record.classificationRefs),
        sourceRefs,
        ...(rank ? { rank } : {}),
        ...(expandedRationale ? { expandedRationale } : {}),
        ...(durationMinutes ? { durationMinutes } : {}),
      }
    })
    .filter((item): item is QuickConsultMethodRecommendation => Boolean(item))
    .slice(0, 3)
}

function normalizeRecommendationConfidence(
  value: unknown,
  recommendations: unknown
): QuickConsultRecommendationConfidence {
  if (!Array.isArray(recommendations) || recommendations.length === 0) return 'none'
  if (value === 'confident') return 'confident'
  if (value === 'none') return 'none'

  return 'confident'
}

function normalizeWorkflowKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : undefined
}

function normalizeRecommendationSourceRefs(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((sourceRef) => typeof sourceRef === 'string' && sourceRef.trim())
    .map((sourceRef) => sourceRef.trim())
    .filter((sourceRef) => /^(workflow|method):[a-z0-9:-]+$/.test(sourceRef))
    .filter((sourceRef) => !/[\\/]|_bmad|prompt|content/i.test(sourceRef))
    .slice(0, 4)
}

function normalizeClassificationRefs(value: unknown): QuickConsultProblemType[] {
  return (Array.isArray(value) ? value : [])
    .map(normalizeProblemType)
    .filter((id): id is QuickConsultProblemType => Boolean(id))
    .slice(0, 4)
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : undefined
}

function normalizeDurationLabel(value: unknown): string | undefined {
  const durationMinutes = normalizePositiveInteger(value)
  return durationMinutes ? `${durationMinutes} minutes` : undefined
}

function normalizeConfidenceLevel(value: unknown, confidence: number): QuickConsultConfidenceLevel {
  if (confidence < 0.55) return 'low'
  if (value === 'low' || value === 'medium' || value === 'high') return value
  if (confidence < 0.75) return 'medium'
  return 'high'
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0

  return Math.min(Math.max(Number(value.toFixed(2)), 0), 1)
}

function normalizeNonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeRequiredText(value: unknown): string {
  const normalized = normalizeNonEmptyText(value)
  if (!normalized) {
    throw new Error(QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE)
  }

  return normalized
}

function normalizeRecommendationFeedbackRating(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
    throw new Error(QUICK_CONSULT_FEEDBACK_REQUIRED_RATING_MESSAGE)
  }

  return value as number
}

function normalizeRecommendationFeedbackText(value: unknown): string | undefined {
  const normalized = normalizeNonEmptyText(value)
  if (!normalized) return undefined
  if (normalized.length > QUICK_CONSULT_FEEDBACK_MAX_LENGTH) {
    throw new Error(QUICK_CONSULT_FEEDBACK_TOO_LONG_MESSAGE)
  }

  return normalized
}

function normalizeRecommendationIds(value: unknown): string[] {
  const seen = new Set<string>()

  return (Array.isArray(value) ? value : [])
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, 10)
}

function isValidRecommendationFeedbackResult(
  value: QuickConsultRecommendationFeedbackResult | null
): value is QuickConsultRecommendationFeedbackResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    value.id.trim() &&
    Number.isInteger(value.rating) &&
    value.rating >= 1 &&
    value.rating <= 5
  )
}

function readClarificationQuestions(result: QuickConsultStartResult): string[] {
  const questions = Array.isArray(result.clarificationQuestions)
    ? result.clarificationQuestions
    : Array.isArray(result.questions)
      ? result.questions
      : []

  return questions
    .filter((question) => typeof question === 'string' && question.trim())
    .map((question) => question.trim())
    .slice(0, 2)
}

function normalizeClarificationAnswers(
  answers?: QuickConsultClarificationAnswer[]
): QuickConsultClarificationAnswer[] {
  return (Array.isArray(answers) ? answers : [])
    .filter((answer) => answer && typeof answer === 'object')
    .map((answer) => ({
      question: typeof answer.question === 'string' ? answer.question.trim() : '',
      answer: typeof answer.answer === 'string' ? answer.answer.trim() : '',
    }))
    .filter((answer) => answer.question && answer.answer)
    .slice(0, 2)
}
