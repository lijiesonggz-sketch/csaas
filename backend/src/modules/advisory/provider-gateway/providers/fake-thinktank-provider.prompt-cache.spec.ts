import 'reflect-metadata'
import { FakeThinkTankProviderAdapter } from './fake-thinktank-provider.adapter'
import {
  ThinkTankProviderAdapter,
  ThinkTankProviderRequest,
  ThinkTankProviderStreamChunk,
} from '../thinktank-provider-gateway.types'

const request: ThinkTankProviderRequest = {
  tenantId: '660e8400-e29b-41d4-a716-446655440213',
  actorId: '770e8400-e29b-41d4-a716-446655440213',
  subjectId: '880e8400-e29b-41d4-a716-446655440213',
  correlationId: '990e8400-e29b-41d4-a716-446655440213',
  provider: 'fake',
  model: 'fake-thinktank-smoke',
  system: 'Stable fake prompt cache system material.',
  messages: [{ role: 'user', content: 'Continue.' }],
  metadata: {
    workflow_key: 'problem-solving',
    step_index: 1,
  },
}

describe('FakeThinkTankProviderAdapter prompt cache ATDD', () => {
  test('[P0] returns deterministic cache hit metadata for complete calls without live GLM', async () => {
    const adapter = new FakeThinkTankProviderAdapter({
      cacheScript: ['hit'],
      usage: {
        inputTokens: 120,
        outputTokens: 20,
        totalTokens: 140,
        cacheReadInputTokens: 96,
        cacheCreationInputTokens: 0,
        cachedInputTokens: 96,
        cacheEligibleInputTokens: 120,
      },
      estimatedCost: 0.003,
    } as never) as ThinkTankProviderAdapter

    const response = await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    } as never)

    expect(response).toMatchObject({
      provider: 'fake',
      status: 'completed',
      cacheStatus: 'hit',
      cacheStrategy: 'provider-auto',
      cacheKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      usage: {
        inputTokens: 120,
        outputTokens: 20,
        totalTokens: 140,
        cacheReadInputTokens: 96,
        cacheCreationInputTokens: 0,
        cachedInputTokens: 96,
        cacheEligibleInputTokens: 120,
      },
      estimatedCost: 0.003,
    })
  })

  test('[P0] returns deterministic cache miss metadata for complete calls without live GLM', async () => {
    const adapter = new FakeThinkTankProviderAdapter({
      cacheScript: ['miss'],
      usage: {
        inputTokens: 120,
        outputTokens: 20,
        totalTokens: 140,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 96,
        cachedInputTokens: 0,
        cacheEligibleInputTokens: 120,
      },
      estimatedCost: 0.006,
    } as never) as ThinkTankProviderAdapter

    const response = await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    } as never)

    expect(response).toMatchObject({
      cacheStatus: 'miss',
      cacheStrategy: 'provider-auto',
      cacheKey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      usage: {
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 96,
        cachedInputTokens: 0,
        cacheEligibleInputTokens: 120,
      },
      estimatedCost: 0.006,
    })
  })

  test('[P0] returns deterministic bypass metadata with bypass reason when cache is disabled or unsupported', async () => {
    const adapter = new FakeThinkTankProviderAdapter({
      cacheScript: ['bypass'],
      cacheBypassReason: 'disabled',
    } as never) as ThinkTankProviderAdapter

    const response = await adapter.complete({
      ...request,
      promptCache: {
        strategy: 'disabled',
        cacheKey: 'cccccccccccccccccccccccccccccccc',
      },
    } as never)

    expect(response).toMatchObject({
      status: 'completed',
      cacheStatus: 'bypass',
      cacheStrategy: 'disabled',
      cacheKey: 'cccccccccccccccccccccccccccccccc',
      cacheBypassReason: 'disabled',
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
      },
    })
  })

  test('[P1] carries the same deterministic cache metadata on the final stream chunk', async () => {
    const adapter = new FakeThinkTankProviderAdapter({
      cacheScript: ['hit'],
      streamUsage: {
        inputTokens: 120,
        outputTokens: 20,
        totalTokens: 140,
        cacheReadInputTokens: 96,
        cacheCreationInputTokens: 0,
        cachedInputTokens: 96,
        cacheEligibleInputTokens: 120,
      },
      estimatedCost: 0.003,
    } as never) as ThinkTankProviderAdapter
    const stream =
      adapter.stream?.bind(adapter) ??
      async function* (): AsyncIterable<ThinkTankProviderStreamChunk> {
        yield {
          index: 0,
          delta: '',
          done: true,
        }
      }

    const chunks: ThinkTankProviderStreamChunk[] = []
    for await (const chunk of stream({
      ...request,
      stream: true,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: 'dddddddddddddddddddddddddddddddd',
      },
    } as never)) {
      chunks.push(chunk)
    }

    expect(chunks.at(-1)).toMatchObject({
      done: true,
      cacheStatus: 'hit',
      cacheStrategy: 'provider-auto',
      cacheKey: 'dddddddddddddddddddddddddddddddd',
      usage: {
        cacheReadInputTokens: 96,
        cacheCreationInputTokens: 0,
        cachedInputTokens: 96,
      },
      estimatedCost: 0.003,
    })
  })
})
