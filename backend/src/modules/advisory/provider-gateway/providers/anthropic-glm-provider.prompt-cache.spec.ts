import 'reflect-metadata'
import Anthropic from '@anthropic-ai/sdk'
import { AnthropicGlmProviderAdapter } from './anthropic-glm-provider.adapter'
import { ThinkTankProviderGatewayConfig } from '../thinktank-provider-gateway.config'
import { ThinkTankProviderRequest } from '../thinktank-provider-gateway.types'

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}))

const tenantId = '660e8400-e29b-41d4-a716-446655440211'
const actorId = '770e8400-e29b-41d4-a716-446655440211'

const config: ThinkTankProviderGatewayConfig = {
  providerMode: 'glm',
  model: 'glm-5.1',
  apiKey: 'test-key',
  baseUrl: 'https://glm.example.test/api/anthropic',
  timeoutMs: 1000,
  retry: {
    maxAttempts: 1,
    delayMs: 0,
    backoffMultiplier: 2,
  },
  liveProviderEnabled: true,
  anthropicExplicitCacheEnabled: false,
}

const request: ThinkTankProviderRequest = {
  tenantId,
  actorId,
  provider: 'glm',
  model: 'glm-5.1',
  system: 'Stable system prompt',
  messages: [{ role: 'user', content: 'Continue.' }],
  maxTokens: 256,
  temperature: 0.2,
  metadata: {
    workflow_key: 'problem-solving',
    step_index: 1,
  },
}

const createAdapterWithResponse = (
  response: Record<string, unknown>,
  overrides: Partial<ThinkTankProviderGatewayConfig> = {},
) => {
  const adapter = new AnthropicGlmProviderAdapter({ ...config, ...overrides })
  const client = (Anthropic as unknown as jest.Mock).mock.results.at(-1)?.value
  client.messages.create.mockResolvedValue(response)

  return { adapter, create: client.messages.create as jest.Mock }
}

describe('AnthropicGlmProviderAdapter prompt cache ATDD', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('[P0] normalizes Anthropic-style cache read and creation usage fields', async () => {
    const { adapter, create } = createAdapterWithResponse(
      {
        id: 'msg-cache-anthropic',
        model: 'glm-5.1',
        content: [{ type: 'text', text: 'Cached response.' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 40,
          output_tokens: 12,
          cache_read_input_tokens: 120,
          cache_creation_input_tokens: 80,
        },
      },
      { anthropicExplicitCacheEnabled: true },
    )

    const result = await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'anthropic-explicit',
        cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    } as never)

    expect(result).toMatchObject({
      cacheStatus: 'hit',
      cacheStrategy: 'anthropic-explicit',
      usage: {
        inputTokens: 240,
        outputTokens: 12,
        totalTokens: 252,
        cacheReadInputTokens: 120,
        cacheCreationInputTokens: 80,
        cachedInputTokens: 120,
      },
      estimatedCost: 0.000094,
      metadata: expect.objectContaining({
        cache_source: 'anthropic_usage',
      }),
    })
    expect(JSON.stringify(create.mock.calls[0][0])).toContain('cache_control')
  })

  test('[P0] normalizes Z.AI cached_tokens from prompt_tokens_details without live GLM calls', async () => {
    const { adapter } = createAdapterWithResponse({
      id: 'msg-cache-zai',
      model: 'glm-5.1',
      content: [{ type: 'text', text: 'Provider auto cached response.' }],
      usage: {
        input_tokens: 160,
        output_tokens: 20,
        prompt_tokens_details: {
          cached_tokens: 128,
        },
      },
    })

    const result = await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    } as never)

    expect(result).toMatchObject({
      cacheStatus: 'hit',
      cacheStrategy: 'provider-auto',
      usage: {
        inputTokens: 160,
        outputTokens: 20,
        totalTokens: 180,
        cachedInputTokens: 128,
        cacheReadInputTokens: 128,
      },
      estimatedCost: 0.000052,
      metadata: expect.objectContaining({
        cache_source: 'zai_prompt_tokens_details',
      }),
    })
  })

  test('[P1] avoids explicit cache_control for provider-auto GLM requests', async () => {
    const { adapter, create } = createAdapterWithResponse({
      id: 'msg-cache-auto',
      model: 'glm-5.1',
      content: [{ type: 'text', text: 'Auto cache response.' }],
      usage: {
        input_tokens: 20,
        output_tokens: 5,
        prompt_tokens_details: {
          cached_tokens: 0,
        },
      },
    })

    await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: 'cccccccccccccccccccccccccccccccc',
      },
    } as never)

    const payload = create.mock.calls[0][0]
    expect(JSON.stringify(payload)).not.toContain('cache_control')
  })

  test('[P1] downgrades unsupported anthropic-explicit cache strategy to bypass', async () => {
    const { adapter, create } = createAdapterWithResponse({
      id: 'msg-cache-explicit-unsupported',
      model: 'glm-5.1',
      content: [{ type: 'text', text: 'Explicit cache unsupported response.' }],
      usage: {
        input_tokens: 20,
        output_tokens: 5,
      },
    })

    const result = await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'anthropic-explicit',
        cacheKey: 'dddddddddddddddddddddddddddddddd',
      },
    } as never)

    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain('cache_control')
    expect(result).toMatchObject({
      cacheStatus: 'bypass',
      cacheStrategy: 'unsupported',
      cacheBypassReason: 'unsupported',
    })
  })
})
