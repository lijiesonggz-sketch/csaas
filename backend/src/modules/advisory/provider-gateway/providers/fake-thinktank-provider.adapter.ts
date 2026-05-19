import {
  ThinkTankProviderAdapter,
  ThinkTankProviderGatewayError,
  ThinkTankProviderResponse,
  ThinkTankProviderStreamChunk,
} from '../thinktank-provider-gateway.types'
import { THINKTANK_PROVIDER_GATEWAY_FAKE_MODEL } from '../thinktank-provider-gateway.config'

export type FakeThinkTankProviderScriptStep =
  | 'success'
  | 'retryable_failure'
  | 'failure'
  | 'timeout'

export interface FakeThinkTankProviderAdapterOptions {
  script?: FakeThinkTankProviderScriptStep[]
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
  private scriptIndex = 0

  constructor(options: FakeThinkTankProviderAdapterOptions = {}) {
    this.script = options.script?.length ? [...options.script] : ['success']
  }

  async complete(): Promise<ThinkTankProviderResponse> {
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
      usage: { ...DEFAULT_USAGE },
      estimatedCost: 0,
      finishReason: 'stop',
      metadata: {
        deterministic: true,
      },
    }
  }

  async *stream(): AsyncIterable<ThinkTankProviderStreamChunk> {
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

    for (const chunk of DEFAULT_STREAM_CHUNKS) {
      yield { ...chunk }
    }
  }

  private nextStep(): FakeThinkTankProviderScriptStep {
    const step = this.script[Math.min(this.scriptIndex, this.script.length - 1)]
    this.scriptIndex += 1
    return step
  }
}
