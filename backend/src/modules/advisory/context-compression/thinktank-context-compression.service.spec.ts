import { ConfigService } from '@nestjs/config'
import { ThinkTankProviderMessage } from '../provider-gateway/thinktank-provider-gateway.types'
import {
  DEFAULT_THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
  THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
  ThinkTankContextCompressionService,
  estimateThinkTankContextTokens,
} from './thinktank-context-compression.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440046'
const actorId = '770e8400-e29b-41d4-a716-446655440046'
const sessionId = '550e8400-e29b-41d4-a716-446655440046'

function createService(threshold?: number | string): ThinkTankContextCompressionService {
  return new ThinkTankContextCompressionService(
    new ConfigService(
      threshold === undefined
        ? {}
        : {
            [THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS]: threshold,
          },
    ),
  )
}

function createMessages(repeatedText = ''): ThinkTankProviderMessage[] {
  return [
    {
      role: 'user',
      content: `We need to diagnose enterprise onboarding risk. ${repeatedText}`,
    },
    {
      role: 'assistant',
      content:
        'Key conclusion: Enterprise rollout can continue only if SOC2 evidence gaps are closed first.',
    },
    {
      role: 'user',
      content: 'Open question: should security own the SOC2 remediation plan before launch?',
    },
    {
      role: 'assistant',
      content:
        'Working note: do not include FOREIGN TENANT SECRET raw ledger dump in compressed context.',
    },
    {
      role: 'user',
      content: 'Please continue with the next recommendation.',
    },
  ]
}

describe('ThinkTankContextCompressionService', () => {
  test('[P0][4.6-BE-001][AC2] defers below threshold without mutating provider messages', () => {
    const service = createService(5000)
    const messages = createMessages()

    const result = service.evaluate({
      tenantId,
      actorId,
      sessionId,
      workflowKey: 'problem-solving',
      currentStep: { index: 2, label: 'Assess constraints' },
      system: 'Governed ThinkTank advisor prompt.',
      messages,
      documentSummary: 'Current report draft tracks onboarding constraints.',
    })

    expect(result).toEqual(
      expect.objectContaining({
        decision: 'defer',
        reason: 'below_threshold',
        thresholdTokens: 5000,
        summary: null,
        providerMessages: messages,
      }),
    )
    expect(result.estimatedTokens).toBeGreaterThan(0)
    expect(result.metadata).toEqual(
      expect.objectContaining({
        policyDecision: 'defer',
        reason: 'below_threshold',
        thresholdTokens: 5000,
        summaryPresent: false,
        originalMessageCount: messages.length,
        providerMessageCount: messages.length,
      }),
    )
  })

  test('[P0][4.6-BE-002][AC1][AC4] executes above threshold with deterministic compressed context and current user message', () => {
    const repeatedText = Array.from({ length: 80 }, (_, index) => `token${index}`).join(' ')
    const messages = createMessages(repeatedText)
    const service = createService(40)

    const result = service.evaluate({
      tenantId,
      actorId,
      sessionId,
      workflowKey: 'problem-solving',
      currentStep: { index: 2, label: 'Assess constraints' },
      system: 'Governed ThinkTank advisor prompt.',
      messages,
      documentSummary: 'Report summary: onboarding remains feasible with SOC2 remediation.',
    })

    expect(result.decision).toBe('execute')
    expect(result.reason).toBe('threshold_reached')
    expect(result.estimatedTokens).toBeGreaterThanOrEqual(40)
    expect(result.providerMessages).toHaveLength(2)
    expect(result.providerMessages[0]).toEqual(
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('已压缩的历史上下文'),
      }),
    )
    expect(result.providerMessages[0].content).toContain(
      'Enterprise rollout can continue only if SOC2 evidence gaps are closed first',
    )
    expect(result.providerMessages[0].content).toContain(
      'should security own the SOC2 remediation plan before launch',
    )
    expect(result.providerMessages[0].content).toContain('Assess constraints')
    expect(result.providerMessages[0].content).toContain(
      'Report summary: onboarding remains feasible with SOC2 remediation',
    )
    expect(result.providerMessages[0].content).not.toContain('FOREIGN TENANT SECRET')
    expect(result.providerMessages[1]).toEqual(messages.at(-1))
    expect(result.summary).toContain('SOC2 evidence gaps')
    expect(result.checkpointMetadata).toEqual(
      expect.objectContaining({
        context_compression: expect.objectContaining({
          decision: 'execute',
          reason: 'threshold_reached',
          estimated_tokens: expect.any(Number),
          threshold_tokens: 40,
          important_decisions: expect.arrayContaining([
            expect.stringContaining('SOC2 evidence gaps'),
          ]),
          open_questions: expect.arrayContaining([
            expect.stringContaining('security own the SOC2 remediation plan'),
          ]),
        }),
      }),
    )
  })

  test('[P0][4.6-BE-009][AC3][AC4] filters scoped foreign marker messages inside the compression boundary', () => {
    const repeatedText = Array.from({ length: 80 }, (_, index) => `token${index}`).join(' ')
    const messages = [
      {
        tenantId,
        actorId,
        sessionId,
        role: 'user',
        content: `We need to diagnose enterprise onboarding risk. ${repeatedText}`,
      },
      {
        tenantId: '660e8400-e29b-41d4-a716-446655449999',
        actorId: '770e8400-e29b-41d4-a716-446655449999',
        sessionId,
        role: 'assistant',
        content: 'Key conclusion: FOREIGN TENANT SECRET marker-form conclusion must not leak.',
      },
      {
        tenantId,
        actorId,
        sessionId,
        role: 'assistant',
        content:
          'Key conclusion: Enterprise rollout can continue only if SOC2 evidence gaps are closed first.',
      },
      {
        tenantId,
        actorId,
        sessionId,
        role: 'user',
        content: 'Please continue with the next recommendation.',
      },
    ] satisfies Array<
      ThinkTankProviderMessage & { tenantId: string; actorId: string; sessionId: string }
    >
    const service = createService(40)

    const result = service.evaluate({
      tenantId,
      actorId,
      sessionId,
      workflowKey: 'problem-solving',
      currentStep: { index: 2, label: 'Assess constraints' },
      system: 'Governed ThinkTank advisor prompt.',
      messages,
      documentSummary: 'Report summary: onboarding remains feasible with SOC2 remediation.',
    })

    expect(result.decision).toBe('execute')
    expect(result.providerMessages[0].content).toContain('SOC2 evidence gaps')
    expect(result.providerMessages[0].content).not.toContain('FOREIGN TENANT SECRET')
    expect(result.metadata.originalMessageCount).toBe(3)
  })

  test('[P0][4.6-BE-003][AC4] estimates tokens deterministically without provider or live LLM access', () => {
    const messages = createMessages()

    expect(
      estimateThinkTankContextTokens({
        system: 'one two three',
        messages,
      }),
    ).toBe(
      estimateThinkTankContextTokens({
        system: 'one two three',
        messages,
      }),
    )
    expect(createService().getThresholdTokens()).toBe(
      DEFAULT_THINKTANK_CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
    )
  })
})
