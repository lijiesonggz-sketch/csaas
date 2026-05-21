import { AdvisoryQuickConsultContextStatus } from '../../../database/entities/advisory-quick-consult-context.entity'
import {
  QuickConsultMethodRecommendationService,
  QuickConsultRecommendationConfidence,
} from './quick-consult-method-recommendation.service'
import {
  QuickConsultAnalysisRunner,
  QuickConsultIntakeAnalyzer,
  QuickConsultService,
} from './quick-consult.service'
import { ThinkTankEventName } from '../events/thinktank-event-contract'

/**
 * Story 3.7 ATDD RED phase - Quick Consult contextual recommendation orchestration.
 *
 * Provider endpoint/source: POST /advisory/quick-consult/start via QuickConsultController.
 * Expected response extension: recommendationContext with mode, signalsApplied,
 * sources, fallbackReason, and contextCompletionPrompt.
 * Privacy rule: request body tenantId, organizationId, maturity, compliance, and
 * csaasSignals are ignored in favor of trusted tenant/user context.
 */

const tenantA = '660e8400-e29b-41d4-a716-446655440000'
const tenantB = '660e8400-e29b-41d4-a716-446655440099'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationA = '880e8400-e29b-41d4-a716-446655440000'
const organizationB = '880e8400-e29b-41d4-a716-446655440099'
const user = { id: actorId, organizationId: organizationA, role: 'consultant' }

function createRecommendation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quick-consult-context:problem-solving:1',
    recommendationId: 'quick-consult-context:problem-solving:1',
    workflowKey: 'problem-solving',
    methodName: 'Problem Solving',
    rank: 1,
    rationale: '合规整改需要先拆清风险和优先级。',
    primaryRationale: '合规整改需要先拆清风险和优先级。',
    expandedRationale: 'Problem Solving 能帮助比较整改成本、风险和交付窗口。',
    fitScenario: 'Systematic diagnosis and solution design',
    durationMinutes: 35,
    expectedDuration: '25-35 minutes',
    expectedOutput: 'Root causes and prioritized options.',
    classificationRefs: ['compliance'],
    sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
    ...overrides,
  }
}

function buildMockRecommendationContext(request: any) {
  const sources = [
    ...(request.organizationContext ? ['organization_context'] : []),
    ...(request.enterpriseSignals?.mode === 'enterprise' ? request.enterpriseSignals.sources : []),
  ]
  const missingFields = request.organizationContext?.completeness?.missingFields ?? []
  const contextCompletionPrompt =
    request.organizationContext?.completenessScore < 70 && missingFields.length > 0
      ? {
          missingFields,
          message: `补充${missingFields.join('、')}可提升推荐精度。`,
          action: 'open_enterprise_background_settings',
        }
      : undefined

  return {
    mode: request.enterpriseSignals?.mode === 'enterprise' ? 'enterprise' : 'generic',
    signalsApplied:
      request.enterpriseSignals?.mode === 'enterprise'
        ? request.enterpriseSignals.signalsApplied
        : [],
    sources,
    ...(request.enterpriseSignals?.mode !== 'enterprise' &&
    request.enterpriseSignals?.fallbackReason
      ? { fallbackReason: request.enterpriseSignals.fallbackReason }
      : {}),
    ...(contextCompletionPrompt ? { contextCompletionPrompt } : {}),
  }
}

function createDependencies() {
  return {
    accessService: { assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined) },
    intakeAnalyzer: {
      classifyProblem: jest.fn().mockResolvedValue({
        clarity: 'clear',
        confidence: 0.91,
        normalizedProblem: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
        provider: 'fake',
        providerStatus: 'fake',
        latencyMs: 2,
        originalProblemContext: {
          text: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
          language: 'zh-CN',
        },
        problemTypes: [
          {
            id: 'compliance',
            label: '合规整改',
            confidence: 0.91,
            scenarioLanguage: '合规要求临近，需要明确整改范围和优先级',
          },
        ],
        confidenceLevel: 'high',
        scenarioLanguage: {
          label: '合规要求临近，需要明确整改范围和优先级',
          summary: '当前问题更像是在合规压力下明确整改范围。',
          guidance: '先厘清系统、审计要求和整改成本。',
        },
      }),
    } as unknown as jest.Mocked<QuickConsultIntakeAnalyzer>,
    analysisRunner: {
      startAnalysis: jest.fn().mockResolvedValue({
        consultationId: 'quick-consult-context',
        contextId: 'quick-consult-context',
        status: 'analysis_started',
        providerStatus: 'fake',
        latencyMs: 3,
        preview: { nextStepLabel: 'Quick Consult analysis', estimatedDurationMinutes: 5 },
      }),
    } as unknown as jest.Mocked<QuickConsultAnalysisRunner>,
    eventService: { emitAudit: jest.fn().mockResolvedValue(undefined) },
    contextRepository: {
      createContext: jest.fn().mockResolvedValue({
        id: 'quick-consult-context',
        originalProblem: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
        clarificationQuestions: [],
        clarificationAnswers: [],
      }),
      findContextForActor: jest.fn().mockResolvedValue(null),
      updateContext: jest.fn().mockResolvedValue({
        id: 'quick-consult-context',
        originalProblem: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
        clarificationQuestions: [],
        clarificationAnswers: [],
      }),
    },
    methodRecommendationService: {
      generateRecommendations: jest.fn().mockImplementation((request) =>
        Promise.resolve({
          confidence: QuickConsultRecommendationConfidence.Confident,
          recommendations: [
            createRecommendation(),
            createRecommendation({
              id: 'quick-consult-context:prd:2',
              recommendationId: 'quick-consult-context:prd:2',
              workflowKey: 'prd',
              methodName: 'PRD',
              rank: 2,
            }),
          ],
          generatedAt: '2026-05-21T02:34:00.000+08:00',
          sourceRefCount: 4,
          recommendationContext: buildMockRecommendationContext(request),
        }),
      ),
    } as unknown as jest.Mocked<QuickConsultMethodRecommendationService>,
    organizationContextService: {
      getPromptContext: jest.fn().mockResolvedValue({
        contextId: 'organization-context-36',
        organizationName: '华数安全集团',
        industry: '数据安全合规',
        size: '201-500人',
        completenessScore: 100,
        completeness: {
          requiredFieldsComplete: true,
          missingFields: [],
          updatedAt: '2026-05-20T15:33:04.000Z',
        },
      }),
    },
    enterpriseSignalsService: {
      loadForQuickConsult: jest.fn().mockResolvedValue({
        mode: 'enterprise',
        status: 'available',
        signalsApplied: ['it_maturity', 'compliance'],
        sources: ['csaas_it_maturity', 'csaas_compliance'],
        summary: {
          overallMaturity: 'managed',
          topShortcomings: ['日志留存', '访问控制复核'],
          complianceGapLevel: 'medium',
          riskThemes: ['ISO 27001 访问控制'],
          latestReportStatus: 'completed',
        },
        metadata: { signalCount: 2, sourceCount: 2, latencyMs: 120 },
      }),
    },
  }
}

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new (QuickConsultService as any)(
    dependencies.accessService,
    dependencies.intakeAnalyzer,
    dependencies.analysisRunner,
    dependencies.eventService,
    dependencies.contextRepository,
    dependencies.methodRecommendationService,
    dependencies.organizationContextService,
    dependencies.enterpriseSignalsService,
  )
}

describe('QuickConsultService contextual recommendations (Story 3.7 ATDD RED)', () => {
  it('[P0] AC1 returns enterprise recommendation context when CSAAS signals are available in threshold', async () => {
    const dependencies = createDependencies()
    dependencies.methodRecommendationService.generateRecommendations.mockResolvedValueOnce({
      confidence: QuickConsultRecommendationConfidence.Confident,
      recommendations: [
        createRecommendation({
          rationale: '合规整改建议已结合 CSAAS 成熟度 managed 和访问控制缺口。',
          sourceRefs: [
            'workflow:problem-solving',
            'method:problem-solving:library-1',
            'csaas:it_maturity',
            'csaas:compliance',
          ],
        }),
        createRecommendation({
          id: 'quick-consult-context:domain-research:2',
          recommendationId: 'quick-consult-context:domain-research:2',
          workflowKey: 'domain-research',
          methodName: 'Domain Research',
          rank: 2,
        }),
      ],
      generatedAt: '2026-05-21T02:34:00.000+08:00',
      sourceRefCount: 5,
      recommendationContext: {
        mode: 'enterprise',
        signalsApplied: ['it_maturity', 'compliance'],
        sources: ['organization_context', 'csaas_it_maturity', 'csaas_compliance'],
      },
    } as any)
    const service = createService(dependencies)

    const result = (await service.startQuickConsult({
      user,
      tenantId: tenantA,
      problem: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
      metadata: {
        tenantId: tenantB,
        organizationId: organizationB,
        csaasSignals: ['hostile-browser-payload'],
      },
    } as any)) as any

    expect(dependencies.enterpriseSignalsService.loadForQuickConsult).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        organizationId: organizationA,
        deadlineMs: 2000,
      }),
    )
    expect(dependencies.enterpriseSignalsService.loadForQuickConsult).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenantB }),
    )
    expect(dependencies.methodRecommendationService.generateRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationContext: expect.objectContaining({ organizationName: '华数安全集团' }),
        enterpriseSignals: expect.objectContaining({
          mode: 'enterprise',
          signalsApplied: ['it_maturity', 'compliance'],
        }),
      }),
    )
    expect(result).toMatchObject({
      status: 'analysis_started',
      recommendationConfidence: 'confident',
      recommendationContext: {
        mode: 'enterprise',
        signalsApplied: ['it_maturity', 'compliance'],
        sources: ['organization_context', 'csaas_it_maturity', 'csaas_compliance'],
      },
    })
    expect(JSON.stringify(result)).not.toContain('hostile-browser-payload')
  })

  it('[P0] AC2 falls back to generic recommendation mode without failing Quick Consult', async () => {
    const scenarios = [
      {
        reason: 'no_data',
        signalResult: {
          mode: 'generic',
          status: 'degraded',
          fallbackReason: 'no_data',
          signalsApplied: [],
          sources: [],
        },
      },
      { reason: 'error', signalError: new Error('CSAAS tenant B outage with secret detail') },
      {
        reason: 'malformed',
        signalResult: {
          mode: 'generic',
          status: 'degraded',
          fallbackReason: 'malformed',
          signalsApplied: [],
          sources: [],
        },
      },
      {
        reason: 'timeout',
        signalResult: {
          mode: 'generic',
          status: 'degraded',
          fallbackReason: 'timeout',
          signalsApplied: [],
          sources: [],
        },
      },
      {
        reason: 'no_organization',
        userOverride: { ...user, organizationId: null },
        signalResult: {
          mode: 'generic',
          status: 'degraded',
          fallbackReason: 'no_organization',
          signalsApplied: [],
          sources: [],
        },
      },
    ]

    for (const scenario of scenarios) {
      const dependencies = createDependencies()
      dependencies.enterpriseSignalsService.loadForQuickConsult = scenario.signalError
        ? jest.fn().mockRejectedValue(scenario.signalError)
        : jest.fn().mockResolvedValue(scenario.signalResult)
      const service = createService(dependencies)

      const result = (await service.startQuickConsult({
        user: scenario.userOverride ?? user,
        tenantId: tenantA,
        problem: '请给出 ISO 27001 整改优先级建议。',
      } as any)) as any

      expect(result).toMatchObject({
        status: 'analysis_started',
        recommendationConfidence: 'confident',
        recommendationContext: expect.objectContaining({
          mode: 'generic',
          fallbackReason: scenario.reason,
        }),
      })
      expect(result.recommendations).toHaveLength(2)
      expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalled()
      expect(dependencies.contextRepository.updateContext).not.toHaveBeenCalledWith(
        tenantA,
        'quick-consult-context',
        expect.objectContaining({ status: AdvisoryQuickConsultContextStatus.AnalysisFailed }),
      )
      expect(JSON.stringify(result)).not.toContain('tenant B outage')
      expect(JSON.stringify(result)).not.toContain(tenantB)
    }
  })

  it('[P1] AC3 returns a non-blocking context completion prompt for low enterprise background completeness', async () => {
    const dependencies = createDependencies()
    dependencies.organizationContextService.getPromptContext.mockResolvedValueOnce({
      contextId: 'organization-context-low',
      organizationName: '华数安全集团',
      industry: null,
      size: null,
      completenessScore: 33,
      completeness: {
        requiredFieldsComplete: true,
        missingFields: ['industry', 'size'],
        updatedAt: '2026-05-20T15:33:04.000Z',
      },
    })
    dependencies.enterpriseSignalsService.loadForQuickConsult.mockResolvedValueOnce({
      mode: 'generic',
      status: 'degraded',
      fallbackReason: 'no_data',
      signalsApplied: [],
      sources: [],
    })
    const service = createService(dependencies)

    const result = (await service.startQuickConsult({
      user,
      tenantId: tenantA,
      problem: '请分析企业销售切入点和数据安全合规风险。',
    } as any)) as any

    expect(result).toMatchObject({
      status: 'analysis_started',
      recommendationContext: {
        contextCompletionPrompt: {
          missingFields: ['industry', 'size'],
          action: 'open_enterprise_background_settings',
        },
      },
    })
    expect(result.recommendations).toHaveLength(2)
    expect(result.recommendationConfidence).toBe('confident')
    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalled()
  })

  it('[P1] AC1-AC2 persists and audits only status/count/source markers for CSAAS context', async () => {
    const dependencies = createDependencies()
    const service = createService(dependencies)

    await service.startQuickConsult({
      user,
      tenantId: tenantA,
      problem: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
    } as any)

    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantA,
      'quick-consult-context',
      expect.objectContaining({
        metadata: expect.objectContaining({
          recommendationContext: expect.objectContaining({
            mode: 'enterprise',
            enterpriseSignalStatus: 'available',
            enterpriseSignalCount: 2,
            sources: ['csaas_it_maturity', 'csaas_compliance'],
          }),
        }),
      }),
    )
    const completedEvent = dependencies.eventService.emitAudit.mock.calls
      .map((call) => call[0])
      .find((event) => event.eventName === ThinkTankEventName.QuickConsultCompleted)
    expect(completedEvent).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          enterprise_signal_status: 'available',
          enterprise_signal_count: 2,
          enterprise_signal_source_count: 2,
        }),
      }),
    )
    const serialized = JSON.stringify({
      updateCalls: dependencies.contextRepository.updateContext.mock.calls,
      completedEvent,
    })
    expect(serialized).not.toMatch(
      /日志留存|访问控制复核|rawQuestionnaireAnswers|rawReportSections|ISO 27001 差距整改优先级|prompt|provider output/i,
    )
  })
})
