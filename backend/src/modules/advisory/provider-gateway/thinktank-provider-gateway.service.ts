import { randomUUID } from 'node:crypto'
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL,
  THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL,
  THINKTANK_PROVIDER_GATEWAY_ADAPTERS,
  THINKTANK_PROVIDER_GATEWAY_CONFIG,
  ThinkTankProviderGatewayConfig,
} from './thinktank-provider-gateway.config'
import {
  ThinkTankProviderAdapter,
  ThinkTankProviderGatewayDependencies,
  ThinkTankProviderGatewayError,
  ThinkTankProviderRequest,
  ThinkTankProviderResponse,
  ThinkTankProviderRetryOptions,
  ThinkTankProviderStreamChunk,
  ThinkTankProviderType,
} from './thinktank-provider-gateway.types'

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_RETRY: ThinkTankProviderRetryOptions = {
  maxAttempts: 2,
  delayMs: 100,
  backoffMultiplier: 2,
}

@Injectable()
export class ThinkTankProviderGatewayService {
  private readonly logger = new Logger(ThinkTankProviderGatewayService.name)
  private readonly adapters: Map<ThinkTankProviderType, ThinkTankProviderAdapter>
  private readonly eventService: AdvisoryEventService
  private readonly defaultProvider: ThinkTankProviderType
  private readonly defaultModel: string
  private readonly timeoutMs: number
  private readonly retry: ThinkTankProviderRetryOptions

  constructor(
    @Optional()
    @Inject(THINKTANK_PROVIDER_GATEWAY_ADAPTERS)
    adaptersOrDependencies: ThinkTankProviderAdapter[] | ThinkTankProviderGatewayDependencies,
    @Optional() eventService?: AdvisoryEventService,
    @Optional()
    @Inject(THINKTANK_PROVIDER_GATEWAY_CONFIG)
    config?: ThinkTankProviderGatewayConfig,
  ) {
    const dependencies: ThinkTankProviderGatewayDependencies = Array.isArray(adaptersOrDependencies)
      ? {
          providers: adaptersOrDependencies,
          eventService: requireEventService(eventService),
          defaultProvider: config?.providerMode,
          defaultModel:
            config?.providerMode === 'fake' ? THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL : config?.model,
          timeoutMs: config?.timeoutMs,
          retry: config?.retry,
        }
      : adaptersOrDependencies

    this.adapters = new Map(
      dependencies.providers.map((adapter) => [adapter.provider, adapter] as const),
    )
    this.eventService = dependencies.eventService as AdvisoryEventService
    this.defaultProvider = dependencies.defaultProvider ?? 'fake'
    this.defaultModel =
      dependencies.defaultModel ??
      (this.defaultProvider === 'fake'
        ? THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL
        : THINKTANK_PROVIDER_GATEWAY_DEFAULT_MODEL)
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.retry = {
      ...DEFAULT_RETRY,
      ...dependencies.retry,
      sleeper: dependencies.retry?.sleeper ?? sleep,
    }
  }

  async complete(
    input: ThinkTankProviderRequest,
    signal?: AbortSignal,
  ): Promise<ThinkTankProviderResponse> {
    const context = this.buildCallContext(input)
    const startedAt = Date.now()

    try {
      this.validateRequest(context.request)
    } catch (error) {
      const normalized = this.normalizeError(error, context.provider)
      await this.emitFailedTelemetry(context, normalized, Date.now() - startedAt)
      throw normalized
    }

    let lastError: ThinkTankProviderGatewayError | null = null
    const maxAttempts = Math.max(1, this.retry.maxAttempts)

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = Date.now()
      let cleanupAbortListener = () => undefined

      try {
        const { abortController, cleanup } = this.createAbortController(signal)
        cleanupAbortListener = cleanup
        this.throwIfAborted(context.provider, signal)
        const response = await this.withTimeout(
          context.adapter.complete(context.request, abortController.signal),
          context.provider,
          abortController,
        )
        const completedResponse = {
          ...response,
          provider: context.provider,
          model: response.model || context.request.model || this.defaultModel,
          status: 'completed' as const,
          latencyMs: Date.now() - attemptStartedAt,
        }

        await this.emitCompletedTelemetry(context, completedResponse)
        return completedResponse
      } catch (error) {
        const normalized = this.normalizeError(error, context.provider)
        lastError = normalized
        const latencyMs = Date.now() - attemptStartedAt

        if (normalized.retryable && attempt < maxAttempts) {
          await this.emitRetriedTelemetry(context, normalized, attempt, maxAttempts, latencyMs)
          await this.retry.sleeper?.(this.retryDelay(attempt))
          continue
        }

        await this.emitFailedTelemetry(context, normalized, latencyMs)
        throw normalized
      } finally {
        cleanupAbortListener()
      }
    }

    const fallbackError =
      lastError ??
      new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_UNKNOWN_FAILURE',
        category: 'unknown',
        provider: context.provider,
        status: 'failed',
        retryable: false,
        message: 'Provider call failed',
      })
    await this.emitFailedTelemetry(context, fallbackError, Date.now() - startedAt)
    throw fallbackError
  }

  async *stream(
    input: ThinkTankProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ThinkTankProviderStreamChunk> {
    const context = this.buildCallContext({ ...input, stream: true })
    const startedAt = Date.now()

    try {
      this.validateRequest(context.request)
    } catch (error) {
      const normalized = this.normalizeError(error, context.provider)
      await this.emitFailedTelemetry(context, normalized, Date.now() - startedAt)
      throw normalized
    }

    if (!context.adapter.stream) {
      const response = await this.complete(context.request, signal)
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
      return
    }

    let lastError: ThinkTankProviderGatewayError | null = null
    const maxAttempts = Math.max(1, this.retry.maxAttempts)

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = Date.now()
      const { abortController, cleanup } = this.createAbortController(signal)
      let yieldedAnyChunk = false
      let index = 0
      let content = ''
      let usage: ThinkTankProviderResponse['usage'] | null = null
      let estimatedCost = 0
      let finishReason: string | undefined
      let model = context.request.model ?? this.defaultModel

      try {
        this.throwIfAborted(context.provider, signal)
        const iterator = context.adapter
          .stream(context.request, abortController.signal)
          [Symbol.asyncIterator]()

        while (true) {
          this.throwIfAborted(context.provider, signal)
          const next = await this.withTimeout(iterator.next(), context.provider, abortController)
          this.throwIfAborted(context.provider, signal)
          if (next.done) break

          const chunk = next.value
          yieldedAnyChunk = true
          content += chunk.delta
          usage = chunk.usage ?? usage
          estimatedCost = chunk.estimatedCost ?? estimatedCost
          finishReason = chunk.finishReason ?? finishReason
          model = chunk.model ?? model
          yield {
            ...chunk,
            index: chunk.index ?? index,
          }
          index += 1
        }

        const estimatedOutputTokens = estimateTokens(content)
        await this.emitCompletedTelemetry(context, {
          id: context.subjectId,
          provider: context.provider,
          model,
          content,
          status: 'completed',
          latencyMs: Date.now() - attemptStartedAt,
          usage: usage ?? {
            inputTokens: 0,
            outputTokens: estimatedOutputTokens,
            totalTokens: estimatedOutputTokens,
          },
          estimatedCost,
          finishReason: finishReason ?? 'stop',
        })
        return
      } catch (error) {
        abortController.abort()
        const normalized = this.normalizeError(error, context.provider)
        lastError = normalized
        const latencyMs = Date.now() - attemptStartedAt

        if (normalized.retryable && !yieldedAnyChunk && attempt < maxAttempts) {
          await this.emitRetriedTelemetry(context, normalized, attempt, maxAttempts, latencyMs)
          await this.retry.sleeper?.(this.retryDelay(attempt))
          continue
        }

        await this.emitFailedTelemetry(context, normalized, latencyMs)
        throw normalized
      } finally {
        cleanup()
      }
    }

    const fallbackError =
      lastError ??
      new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_UNKNOWN_FAILURE',
        category: 'unknown',
        provider: context.provider,
        status: 'failed',
        retryable: false,
        message: 'Provider stream failed',
      })
    await this.emitFailedTelemetry(context, fallbackError, Date.now() - startedAt)
    throw fallbackError
  }

  private buildCallContext(input: ThinkTankProviderRequest) {
    const provider = input.provider ?? this.defaultProvider
    const adapter = this.adapters.get(provider)

    if (!adapter) {
      throw new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_NOT_AVAILABLE',
        category: 'provider',
        provider,
        status: 'failed',
        retryable: false,
        message: `ThinkTank provider is not available: ${provider}`,
      })
    }

    const subjectId = input.subjectId?.trim() || randomUUID()
    const correlationId = input.correlationId?.trim() || randomUUID()

    return {
      provider,
      adapter,
      subjectId,
      correlationId,
      request: {
        ...input,
        provider,
        model: input.model ?? this.defaultModel,
        subjectId,
        correlationId,
      },
    }
  }

  private validateRequest(request: ThinkTankProviderRequest): void {
    const provider = request.provider ?? this.defaultProvider
    requireText(request.tenantId, 'tenantId', provider)
    requireText(request.actorId, 'actorId', provider)
    requireText(request.model, 'model', provider)

    if (
      request.maxTokens !== undefined &&
      (!Number.isInteger(request.maxTokens) || request.maxTokens <= 0)
    ) {
      throwInvalidRequest(provider, 'Provider request maxTokens must be a positive integer')
    }

    if (
      request.temperature !== undefined &&
      (typeof request.temperature !== 'number' ||
        !Number.isFinite(request.temperature) ||
        request.temperature < 0 ||
        request.temperature > 1)
    ) {
      throwInvalidRequest(provider, 'Provider request temperature must be between 0 and 1')
    }

    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_INVALID_REQUEST',
        category: 'validation',
        provider,
        status: 'failed',
        retryable: false,
        message: 'Provider request requires at least one message',
      })
    }

    for (const message of request.messages) {
      if (message.role !== 'user' && message.role !== 'assistant') {
        throw new ThinkTankProviderGatewayError({
          code: 'THINKTANK_PROVIDER_INVALID_REQUEST',
          category: 'validation',
          provider,
          status: 'failed',
          retryable: false,
          message: `Unsupported provider message role: ${String(message.role)}`,
        })
      }
      requireText(message.content, 'message.content', provider)
    }
  }

  private createAbortController(signal?: AbortSignal): {
    abortController: AbortController
    cleanup: () => void
  } {
    const abortController = new AbortController()

    if (!signal) {
      return { abortController, cleanup: () => undefined }
    }

    const abort = () => abortController.abort()
    if (signal.aborted) {
      abortController.abort()
      return { abortController, cleanup: () => undefined }
    }

    signal.addEventListener('abort', abort, { once: true })

    return {
      abortController,
      cleanup: () => signal.removeEventListener('abort', abort),
    }
  }

  private throwIfAborted(provider: ThinkTankProviderType, signal?: AbortSignal): void {
    if (!signal?.aborted) return

    throw new ThinkTankProviderGatewayError({
      code: 'THINKTANK_PROVIDER_ABORTED',
      category: 'provider',
      provider,
      status: 'failed',
      retryable: false,
      message: 'Provider stream was aborted',
    })
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    provider: ThinkTankProviderType,
    abortController?: AbortController,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abortController?.abort()
        reject(
          new ThinkTankProviderGatewayError({
            code: 'THINKTANK_PROVIDER_TIMEOUT',
            category: 'timeout',
            provider,
            status: 'timeout',
            retryable: true,
            message: 'Provider call timed out',
          }),
        )
      }, this.timeoutMs)
    })

    try {
      return await Promise.race([promise, timeout])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  private normalizeError(
    error: unknown,
    provider: ThinkTankProviderType,
  ): ThinkTankProviderGatewayError {
    if (error instanceof ThinkTankProviderGatewayError) {
      return error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return new ThinkTankProviderGatewayError(
        {
          code: 'THINKTANK_PROVIDER_ABORTED',
          category: 'provider',
          provider,
          status: 'failed',
          retryable: false,
          message: 'Provider stream was aborted',
        },
        { cause: error },
      )
    }

    const message = error instanceof Error ? error.message : 'Provider call failed'
    const status = readNumber(error, 'status') ?? readNumber(error, 'statusCode')
    const retryable = status === 408 || status === 429 || (status !== undefined && status >= 500)

    return new ThinkTankProviderGatewayError(
      {
        code: status ? `THINKTANK_PROVIDER_${status}` : 'THINKTANK_PROVIDER_ERROR',
        category: 'provider',
        provider,
        status: 'failed',
        retryable,
        message,
      },
      { cause: error },
    )
  }

  private async emitCompletedTelemetry(
    context: ReturnType<ThinkTankProviderGatewayService['buildCallContext']>,
    response: ThinkTankProviderResponse,
  ): Promise<void> {
    await this.emitTelemetryBestEffort({
      eventName: ThinkTankEventName.ProviderCallCompleted,
      tenantId: context.request.tenantId,
      actorId: context.request.actorId,
      subjectType: ThinkTankSubjectType.ProviderCall,
      subjectId: context.subjectId,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId: context.correlationId,
      optional: {
        provider: response.provider,
        latencyMs: response.latencyMs,
        estimatedTokens: response.usage.totalTokens,
        estimatedCost: response.estimatedCost,
      },
      metadata: {
        status: response.status,
        model: response.model,
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        finish_reason: response.finishReason,
      },
    })
  }

  private async emitRetriedTelemetry(
    context: ReturnType<ThinkTankProviderGatewayService['buildCallContext']>,
    error: ThinkTankProviderGatewayError,
    attempt: number,
    maxAttempts: number,
    latencyMs: number,
  ): Promise<void> {
    await this.emitTelemetryBestEffort({
      eventName: ThinkTankEventName.ProviderCallRetried,
      tenantId: context.request.tenantId,
      actorId: context.request.actorId,
      subjectType: ThinkTankSubjectType.ProviderCall,
      subjectId: context.subjectId,
      outcome: ThinkTankEventOutcome.Failure,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId: context.correlationId,
      optional: {
        provider: error.provider,
        latencyMs,
        estimatedTokens: 0,
        estimatedCost: 0,
        errorCategory: error.category,
      },
      metadata: {
        retry_attempt: attempt,
        max_attempts: maxAttempts,
        status: error.status,
        retryable: error.retryable,
        error_code: error.code,
      },
    })
  }

  private async emitFailedTelemetry(
    context: ReturnType<ThinkTankProviderGatewayService['buildCallContext']>,
    error: ThinkTankProviderGatewayError,
    latencyMs: number,
  ): Promise<void> {
    await this.emitTelemetryBestEffort({
      eventName: ThinkTankEventName.ProviderCallFailed,
      tenantId: context.request.tenantId,
      actorId: context.request.actorId,
      subjectType: ThinkTankSubjectType.ProviderCall,
      subjectId: context.subjectId,
      outcome: ThinkTankEventOutcome.Failure,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      correlationId: context.correlationId,
      optional: {
        provider: error.provider,
        latencyMs,
        estimatedTokens: 0,
        estimatedCost: 0,
        errorCategory: error.category,
      },
      metadata: {
        status: error.status,
        retryable: error.retryable,
        error_code: error.code,
      },
    })
  }

  private async emitTelemetryBestEffort(
    input: Parameters<AdvisoryEventService['emitTelemetry']>[0],
  ): Promise<void> {
    try {
      await this.eventService.emitTelemetry(input)
    } catch (error) {
      this.logger.error('Failed to emit ThinkTank provider telemetry', error)
    }
  }

  private retryDelay(attempt: number): number {
    const multiplier = this.retry.backoffMultiplier ?? DEFAULT_RETRY.backoffMultiplier
    return Math.max(0, this.retry.delayMs) * Math.pow(multiplier, Math.max(0, attempt - 1))
  }
}

function requireText(
  value: string | undefined,
  fieldName: string,
  provider: ThinkTankProviderType,
): void {
  if (typeof value !== 'string' || !value.trim()) {
    throwInvalidRequest(provider, `ThinkTank provider request requires ${fieldName}`)
  }
}

function throwInvalidRequest(provider: ThinkTankProviderType, message: string): never {
  throw new ThinkTankProviderGatewayError({
    code: 'THINKTANK_PROVIDER_INVALID_REQUEST',
    category: 'validation',
    provider,
    status: 'failed',
    retryable: false,
    message,
  })
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'number' ? candidate : undefined
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function estimateTokens(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

function requireEventService(eventService: AdvisoryEventService | undefined): AdvisoryEventService {
  if (!eventService) {
    throw new Error('AdvisoryEventService is required for ThinkTankProviderGatewayService')
  }
  return eventService
}
