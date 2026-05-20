import 'reflect-metadata'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { FakeThinkTankProviderAdapter } from './providers/fake-thinktank-provider.adapter'
import { ThinkTankProviderGatewayService } from './thinktank-provider-gateway.service'
import {
  ThinkTankProviderAdapter,
  ThinkTankProviderRequest,
} from './thinktank-provider-gateway.types'
import { createThinkTankPromptCachePolicy } from './thinktank-prompt-cache-policy'

const tenantId = '660e8400-e29b-41d4-a716-446655440210'
const actorId = '770e8400-e29b-41d4-a716-446655440210'
const subjectId = '880e8400-e29b-41d4-a716-446655440210'
const correlationId = '990e8400-e29b-41d4-a716-446655440210'

const request: ThinkTankProviderRequest = {
  tenantId,
  actorId,
  subjectId,
  correlationId,
  provider: 'fake',
  model: 'fake-thinktank-smoke',
  system: 'Stable workflow and persona prompt material.',
  messages: [{ role: 'user', content: 'Continue the workflow.' }],
  maxTokens: 256,
  temperature: 0.2,
  metadata: {
    workflow_key: 'problem-solving',
    step_index: 1,
  },
}

const createGateway = (adapter: ThinkTankProviderAdapter) => {
  const eventService = {
    emitTelemetry: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AdvisoryEventService, 'emitTelemetry'>>
  const gateway = new ThinkTankProviderGatewayService({
    providers: [adapter],
    eventService: eventService as unknown as AdvisoryEventService,
    defaultProvider: 'fake',
    defaultModel: 'fake-thinktank-smoke',
    timeoutMs: 1000,
    retry: {
      maxAttempts: 1,
      delayMs: 0,
      sleeper: jest.fn().mockResolvedValue(undefined),
    },
  })

  return { gateway, eventService }
}

const findTelemetryCall = (
  eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitTelemetry'>>,
  eventName: ThinkTankEventName,
) => eventService.emitTelemetry.mock.calls.find(([input]) => input.eventName === eventName)?.[0]

describe('ThinkTankProviderGatewayService prompt cache ATDD', () => {
  test('[P0] keeps stable cache identity independent from dynamic workflow step index', () => {
    const baseInput = {
      workflowKey: 'problem-solving',
      provider: 'fake',
      model: 'fake-thinktank-smoke',
      sources: [
        {
          relativePath: '_bmad/runtime/problem-solving/workflow.md',
          contentHash: 'workflow-hash-210',
        },
      ],
    }

    expect(createThinkTankPromptCachePolicy({ ...baseInput, stepIndex: 1 }).cacheKey).toBe(
      createThinkTankPromptCachePolicy({ ...baseInput, stepIndex: 2 }).cacheKey,
    )
  })

  test('[P0] emits prompt cache hit telemetry with safe token and cost metadata', async () => {
    const { gateway, eventService } = createGateway(
      new FakeThinkTankProviderAdapter({
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
      } as never),
    )

    const result = await gateway.complete({
      ...request,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: '11111111111111111111111111111111',
        cacheEligibleInputTokens: 120,
      },
    } as never)

    expect(result).toMatchObject({
      cacheStatus: 'hit',
      cacheStrategy: 'provider-auto',
      cacheKey: '11111111111111111111111111111111',
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
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PromptCacheHit,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.ProviderCall,
        subjectId,
        outcome: 'success',
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        correlationId,
        optional: expect.objectContaining({
          provider: 'fake',
          estimatedTokens: 140,
          estimatedCost: 0.003,
          cacheStatus: 'hit',
        }),
        metadata: expect.objectContaining({
          workflow_key: 'problem-solving',
          step_index: 1,
          model: 'fake-thinktank-smoke',
          cache_strategy: 'provider-auto',
          cache_key: '11111111111111111111111111111111',
          input_tokens: 120,
          output_tokens: 20,
          total_tokens: 140,
          cache_read_input_tokens: 96,
          cache_creation_input_tokens: 0,
          cached_input_tokens: 96,
          cache_eligible_input_tokens: 120,
        }),
      }),
    )

    const cacheEvent = findTelemetryCall(eventService, ThinkTankEventName.PromptCacheHit)
    expect(JSON.stringify(cacheEvent?.metadata)).not.toMatch(
      /Stable workflow|Continue the workflow|messages|content|report|document/i,
    )
  })

  test('[P0] emits prompt cache miss telemetry for unsupported or bypassed cache without failing completion', async () => {
    const { gateway, eventService } = createGateway(
      new FakeThinkTankProviderAdapter({
        cacheScript: ['bypass'],
        cacheBypassReason: 'unsupported',
      } as never),
    )

    const result = await gateway.complete({
      ...request,
      promptCache: {
        strategy: 'unsupported',
        cacheKey: '22222222222222222222222222222222',
      },
    } as never)

    expect(result).toMatchObject({
      status: 'completed',
      cacheStatus: 'bypass',
      cacheStrategy: 'unsupported',
      cacheBypassReason: 'unsupported',
    })
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PromptCacheMiss,
        outcome: 'success',
        optional: expect.objectContaining({
          provider: 'fake',
          cacheStatus: 'bypass',
        }),
        metadata: expect.objectContaining({
          cache_strategy: 'unsupported',
          cache_bypass_reason: 'unsupported',
        }),
      }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ProviderCallCompleted,
      }),
    )
  })

  test('[P1] carries final stream cache metadata into provider completion telemetry', async () => {
    const { gateway, eventService } = createGateway(
      new FakeThinkTankProviderAdapter({
        cacheScript: ['miss'],
        streamUsage: {
          inputTokens: 140,
          outputTokens: 24,
          totalTokens: 164,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 100,
          cachedInputTokens: 0,
          cacheEligibleInputTokens: 100,
        },
        estimatedCost: 0.005,
      } as never),
    )

    const chunks = []
    for await (const chunk of gateway.stream({
      ...request,
      stream: true,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: '33333333333333333333333333333333',
      },
    } as never)) {
      chunks.push(chunk)
    }

    expect(chunks.at(-1)).toMatchObject({
      done: true,
      cacheStatus: 'miss',
      cacheStrategy: 'provider-auto',
      usage: {
        inputTokens: 140,
        outputTokens: 24,
        totalTokens: 164,
        cacheCreationInputTokens: 100,
      },
      estimatedCost: 0.005,
    })
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PromptCacheMiss,
        metadata: expect.objectContaining({
          cache_strategy: 'provider-auto',
          cache_creation_input_tokens: 100,
        }),
      }),
    )
  })

  test('[P1] normalizes inferred cache metadata onto the final yielded stream chunk', async () => {
    const usageOnlyStreamAdapter: ThinkTankProviderAdapter = {
      provider: 'fake',
      complete: jest.fn(),
      stream: jest.fn(async function* () {
        yield {
          index: 0,
          delta: 'Cached ',
          done: false,
        }
        yield {
          index: 1,
          delta: 'response.',
          done: true,
          provider: 'fake',
          model: 'fake-thinktank-smoke',
          usage: {
            inputTokens: 140,
            outputTokens: 24,
            totalTokens: 164,
            cacheReadInputTokens: 96,
            cachedInputTokens: 96,
          },
          estimatedCost: 0.004,
        }
      }) as never,
    }
    const { gateway } = createGateway(usageOnlyStreamAdapter)

    const chunks = []
    for await (const chunk of gateway.stream({
      ...request,
      stream: true,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: '44444444444444444444444444444444',
        cacheEligibleInputTokens: 140,
      },
    } as never)) {
      chunks.push(chunk)
    }

    expect(chunks.at(-1)).toMatchObject({
      done: true,
      cacheStatus: 'hit',
      cacheStrategy: 'provider-auto',
      cacheKey: '44444444444444444444444444444444',
      usage: {
        inputTokens: 140,
        outputTokens: 24,
        totalTokens: 164,
        cacheReadInputTokens: 96,
        cachedInputTokens: 96,
        cacheEligibleInputTokens: 140,
      },
    })
  })

  test('[P0] treats absent provider cache usage metadata as bypass instead of miss', async () => {
    const { gateway, eventService } = createGateway(new FakeThinkTankProviderAdapter())

    const result = await gateway.complete({
      ...request,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: '66666666666666666666666666666666',
      },
    } as never)

    expect(result).toMatchObject({
      status: 'completed',
      cacheStatus: 'bypass',
      cacheStrategy: 'provider-auto',
      cacheBypassReason: 'provider_metadata_absent',
    })
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.PromptCacheMiss,
        metadata: expect.objectContaining({
          cache_strategy: 'provider-auto',
          cache_bypass_reason: 'provider_metadata_absent',
        }),
      }),
    )
  })

  test('[P0] preserves accumulated stream cache hit when the final chunk omits usage', async () => {
    const accumulatedHitAdapter: ThinkTankProviderAdapter = {
      provider: 'fake',
      complete: jest.fn(),
      stream: jest.fn(async function* () {
        yield {
          index: 0,
          delta: 'Cached ',
          done: false,
          usage: {
            inputTokens: 120,
            outputTokens: 10,
            totalTokens: 130,
            cacheReadInputTokens: 96,
            cachedInputTokens: 96,
          },
          cacheStatus: 'hit',
        }
        yield {
          index: 1,
          delta: 'response.',
          done: true,
        }
      }) as never,
    }
    const { gateway } = createGateway(accumulatedHitAdapter)

    const chunks = []
    for await (const chunk of gateway.stream({
      ...request,
      stream: true,
      promptCache: {
        strategy: 'provider-auto',
        cacheKey: '77777777777777777777777777777777',
      },
    } as never)) {
      chunks.push(chunk)
    }

    expect(chunks.at(-1)).toMatchObject({
      done: true,
      cacheStatus: 'hit',
      cacheStrategy: 'provider-auto',
      cacheKey: '77777777777777777777777777777777',
      usage: {
        inputTokens: 120,
        cacheReadInputTokens: 96,
      },
    })
  })

  test('[P0] excludes raw prompt-like provider metadata from prompt-cache telemetry', async () => {
    const unsafeAdapter: ThinkTankProviderAdapter = {
      provider: 'fake',
      complete: jest.fn(async () => ({
        id: 'unsafe-cache-call',
        provider: 'fake',
        model: 'fake-thinktank-smoke',
        content: 'safe response',
        status: 'completed',
        latencyMs: 0,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        estimatedCost: 0,
        cacheStatus: 'hit',
        cacheStrategy: 'provider-auto',
        metadata: {
          raw_prompt: 'must never be emitted',
          cacheSource: 'raw prompt material must never be emitted',
        },
      })) as never,
    }
    const { gateway, eventService } = createGateway(unsafeAdapter)

    await expect(
      gateway.complete({
        ...request,
        promptCache: {
          strategy: 'provider-auto',
          cacheKey: '55555555555555555555555555555555',
        },
      } as never),
    ).resolves.toMatchObject({ status: 'completed' })
    const cacheEvent = findTelemetryCall(eventService, ThinkTankEventName.PromptCacheHit)
    expect(cacheEvent).toBeDefined()
    expect(JSON.stringify(cacheEvent)).not.toMatch(/raw_prompt|must never be emitted/i)
    expect(JSON.stringify(cacheEvent)).not.toMatch(/raw prompt material/i)
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.ProviderCallCompleted,
      }),
    )
  })
})
