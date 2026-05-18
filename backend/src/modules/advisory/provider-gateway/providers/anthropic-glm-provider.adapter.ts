import Anthropic from '@anthropic-ai/sdk'
import { ThinkTankProviderGatewayConfig } from '../thinktank-provider-gateway.config'
import {
  ThinkTankProviderAdapter,
  ThinkTankProviderGatewayError,
  ThinkTankProviderRequest,
  ThinkTankProviderResponse,
  ThinkTankProviderStreamChunk,
} from '../thinktank-provider-gateway.types'

export class AnthropicGlmProviderAdapter implements ThinkTankProviderAdapter {
  readonly provider = 'glm' as const
  private readonly client: Anthropic | null

  constructor(private readonly config: ThinkTankProviderGatewayConfig) {
    this.client = config.apiKey
      ? new Anthropic({
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
          timeout: config.timeoutMs,
          maxRetries: 0,
        })
      : null
  }

  async complete(request: ThinkTankProviderRequest): Promise<ThinkTankProviderResponse> {
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
      const response = await this.client.messages.create({
        model: request.model ?? this.config.model,
        max_tokens: request.maxTokens ?? 2000,
        temperature: request.temperature ?? 0.7,
        system: request.system,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      } as never)
      const normalized = response as {
        id?: string
        model?: string
        content?: Array<{ type?: string; text?: string }>
        stop_reason?: string | null
        usage?: { input_tokens?: number; output_tokens?: number }
      }
      const textContent =
        normalized.content?.find((content) => content.type === 'text')?.text ??
        normalized.content?.[0]?.text ??
        ''
      const inputTokens = normalized.usage?.input_tokens ?? 0
      const outputTokens = normalized.usage?.output_tokens ?? 0

      return {
        id: normalized.id ?? `glm-provider-call-${Date.now()}`,
        provider: 'glm',
        model: normalized.model ?? request.model ?? this.config.model,
        content: textContent,
        status: 'completed',
        latencyMs: 0,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        estimatedCost: estimateGlmCost(inputTokens, outputTokens),
        finishReason: normalized.stop_reason ?? undefined,
      }
    } catch (error) {
      throw normalizeAnthropicGlmError(error)
    }
  }

  async *stream(request: ThinkTankProviderRequest): AsyncIterable<ThinkTankProviderStreamChunk> {
    const response = await this.complete(request)

    yield {
      index: 0,
      delta: response.content,
      done: true,
      id: response.id,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      estimatedCost: response.estimatedCost,
      latencyMs: response.latencyMs,
      finishReason: response.finishReason,
    }
  }
}

function normalizeAnthropicGlmError(error: unknown): ThinkTankProviderGatewayError {
  if (error instanceof ThinkTankProviderGatewayError) {
    return error
  }

  const status = readNumber(error, 'status') ?? readNumber(error, 'statusCode')
  const message = error instanceof Error ? error.message : 'GLM provider call failed'
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

function estimateGlmCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * 0.0005
  const outputCost = (outputTokens / 1000) * 0.0015
  return Number((inputCost + outputCost).toFixed(6))
}
