import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AdvisoryWorkflowSessionCurrentStep } from '../../../database/entities/advisory-workflow-session.entity'
import { ThinkTankProviderMessage } from '../provider-gateway/thinktank-provider-gateway.types'

export const THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS =
  'THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS'
export const DEFAULT_THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS = 12000

export type ThinkTankContextCompressionDecision = 'defer' | 'execute'
export type ThinkTankContextCompressionReason = 'below_threshold' | 'threshold_reached'

export interface ThinkTankContextCompressionInput {
  tenantId: string
  actorId: string
  sessionId: string
  workflowKey: string
  currentStep: AdvisoryWorkflowSessionCurrentStep
  system: string
  messages: ThinkTankContextCompressionMessage[]
  documentSummary?: string | null
}

export interface ThinkTankContextCompressionMessage extends ThinkTankProviderMessage {
  tenantId?: string
  actorId?: string
  sessionId?: string
}

export interface ThinkTankContextCompressionMetadata {
  policyDecision: ThinkTankContextCompressionDecision
  reason: ThinkTankContextCompressionReason
  estimatedTokens: number
  thresholdTokens: number
  compressedEstimatedTokens: number | null
  summaryPresent: boolean
  summaryLength: number
  originalMessageCount: number
  providerMessageCount: number
}

export interface ThinkTankContextCompressionResult {
  decision: ThinkTankContextCompressionDecision
  reason: ThinkTankContextCompressionReason
  estimatedTokens: number
  thresholdTokens: number
  summary: string | null
  providerMessages: ThinkTankProviderMessage[]
  metadata: ThinkTankContextCompressionMetadata
  checkpointMetadata: Record<string, unknown>
}

interface ExtractedCompressionContext {
  summary: string
  importantDecisions: string[]
  openQuestions: string[]
}

@Injectable()
export class ThinkTankContextCompressionService {
  constructor(private readonly configService: ConfigService) {}

  getThresholdTokens(): number {
    const configured = this.configService.get<string | number | undefined>(
      THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
    )
    const parsed =
      typeof configured === 'number'
        ? configured
        : typeof configured === 'string'
          ? Number(configured)
          : Number.NaN

    return Number.isInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS
  }

  evaluate(input: ThinkTankContextCompressionInput): ThinkTankContextCompressionResult {
    const scopedMessages = this.toScopedProviderMessages(input)
    const estimatedTokens = estimateThinkTankContextTokens({
      system: input.system,
      messages: scopedMessages,
    })
    const thresholdTokens = this.getThresholdTokens()

    if (estimatedTokens < thresholdTokens) {
      return {
        decision: 'defer',
        reason: 'below_threshold',
        estimatedTokens,
        thresholdTokens,
        summary: null,
        providerMessages: scopedMessages,
        metadata: {
          policyDecision: 'defer',
          reason: 'below_threshold',
          estimatedTokens,
          thresholdTokens,
          compressedEstimatedTokens: null,
          summaryPresent: false,
          summaryLength: 0,
          originalMessageCount: scopedMessages.length,
          providerMessageCount: scopedMessages.length,
        },
        checkpointMetadata: {},
      }
    }

    const compressed = this.createCompressedContext(input, scopedMessages)
    const currentMessage = scopedMessages.at(-1)
    const providerMessages: ThinkTankProviderMessage[] = [
      {
        role: 'user',
        content: [
          '已压缩的历史上下文：',
          compressed.summary,
          '',
          '请基于以上压缩上下文继续处理当前用户请求。',
        ].join('\n'),
      },
      ...(currentMessage ? [currentMessage] : []),
    ]
    const compressedEstimatedTokens = estimateThinkTankContextTokens({
      system: input.system,
      messages: providerMessages,
    })

    return {
      decision: 'execute',
      reason: 'threshold_reached',
      estimatedTokens,
      thresholdTokens,
      summary: compressed.summary,
      providerMessages,
      metadata: {
        policyDecision: 'execute',
        reason: 'threshold_reached',
        estimatedTokens,
        thresholdTokens,
        compressedEstimatedTokens,
        summaryPresent: true,
        summaryLength: compressed.summary.length,
        originalMessageCount: scopedMessages.length,
        providerMessageCount: providerMessages.length,
      },
      checkpointMetadata: {
        context_compression: {
          decision: 'execute',
          reason: 'threshold_reached',
          estimated_tokens: estimatedTokens,
          threshold_tokens: thresholdTokens,
          summary: compressed.summary,
          important_decisions: compressed.importantDecisions,
          open_questions: compressed.openQuestions,
        },
      },
    }
  }

  private createCompressedContext(
    input: ThinkTankContextCompressionInput,
    messages: ThinkTankProviderMessage[],
  ): ExtractedCompressionContext {
    const historicalMessages = messages.slice(0, -1)
    const importantDecisions = this.extractImportantDecisions(historicalMessages)
    const openQuestions = this.extractOpenQuestions(historicalMessages)
    const documentSummary = normalizeSummaryText(input.documentSummary)
    const lines = [
      `工作流：${input.workflowKey}`,
      `当前步骤：${input.currentStep.label}`,
      `消息数：${messages.length}`,
      ...(documentSummary ? [`报告摘要：${documentSummary}`] : []),
      ...(importantDecisions.length > 0 ? [`关键决策：${importantDecisions.join('；')}`] : []),
      ...(openQuestions.length > 0 ? [`开放问题：${openQuestions.join('；')}`] : []),
    ]
    const summary = lines.join('\n').slice(0, 4000)

    return {
      summary,
      importantDecisions,
      openQuestions,
    }
  }

  private toScopedProviderMessages(
    input: ThinkTankContextCompressionInput,
  ): ThinkTankProviderMessage[] {
    return input.messages
      .filter((message) => this.isMessageInScope(input, message))
      .map((message) => ({
        role: message.role,
        content: message.content,
      }))
  }

  private isMessageInScope(
    input: ThinkTankContextCompressionInput,
    message: ThinkTankContextCompressionMessage,
  ): boolean {
    const hasScope =
      message.tenantId !== undefined ||
      message.actorId !== undefined ||
      message.sessionId !== undefined

    if (!hasScope) return true

    return (
      message.tenantId === input.tenantId &&
      message.actorId === input.actorId &&
      message.sessionId === input.sessionId
    )
  }

  private extractImportantDecisions(messages: ThinkTankProviderMessage[]): string[] {
    const markerPattern =
      /^(?:key conclusion|decision|recommendation|重要结论|关键结论|关键决策|决策|结论|建议)\s*[:：]\s*/i
    const decisions = messages
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => splitCandidateSentences(message.content))
      .map((sentence) => {
        const match = sentence.match(markerPattern)
        return match ? sentence.replace(markerPattern, '').trim() : null
      })
      .filter((value): value is string => Boolean(value))
      .map((value) => value.slice(0, 260))

    if (decisions.length > 0) return uniqueLimited(decisions, 5)

    return uniqueLimited(
      messages
        .filter((message) => message.role === 'assistant')
        .map((message) => splitCandidateSentences(message.content)[0])
        .filter((value): value is string => Boolean(value))
        .map((value) => value.replace(markerPattern, '').trim().slice(0, 260)),
      3,
    )
  }

  private extractOpenQuestions(messages: ThinkTankProviderMessage[]): string[] {
    const markerPattern = /^(?:open question|question|待确认|开放问题|问题)\s*[:：]\s*/i

    return uniqueLimited(
      messages
        .flatMap((message) => splitCandidateSentences(message.content))
        .filter((sentence) => markerPattern.test(sentence) || /[?？]$/.test(sentence.trim()))
        .map((sentence) => sentence.replace(markerPattern, '').trim().slice(0, 240))
        .filter((value): value is string => Boolean(value)),
      5,
    )
  }
}

export function estimateThinkTankContextTokens(
  value: string | { system?: string; messages?: ThinkTankProviderMessage[] },
): number {
  if (typeof value === 'string') {
    return estimateTextTokens(value)
  }

  return (
    estimateTextTokens(value.system ?? '') +
    (value.messages ?? []).reduce(
      (total, message) => total + estimateTextTokens(message.content),
      0,
    )
  )
}

function estimateTextTokens(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0

  const whitespaceTokens = trimmed.split(/\s+/).length
  const compactEstimate = Math.ceil(trimmed.length / 4)
  return Math.max(whitespaceTokens, compactEstimate)
}

function normalizeSummaryText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 500) : null
}

function splitCandidateSentences(value: string): string[] {
  return value
    .split(/\n+|(?<=[。.!?？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function uniqueLimited(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
    if (result.length >= limit) break
  }

  return result
}
