import {
  ThinkTankProviderAdapter,
  ThinkTankProviderGatewayError,
  ThinkTankProviderRequest,
  ThinkTankProviderResponse,
  ThinkTankProviderStreamChunk,
  ThinkTankPromptCacheBypassReason,
  ThinkTankPromptCacheStatus,
} from '../thinktank-provider-gateway.types'
import { THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL } from '../thinktank-provider-gateway.config'

export type FakeThinkTankProviderScriptStep =
  | 'success'
  | 'retryable_failure'
  | 'failure'
  | 'timeout'

export interface FakeThinkTankProviderAdapterOptions {
  script?: FakeThinkTankProviderScriptStep[]
  cacheScript?: ThinkTankPromptCacheStatus[]
  usage?: Partial<ThinkTankProviderResponse['usage']>
  streamUsage?: Partial<ThinkTankProviderResponse['usage']>
  estimatedCost?: number
  cacheBypassReason?: ThinkTankPromptCacheBypassReason
}

const DEFAULT_USAGE = {
  inputTokens: 12,
  outputTokens: 7,
  totalTokens: 19,
}

const DEFAULT_STREAM_CHUNKS: ThinkTankProviderStreamChunk[] = [
  { index: 0, delta: 'ThinkTank ', done: false },
  { index: 1, delta: 'fake provider ', done: false },
  {
    index: 2,
    delta: 'stream.',
    done: true,
    id: 'fake-provider-stream-0001',
    provider: 'fake',
    model: THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL,
    usage: { ...DEFAULT_USAGE },
    estimatedCost: 0,
    latencyMs: 0,
    finishReason: 'stop',
  },
]

export class FakeThinkTankProviderAdapter implements ThinkTankProviderAdapter {
  readonly provider = 'fake' as const
  private readonly script: FakeThinkTankProviderScriptStep[]
  private readonly cacheScript: ThinkTankPromptCacheStatus[]
  private readonly usage: ThinkTankProviderResponse['usage']
  private readonly streamUsage: ThinkTankProviderResponse['usage']
  private readonly estimatedCost: number
  private readonly cacheBypassReason?: ThinkTankPromptCacheBypassReason
  private scriptIndex = 0
  private cacheScriptIndex = 0

  constructor(options: FakeThinkTankProviderAdapterOptions = {}) {
    this.script = options.script?.length ? [...options.script] : ['success']
    this.cacheScript = options.cacheScript?.length ? [...options.cacheScript] : []
    this.usage = { ...DEFAULT_USAGE, ...options.usage }
    this.streamUsage = { ...DEFAULT_USAGE, ...options.streamUsage }
    this.estimatedCost = options.estimatedCost ?? 0
    this.cacheBypassReason = options.cacheBypassReason
  }

  async complete(request?: ThinkTankProviderRequest): Promise<ThinkTankProviderResponse> {
    const step = this.nextStep()

    if (step === 'retryable_failure') {
      throw new ThinkTankProviderGatewayError({
        code: 'FAKE_RATE_LIMIT',
        category: 'provider',
        provider: 'fake',
        status: 'failed',
        retryable: true,
        message: 'Fake provider retryable failure',
      })
    }

    if (step === 'failure') {
      throw new ThinkTankProviderGatewayError({
        code: 'FAKE_PROVIDER_FAILURE',
        category: 'provider',
        provider: 'fake',
        status: 'failed',
        retryable: false,
        message: 'Fake provider scripted failure',
      })
    }

    if (step === 'timeout') {
      throw new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_TIMEOUT',
        category: 'timeout',
        provider: 'fake',
        status: 'timeout',
        retryable: true,
        message: 'Provider call timed out',
      })
    }

    return {
      id: 'fake-provider-call-0001',
      provider: 'fake',
      model: THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL,
      content: 'ThinkTank fake provider smoke response.',
      status: 'completed',
      latencyMs: 0,
      usage: { ...this.usage },
      estimatedCost: this.estimatedCost,
      finishReason: 'stop',
      metadata: {
        deterministic: true,
      },
      ...this.nextCacheMetadata(request),
    }
  }

  async *stream(request?: ThinkTankProviderRequest): AsyncIterable<ThinkTankProviderStreamChunk> {
    const step = this.nextStep()

    if (step === 'retryable_failure') {
      throw new ThinkTankProviderGatewayError({
        code: 'FAKE_RATE_LIMIT',
        category: 'provider',
        provider: 'fake',
        status: 'failed',
        retryable: true,
        message: 'Fake provider retryable failure',
      })
    }

    if (step === 'failure') {
      throw new ThinkTankProviderGatewayError({
        code: 'FAKE_PROVIDER_FAILURE',
        category: 'provider',
        provider: 'fake',
        status: 'failed',
        retryable: false,
        message: 'Fake provider scripted failure',
      })
    }

    if (step === 'timeout') {
      throw new ThinkTankProviderGatewayError({
        code: 'THINKTANK_PROVIDER_TIMEOUT',
        category: 'timeout',
        provider: 'fake',
        status: 'timeout',
        retryable: true,
        message: 'Provider call timed out',
      })
    }

    const cacheMetadata = this.nextCacheMetadata(request)

    for (const chunk of DEFAULT_STREAM_CHUNKS) {
      if (chunk.done) {
        yield {
          ...chunk,
          usage: { ...this.streamUsage },
          estimatedCost: this.estimatedCost,
          ...cacheMetadata,
        }
        continue
      }
      yield { ...chunk }
    }
  }

  private nextStep(): FakeThinkTankProviderScriptStep {
    const step = this.script[Math.min(this.scriptIndex, this.script.length - 1)]
    this.scriptIndex += 1
    return step
  }

  private nextCacheMetadata(request?: ThinkTankProviderRequest) {
    const scriptedStatus = this.cacheScript.length
      ? this.cacheScript[Math.min(this.cacheScriptIndex, this.cacheScript.length - 1)]
      : undefined
    if (this.cacheScript.length) {
      this.cacheScriptIndex += 1
    }
    const cacheStatus = scriptedStatus
    const cacheStrategy = request?.promptCache?.strategy
    const cacheKey = request?.promptCache?.cacheKey
    const cacheBypassReason =
      cacheStatus === 'bypass'
        ? (this.cacheBypassReason ?? request?.promptCache?.bypassReason)
        : undefined

    if (!cacheStatus && !cacheStrategy && !cacheKey) return {}

    return {
      ...(cacheStatus ? { cacheStatus } : {}),
      ...(cacheStrategy ? { cacheStrategy } : {}),
      ...(cacheKey ? { cacheKey } : {}),
      ...(cacheBypassReason ? { cacheBypassReason } : {}),
    }
  }
}
