export type ThinkTankProviderType = 'fake' | 'glm'
export type ThinkTankProviderMessageRole = 'user' | 'assistant'
export type ThinkTankProviderStatus = 'completed'
export type ThinkTankProviderFailureStatus = 'failed' | 'timeout'
export type ThinkTankProviderErrorCategory = 'provider' | 'timeout' | 'validation' | 'unknown'

export interface ThinkTankProviderMessage {
  role: ThinkTankProviderMessageRole
  content: string
}

export interface ThinkTankProviderRequest {
  tenantId: string
  actorId: string
  correlationId?: string
  subjectId?: string
  provider?: ThinkTankProviderType
  model?: string
  system?: string
  messages: ThinkTankProviderMessage[]
  maxTokens?: number
  temperature?: number
  metadata?: Record<string, unknown>
  stream?: boolean
}

export interface ThinkTankProviderUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ThinkTankProviderResponse {
  id: string
  provider: ThinkTankProviderType
  model: string
  content: string
  status: ThinkTankProviderStatus
  latencyMs: number
  usage: ThinkTankProviderUsage
  estimatedCost: number
  finishReason?: string
  metadata?: Record<string, unknown>
}

export interface ThinkTankProviderStreamChunk {
  index: number
  delta: string
  done: boolean
  id?: string
  provider?: ThinkTankProviderType
  model?: string
  usage?: ThinkTankProviderUsage
  estimatedCost?: number
  latencyMs?: number
  finishReason?: string
}

export interface ThinkTankProviderErrorShape {
  code: string
  category: ThinkTankProviderErrorCategory
  provider: ThinkTankProviderType
  status: ThinkTankProviderFailureStatus
  retryable: boolean
  message: string
}

export class ThinkTankProviderGatewayError extends Error implements ThinkTankProviderErrorShape {
  readonly code: string
  readonly category: ThinkTankProviderErrorCategory
  readonly provider: ThinkTankProviderType
  readonly status: ThinkTankProviderFailureStatus
  readonly retryable: boolean

  constructor(shape: ThinkTankProviderErrorShape, options?: { cause?: unknown }) {
    super(shape.message)
    this.name = 'ThinkTankProviderGatewayError'
    this.code = shape.code
    this.category = shape.category
    this.provider = shape.provider
    this.status = shape.status
    this.retryable = shape.retryable

    if (options && 'cause' in options) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }

  toJSON(): ThinkTankProviderErrorShape {
    return {
      code: this.code,
      category: this.category,
      provider: this.provider,
      status: this.status,
      retryable: this.retryable,
      message: this.message,
    }
  }
}

export interface ThinkTankProviderAdapter {
  readonly provider: ThinkTankProviderType
  complete(
    request: ThinkTankProviderRequest,
    signal?: AbortSignal,
  ): Promise<ThinkTankProviderResponse>
  stream?(
    request: ThinkTankProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ThinkTankProviderStreamChunk>
}

export type ThinkTankProviderSleeper = (delayMs: number) => Promise<void>

export interface ThinkTankProviderRetryOptions {
  maxAttempts: number
  delayMs: number
  backoffMultiplier?: number
  sleeper?: ThinkTankProviderSleeper
}

export interface ThinkTankProviderGatewayDependencies {
  providers: ThinkTankProviderAdapter[]
  eventService: {
    emitTelemetry(input: unknown): Promise<void>
  }
  defaultProvider?: ThinkTankProviderType
  defaultModel?: string
  timeoutMs?: number
  retry?: ThinkTankProviderRetryOptions
}
