import 'reflect-metadata'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AdvisoryModule } from '../advisory.module'
import { OrganizationsModule } from '../../organizations/organizations.module'
import { AdvisoryEventService } from '../events/advisory-event.service'
import { ThinkTankProviderGatewayService } from './thinktank-provider-gateway.service'
import {
  ThinkTankProviderGatewayError,
  ThinkTankProviderRequest,
} from './thinktank-provider-gateway.types'
import { FakeThinkTankProviderAdapter } from './providers/fake-thinktank-provider.adapter'

const tenantId = '660e8400-e29b-41d4-a716-446655440015'
const actorId = '770e8400-e29b-41d4-a716-446655440015'
const subjectId = '880e8400-e29b-41d4-a716-446655440015'
const correlationId = '990e8400-e29b-41d4-a716-446655440015'

const request: ThinkTankProviderRequest = {
  tenantId,
  actorId,
  subjectId,
  correlationId,
  provider: 'fake',
  model: 'glm-5.1',
  system: 'ThinkTank smoke system prompt',
  messages: [
    {
      role: 'user',
      content: 'Return a deterministic smoke response.',
    },
  ],
  maxTokens: 256,
  temperature: 0.2,
  metadata: {
    workflowType: 'provider_gateway_smoke',
    smoke: true,
  },
}

const createGateway = (
  adapter: FakeThinkTankProviderAdapter,
  overrides: Partial<ConstructorParameters<typeof ThinkTankProviderGatewayService>[0]> = {},
) => {
  const eventService = {
    emitTelemetry: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AdvisoryEventService, 'emitTelemetry'>>
  const sleeper = jest.fn().mockResolvedValue(undefined)
  const gateway = new ThinkTankProviderGatewayService({
    providers: [adapter],
    eventService: eventService as unknown as AdvisoryEventService,
    defaultProvider: 'fake',
    defaultModel: 'fake-thinktank-smoke',
    timeoutMs: 1000,
    retry: {
      maxAttempts: 1,
      delayMs: 0,
      sleeper,
    },
    ...overrides,
  })

  return { gateway, eventService, sleeper }
}

const collectTypeScriptFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return []

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return collectTypeScriptFiles(fullPath)
    }

    return fullPath.endsWith('.ts') ? [fullPath] : []
  })
}

describe('ThinkTankProviderGatewayService', () => {
  it('hides Anthropic SDK construction outside the provider adapter boundary', () => {
    expect(typeof ThinkTankProviderGatewayService.prototype.complete).toBe('function')
    expect(typeof ThinkTankProviderGatewayService.prototype.stream).toBe('function')

    const advisoryRoot = join(__dirname, '..')
    const offenders = collectTypeScriptFiles(advisoryRoot).filter((file) => {
      const normalized = file.replace(/\\/g, '/')
      const isProviderAdapter = normalized.includes('/provider-gateway/providers/')
      return !isProviderAdapter && /new\s+Anthropic\s*\(/.test(readFileSync(file, 'utf8'))
    })

    expect(offenders).toEqual([])
  })

  it('returns deterministic fake smoke responses and emits completed telemetry', async () => {
    const { gateway, eventService } = createGateway(new FakeThinkTankProviderAdapter())

    const result = await gateway.complete(request)

    expect(result).toMatchObject({
      id: 'fake-provider-call-0001',
      provider: 'fake',
      model: 'fake-thinktank-smoke',
      content: 'ThinkTank fake provider smoke response.',
      status: 'completed',
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
      },
      estimatedCost: 0,
      finishReason: 'stop',
    })
    expect(result.latencyMs).toEqual(expect.any(Number))
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_completed',
        tenantId,
        actorId,
        subjectType: 'provider_call',
        subjectId,
        outcome: 'success',
        privacyClassification: 'operational',
        correlationId,
        optional: expect.objectContaining({
          provider: 'fake',
          latencyMs: expect.any(Number),
          estimatedTokens: 19,
          estimatedCost: 0,
        }),
        metadata: expect.objectContaining({
          status: 'completed',
          model: 'fake-thinktank-smoke',
          input_tokens: 12,
          output_tokens: 7,
          total_tokens: 19,
        }),
      }),
    )
  })

  it('streams deterministic fake chunks through the same gateway contract', async () => {
    const { gateway, eventService } = createGateway(new FakeThinkTankProviderAdapter())

    const chunks = []
    for await (const chunk of gateway.stream({ ...request, stream: true })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { index: 0, delta: 'ThinkTank ', done: false },
      { index: 1, delta: 'fake provider ', done: false },
      expect.objectContaining({
        index: 2,
        delta: 'stream.',
        done: true,
        usage: {
          inputTokens: 12,
          outputTokens: 7,
          totalTokens: 19,
        },
        estimatedCost: 0,
      }),
    ])
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_completed',
        optional: expect.objectContaining({
          estimatedTokens: 19,
          estimatedCost: 0,
        }),
      }),
    )
  })

  it('emits retried telemetry for retryable failures without real sleeping', async () => {
    const retrySleeper = jest.fn().mockResolvedValue(undefined)
    const { gateway, eventService } = createGateway(
      new FakeThinkTankProviderAdapter({ script: ['retryable_failure', 'success'] }),
      {
        retry: {
          maxAttempts: 2,
          delayMs: 0,
          sleeper: retrySleeper,
        },
      },
    )

    const result = await gateway.complete(request)

    expect(result.status).toBe('completed')
    expect(retrySleeper).toHaveBeenCalledWith(0)
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_retried',
        tenantId,
        actorId,
        subjectType: 'provider_call',
        subjectId,
        outcome: 'failure',
        correlationId,
        optional: expect.objectContaining({
          provider: 'fake',
          errorCategory: 'provider',
        }),
        metadata: expect.objectContaining({
          retry_attempt: 1,
          max_attempts: 2,
          status: 'failed',
          retryable: true,
        }),
      }),
    )
  })

  it('normalizes timeout failures and emits failed telemetry without raw content', async () => {
    const { gateway, eventService } = createGateway(
      new FakeThinkTankProviderAdapter({ script: ['timeout'] }),
    )

    await expect(gateway.complete(request)).rejects.toMatchObject({
      code: 'THINKTANK_PROVIDER_TIMEOUT',
      category: 'timeout',
      provider: 'fake',
      status: 'timeout',
      retryable: true,
      message: 'Provider call timed out',
    })

    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_failed',
        tenantId,
        actorId,
        subjectType: 'provider_call',
        subjectId,
        outcome: 'failure',
        correlationId,
        optional: expect.objectContaining({
          provider: 'fake',
          errorCategory: 'timeout',
          estimatedCost: 0,
        }),
        metadata: expect.objectContaining({
          status: 'timeout',
          retryable: true,
          error_code: 'THINKTANK_PROVIDER_TIMEOUT',
        }),
      }),
    )

    const failedEvent = eventService.emitTelemetry.mock.calls.find(
      ([input]) => input.eventName === 'thinktank.provider.call_failed',
    )?.[0]
    expect(failedEvent?.metadata).not.toHaveProperty('messages')
    expect(failedEvent?.metadata).not.toHaveProperty('prompt')
    expect(failedEvent?.metadata).not.toHaveProperty('content')
    expect(failedEvent?.metadata).not.toHaveProperty('report')
    expect(failedEvent?.metadata).not.toHaveProperty('document')
    expect(failedEvent?.metadata).not.toHaveProperty('enterpriseContext')
  })

  it('rejects invalid gateway requests with a stable validation error shape', async () => {
    const { gateway } = createGateway(new FakeThinkTankProviderAdapter())

    await expect(gateway.complete({ ...request, messages: [] })).rejects.toBeInstanceOf(
      ThinkTankProviderGatewayError,
    )
    await expect(gateway.complete({ ...request, messages: [] })).rejects.toMatchObject({
      code: 'THINKTANK_PROVIDER_INVALID_REQUEST',
      category: 'validation',
      provider: 'fake',
      status: 'failed',
      retryable: false,
    })
  })

  it('registers and exports the gateway from AdvisoryModule without future runtime modules', () => {
    const providers = Reflect.getMetadata('providers', AdvisoryModule) ?? []
    const exports = Reflect.getMetadata('exports', AdvisoryModule) ?? []
    const imports = Reflect.getMetadata('imports', AdvisoryModule) ?? []

    expect(providers).toEqual(expect.arrayContaining([ThinkTankProviderGatewayService]))
    expect(exports).toEqual(expect.arrayContaining([ThinkTankProviderGatewayService]))
    expect(imports).toEqual(expect.arrayContaining([OrganizationsModule]))
    expect(imports.map((entry: { name?: string }) => entry?.name)).not.toContain(
      'ThinkTankWorkflowRuntimeModule',
    )
  })
})
