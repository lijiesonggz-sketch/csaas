import Anthropic from '@anthropic-ai/sdk'
import { ThinkTankProviderGatewayConfig } from '../thinktank-provider-gateway.config'
import {
  ThinkTankProviderAdapter,
  ThinkTankProviderGatewayError,
  ThinkTankProviderRequest,
  ThinkTankProviderResponse,
  ThinkTankProviderUsage,
} from '../thinktank-provider-gateway.types'
import {
  inferThinkTankCacheBypassReason,
  inferThinkTankCacheStatus,
} from '../thinktank-prompt-cache-policy'

export class AnthropicGlmProviderAdapter implements ThinkTankProviderAdapter {
  readonly provider = 'glm' as const
  private readonly client: Anthropic | null

  constructor(private readonly config: ThinkTankProviderGatewayConfig) {
    this.client =
      config.liveProviderEnabled && config.apiKey && config.baseUrl
        ? new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: config.timeoutMs,
            maxRetries: 0,
          })
        : null
  }

  async complete(
    request: ThinkTankProviderRequest,
    signal?: AbortSignal,
  ): Promise<ThinkTankProviderResponse> {
    if (!this.client) {
      throw new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_NOT_CONFIGURED',
        category: 'provider',
        provider: 'glm',
        status: 'failed',
        retryable: false,
        message: 'GLM provider is not configured',
      })
    }

    try {
      const response = await this.client.messages.create(
        {
          model: request.model ?? this.config.model,
          max_tokens: request.maxTokens ?? 2000,
          temperature: request.temperature ?? 0.7,
          system: createGlmSystemPayload(request, this.config),
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        } as never,
        { signal },
      )
      const normalized = response as {
        id?: string
        model?: string
        content?: Array<{ type?: string; text?: string }>
        stop_reason?: string | null
        usage?: {
          input_tokens?: number
          output_tokens?: number
          cache_read_input_tokens?: number
          cache_creation_input_tokens?: number
          prompt_tokens_details?: {
            cached_tokens?: number
          }
        }
      }
      const textContent =
        normalized.content?.find((content) => content.type === 'text')?.text ??
        normalized.content?.[0]?.text ??
        ''
      if (!textContent.trim()) {
        throw new ThinkTankProviderGatewayError({
          code: 'GLM_PROVIDER_EMPTY_RESPONSE',
          category: 'provider',
          provider: 'glm',
          status: 'failed',
          retryable: false,
          message: 'GLM provider returned an empty text response',
        })
      }
      const usage = normalizeGlmUsage(normalized.usage)
      const cacheStrategy = resolveGlmCacheStrategy(request, this.config)
      const cacheStatus = inferThinkTankCacheStatus(cacheStrategy, usage)
      const cacheBypassReason = inferThinkTankCacheBypassReason(
        cacheStrategy,
        cacheStatus,
        cacheStrategy === 'unsupported' ? 'unsupported' : request.promptCache?.bypassReason,
      )

      return {
        id: normalized.id ?? `glm-provider-call-${Date.now()}`,
        provider: 'glm',
        model: normalized.model ?? request.model ?? this.config.model,
        content: textContent,
        status: 'completed',
        latencyMs: 0,
        usage,
        estimatedCost: estimateGlmCost(usage),
        finishReason: normalized.stop_reason ?? undefined,
        ...(cacheStatus ? { cacheStatus } : {}),
        ...(cacheStrategy ? { cacheStrategy } : {}),
        ...(request.promptCache?.cacheKey ? { cacheKey: request.promptCache.cacheKey } : {}),
        ...(cacheBypassReason ? { cacheBypassReason } : {}),
        metadata: {
          cache_source: readCacheSource(normalized.usage),
        },
      }
    } catch (error) {
      throw normalizeAnthropicGlmError(error)
    }
  }
}

function normalizeAnthropicGlmError(error: unknown): ThinkTankProviderGatewayError {
  if (error instanceof ThinkTankProviderGatewayError) {
    return error
  }

  const status = readNumber(error, 'status') ?? readNumber(error, 'statusCode')
  const message = 'GLM provider call failed'
  const retryable = status === 408 || status === 429 || (status !== undefined && status >= 500)

  return new ThinkTankProviderGatewayError(
    {
      code: status ? `GLM_PROVIDER_${status}` : 'GLM_PROVIDER_ERROR',
      category: 'provider',
      provider: 'glm',
      status: 'failed',
      retryable,
      message,
    },
    { cause: error },
  )
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'number' ? candidate : undefined
}

function normalizeGlmUsage(usage?: {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  prompt_tokens_details?: {
    cached_tokens?: number
  }
}): ThinkTankProviderUsage {
  const outputTokens = usage?.output_tokens ?? 0
  const cacheReadInputTokens =
    usage?.cache_read_input_tokens ?? usage?.prompt_tokens_details?.cached_tokens
  const cacheCreationInputTokens = usage?.cache_creation_input_tokens
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens ?? cacheReadInputTokens
  const hasAnthropicCacheFields =
    usage?.cache_read_input_tokens !== undefined || usage?.cache_creation_input_tokens !== undefined
  const inputTokens = hasAnthropicCacheFields
    ? (usage?.input_tokens ?? 0) + (cacheReadInputTokens ?? 0) + (cacheCreationInputTokens ?? 0)
    : (usage?.input_tokens ?? 0)

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    ...(cacheReadInputTokens !== undefined ? { cacheReadInputTokens } : {}),
    ...(cacheCreationInputTokens !== undefined ? { cacheCreationInputTokens } : {}),
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
  }
}

function resolveGlmCacheStrategy(
  request: ThinkTankProviderRequest,
  config: ThinkTankProviderGatewayConfig,
) {
  if (
    request.promptCache?.strategy === 'anthropic-explicit' &&
    !config.anthropicExplicitCacheEnabled
  ) {
    return 'unsupported'
  }

  return request.promptCache?.strategy
}

function createGlmSystemPayload(
  request: ThinkTankProviderRequest,
  config: ThinkTankProviderGatewayConfig,
) {
  if (
    request.promptCache?.strategy !== 'anthropic-explicit' ||
    !config.anthropicExplicitCacheEnabled ||
    !request.system?.trim()
  ) {
    return request.system
  }

  return [
    {
      type: 'text',
      text: request.system,
      cache_control: { type: 'ephemeral' },
    },
  ]
}

function estimateGlmCost(usage: ThinkTankProviderUsage): number {
  const cachedInputTokens = usage.cachedInputTokens ?? usage.cacheReadInputTokens ?? 0
  const cacheCreationInputTokens = usage.cacheCreationInputTokens ?? 0
  const cacheReadInputTokens = usage.cacheReadInputTokens ?? cachedInputTokens
  const regularInputTokens = Math.max(
    0,
    usage.inputTokens - cacheReadInputTokens - cacheCreationInputTokens,
  )
  const inputCost = (regularInputTokens / 1000) * 0.0005
  const cacheReadCost = (cacheReadInputTokens / 1000) * 0.00005
  const cacheCreationCost = (cacheCreationInputTokens / 1000) * 0.000625
  const outputCost = (usage.outputTokens / 1000) * 0.0015

  return Number((inputCost + cacheReadCost + cacheCreationCost + outputCost).toFixed(6))
}

function readCacheSource(usage?: {
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  prompt_tokens_details?: {
    cached_tokens?: number
  }
}): string | undefined {
  if (
    usage?.cache_read_input_tokens !== undefined ||
    usage?.cache_creation_input_tokens !== undefined
  ) {
    return 'anthropic_usage'
  }
  if (usage?.prompt_tokens_details?.cached_tokens !== undefined) {
    return 'zai_prompt_tokens_details'
  }

  return undefined
}
