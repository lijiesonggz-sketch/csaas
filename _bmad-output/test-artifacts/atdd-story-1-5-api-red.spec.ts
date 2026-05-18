import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  story15CorrelationId,
  story15DeterministicResponse,
  story15ExpectedCompletedTelemetry,
  story15ExpectedFailedTelemetry,
  story15ExpectedRetriedTelemetry,
  story15GatewayRequest,
  story15RawSensitiveKeys,
  story15SafeTestEnv,
  story15StreamChunks,
  story15TimeoutFailure,
} from './atdd-story-1-5-fixtures'

const advisoryRoot = join(__dirname, '../../backend/src/modules/advisory')

const collectTypeScriptFiles = (dir: string): string[] => {
  if (!existsSync(dir)) {
    return []
  }

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return collectTypeScriptFiles(fullPath)
    }

    return fullPath.endsWith('.ts') ? [fullPath] : []
  })
}

describe('Story 1.5 Governed AI Provider Gateway ATDD (RED)', () => {
  test.skip('[P0][1.5-GW-001] exposes injectable gateway methods and keeps SDK construction outside feature code', async () => {
    const { ThinkTankProviderGatewayService } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service'
    )

    expect(ThinkTankProviderGatewayService).toBeDefined()
    expect(typeof ThinkTankProviderGatewayService.prototype.complete).toBe('function')
    expect(typeof ThinkTankProviderGatewayService.prototype.stream).toBe('function')

    const advisoryFiles = collectTypeScriptFiles(advisoryRoot)
    const directSdkConstruction = advisoryFiles.filter((file) => {
      const normalized = file.replace(/\\/g, '/')
      const isProviderAdapter = normalized.includes('/provider-gateway/providers/')
      const source = readFileSync(file, 'utf8')

      return !isProviderAdapter && /new\s+Anthropic\s*\(/.test(source)
    })

    expect(directSdkConstruction).toEqual([])
  })

  test.skip('[P0][1.5-GW-002] fake smoke success returns deterministic advisor response and emits completed telemetry', async () => {
    const { ThinkTankProviderGatewayService } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service'
    )
    const { FakeThinkTankProviderAdapter } = await import(
      '../../backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter'
    )

    const eventService = { emitTelemetry: jest.fn().mockResolvedValue(undefined) }
    const gateway = new ThinkTankProviderGatewayService({
      providers: [new FakeThinkTankProviderAdapter()],
      eventService,
      retry: { maxAttempts: 1, delayMs: 0, sleeper: jest.fn().mockResolvedValue(undefined) },
      timeoutMs: 1000,
    })

    const result = await gateway.complete(story15GatewayRequest)

    expect(result).toMatchObject(story15DeterministicResponse)
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_completed',
        tenantId: story15GatewayRequest.tenantId,
        actorId: story15GatewayRequest.actorId,
        subjectType: 'provider_call',
        subjectId: story15GatewayRequest.subjectId,
        outcome: 'success',
        privacyClassification: 'operational',
        correlationId: story15CorrelationId,
        metadata: expect.objectContaining(story15ExpectedCompletedTelemetry),
      }),
    )
  })

  test.skip('[P0][1.5-GW-003] fake streaming returns deterministic chunks through the gateway contract', async () => {
    const { ThinkTankProviderGatewayService } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service'
    )
    const { FakeThinkTankProviderAdapter } = await import(
      '../../backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter'
    )

    const gateway = new ThinkTankProviderGatewayService({
      providers: [new FakeThinkTankProviderAdapter()],
      eventService: { emitTelemetry: jest.fn().mockResolvedValue(undefined) },
      retry: { maxAttempts: 1, delayMs: 0, sleeper: jest.fn().mockResolvedValue(undefined) },
      timeoutMs: 1000,
    })

    const chunks = []
    for await (const chunk of gateway.stream({ ...story15GatewayRequest, stream: true })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(story15StreamChunks)
    expect(chunks.map((chunk) => chunk.delta).join('')).toBe('ThinkTank fake provider stream.')
  })

  test.skip('[P0][1.5-GW-004] retryable provider failure emits call_retried without real sleeping', async () => {
    const { ThinkTankProviderGatewayService } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service'
    )
    const { FakeThinkTankProviderAdapter } = await import(
      '../../backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter'
    )

    const sleeper = jest.fn().mockResolvedValue(undefined)
    const eventService = { emitTelemetry: jest.fn().mockResolvedValue(undefined) }
    const gateway = new ThinkTankProviderGatewayService({
      providers: [
        new FakeThinkTankProviderAdapter({
          script: ['retryable_failure', 'success'],
        }),
      ],
      eventService,
      retry: { maxAttempts: 2, delayMs: 0, sleeper },
      timeoutMs: 1000,
    })

    await expect(gateway.complete(story15GatewayRequest)).resolves.toMatchObject({
      status: 'completed',
    })

    expect(sleeper).toHaveBeenCalledWith(0)
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_retried',
        correlationId: story15CorrelationId,
        metadata: expect.objectContaining(story15ExpectedRetriedTelemetry),
      }),
    )
  })

  test.skip('[P0][1.5-GW-005] timeout/failure returns normalized ThinkTank error and emits failed telemetry', async () => {
    const { ThinkTankProviderGatewayService } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service'
    )
    const { FakeThinkTankProviderAdapter } = await import(
      '../../backend/src/modules/advisory/provider-gateway/providers/fake-thinktank-provider.adapter'
    )

    const eventService = { emitTelemetry: jest.fn().mockResolvedValue(undefined) }
    const gateway = new ThinkTankProviderGatewayService({
      providers: [new FakeThinkTankProviderAdapter({ script: ['timeout'] })],
      eventService,
      retry: { maxAttempts: 1, delayMs: 0, sleeper: jest.fn().mockResolvedValue(undefined) },
      timeoutMs: 1,
    })

    await expect(gateway.complete(story15GatewayRequest)).rejects.toMatchObject(
      story15TimeoutFailure,
    )

    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.provider.call_failed',
        correlationId: story15CorrelationId,
        metadata: expect.objectContaining(story15ExpectedFailedTelemetry),
      }),
    )
  })

  test.skip('[P0][1.5-GW-006] provider telemetry uses canonical snake_case fields and excludes raw content', async () => {
    const { normalizeThinkTankEvent } = await import(
      '../../backend/src/modules/advisory/events/thinktank-event-contract'
    )

    const event = normalizeThinkTankEvent({
      eventName: 'thinktank.provider.call_completed',
      tenantId: story15GatewayRequest.tenantId,
      actorId: story15GatewayRequest.actorId,
      subjectType: 'provider_call',
      subjectId: story15GatewayRequest.subjectId,
      outcome: 'success',
      privacyClassification: 'operational',
      correlationId: story15CorrelationId,
      metadata: {
        provider: 'fake',
        status: 'completed',
        latencyMs: 12,
        estimatedTokens: 19,
        estimatedCost: 0,
      },
    })

    expect(event).toEqual(
      expect.objectContaining({
        event_name: 'thinktank.provider.call_completed',
        latency_ms: 12,
        estimated_tokens: 19,
        estimated_cost: 0,
      }),
    )
    for (const rawKey of story15RawSensitiveKeys) {
      expect(event).not.toHaveProperty(rawKey)
    }
  })

  test.skip('[P1][1.5-GW-007] config defaults to fake safe mode without model API keys', async () => {
    const { resolveThinkTankProviderGatewayConfig } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.config'
    )

    const config = resolveThinkTankProviderGatewayConfig(story15SafeTestEnv)

    expect(config).toMatchObject({
      providerMode: 'fake',
      model: expect.any(String),
      timeoutMs: expect.any(Number),
      retry: expect.objectContaining({
        maxAttempts: expect.any(Number),
      }),
    })
    expect(config.liveProviderEnabled).toBe(false)
  })

  test.skip('[P1][1.5-GW-008] AdvisoryModule registers and exports the provider gateway', async () => {
    const { AdvisoryModule } = await import('../../backend/src/modules/advisory/advisory.module')
    const { ThinkTankProviderGatewayService } = await import(
      '../../backend/src/modules/advisory/provider-gateway/thinktank-provider-gateway.service'
    )

    const moduleMetadata = Reflect.getMetadata('imports', AdvisoryModule) ?? []
    const providerMetadata = Reflect.getMetadata('providers', AdvisoryModule) ?? []
    const exportMetadata = Reflect.getMetadata('exports', AdvisoryModule) ?? []

    expect(moduleMetadata.map((entry: { name?: string }) => entry?.name)).not.toContain(
      'ThinkTankWorkflowRuntimeModule',
    )
    expect(providerMetadata).toEqual(expect.arrayContaining([ThinkTankProviderGatewayService]))
    expect(exportMetadata).toEqual(expect.arrayContaining([ThinkTankProviderGatewayService]))
  })
})
