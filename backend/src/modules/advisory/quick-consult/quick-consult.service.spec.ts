import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import {
  QuickConsultAnalysisRunner,
  QuickConsultIntakeAnalyzer,
  QuickConsultService,
  THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE,
  THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE,
  THINKTANK_QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE,
  THINKTANK_QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  THINKTANK_QUICK_CONSULT_START_FAILED_MESSAGE,
} from './quick-consult.service'
import {
  QuickConsultMethodRecommendationService,
  QuickConsultRecommendationConfidence,
} from './quick-consult-method-recommendation.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisoryQuickConsultContextStatus } from '../../../database/entities/advisory-quick-consult-context.entity'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const user = {
  id: actorId,
  organizationId,
  role: 'consultant',
}

function createFreshContextDates() {
  const now = new Date()
  return {
    createdAt: now,
    updatedAt: now,
  }
}

function createDependencies() {
  return {
    accessService: {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    },
    intakeAnalyzer: {
      classifyProblem: jest.fn(),
    } as unknown as jest.Mocked<QuickConsultIntakeAnalyzer>,
    analysisRunner: {
      startAnalysis: jest.fn(),
    } as unknown as jest.Mocked<QuickConsultAnalysisRunner>,
    eventService: {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    },
    contextRepository: {
      createContext: jest.fn(),
      findContextForActor: jest.fn().mockResolvedValue(null),
      updateContext: jest.fn(),
    },
    methodRecommendationService: {
      generateRecommendations: jest.fn().mockResolvedValue({
        confidence: QuickConsultRecommendationConfidence.None,
        recommendations: [],
        generatedAt: '2026-05-20T00:00:00.000Z',
        sourceRefCount: 0,
      }),
    } as unknown as jest.Mocked<QuickConsultMethodRecommendationService>,
    organizationContextService: {
      getPromptContext: jest.fn().mockResolvedValue(null),
    },
  }
}

const organizationPromptContext = {
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
}

describe('QuickConsultService', () => {
  it('rejects blank and over-limit problems before analysis or event emission', async () => {
    const dependencies = createDependencies()
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: '   ',
      }),
    ).rejects.toThrow(BadRequestException)

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: 'x'.repeat(5001),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE]),
      }),
    })

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: '',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE]),
      }),
    })
    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
    expect(dependencies.eventService.emitAudit).not.toHaveBeenCalled()
    expect(dependencies.contextRepository.createContext).not.toHaveBeenCalled()
  })

  it('returns clarification_required with one or two questions and preserves original context', async () => {
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'ambiguous',
      confidence: 0.42,
      providerStatus: 'not_called',
      latencyMs: 1,
      originalProblemContext: {
        text: '我们的合规有点乱，帮我看看怎么办',
        language: 'zh-CN',
      },
      clarificationQuestions: ['当前涉及哪个系统或业务范围？', '你最担心的结果是什么？'],
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: '我们的合规有点乱，帮我看看怎么办',
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: ['当前涉及哪个系统或业务范围？', '你最担心的结果是什么？'],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    const result = await service.startQuickConsult({
      user,
      tenantId,
      problem: '  我们的合规有点乱，帮我看看怎么办  ',
    })

    expect(result).toMatchObject({
      status: 'clarification_required',
      contextId: '550e8400-e29b-41d4-a716-446655440001',
      originalProblemContext: {
        text: '我们的合规有点乱，帮我看看怎么办',
        language: 'zh-CN',
      },
      clarificationQuestions: ['当前涉及哪个系统或业务范围？', '你最担心的结果是什么？'],
      providerStatus: 'not_called',
    })
    expect(result.contextId).toEqual(expect.any(String))
    expect(result.status).toBe('clarification_required')
    if (result.status !== 'clarification_required') {
      throw new Error('Expected clarification_required response')
    }
    expect(result.clarificationQuestions).toHaveLength(2)
    expect(dependencies.contextRepository.createContext).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        actorId,
        originalProblem: '我们的合规有点乱，帮我看看怎么办',
        status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
        clarificationAnswers: [],
      }),
    )
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
    expect(dependencies.eventService.emitAudit).not.toHaveBeenCalled()
  })

  it('starts clear-problem analysis and emits privacy-safe QuickConsultStarted event', async () => {
    const rawProblem = '请分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.91,
      normalizedProblem: '分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
    })
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-1',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
      preview: {
        nextStepLabel: 'Quick Consult analysis',
        estimatedDurationMinutes: 5,
      },
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    const result = await service.startQuickConsult({
      user,
      tenantId,
      problem: rawProblem,
    })

    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        organizationId,
        tenantId,
        contextId: 'quick-consult-1',
        normalizedProblem: expect.stringContaining('ISO 27001'),
      }),
    )
    expect(result).toMatchObject({
      consultationId: 'quick-consult-1',
      contextId: 'quick-consult-1',
      status: 'analysis_started',
      analysisWindowMinutes: 5,
      providerStatus: 'fake',
    })
    expect(dependencies.contextRepository.createContext).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisPending,
      }),
    )
    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantId,
      'quick-consult-1',
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisStarted,
      }),
    )

    const eventInput = dependencies.eventService.emitAudit.mock.calls[0][0]
    expect(eventInput).toMatchObject({
      eventName: ThinkTankEventName.QuickConsultStarted,
      tenantId,
      actorId,
      subjectType: ThinkTankSubjectType.QuickConsult,
      subjectId: 'quick-consult-1',
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        provider: 'fake',
        latencyMs: 3,
      },
      metadata: {
        clarity: 'clear',
        provider_status: 'fake',
        input_length: rawProblem.length,
        clarification_required: false,
        clarification_answer_count: 0,
      },
    })
    expect(JSON.stringify(eventInput)).not.toContain(rawProblem)
    expect(JSON.stringify(eventInput)).not.toMatch(/problem|prompt|message|content/i)
  })

  it('returns user-facing problem classifications and scenario language for a clear consult', async () => {
    const rawProblem = '预算被砍后，我们需要重新排优先级并调整数据平台架构路线。'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.9,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'budget',
          label: '预算约束',
          confidence: 0.92,
          scenarioLanguage: '预算被砍，需要重新排优先级',
        },
        {
          id: 'architecture',
          label: '架构取舍',
          confidence: 0.86,
          scenarioLanguage: '技术路线需要在成本和长期能力之间取舍',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '预算被砍，需要重新排优先级',
        summary: '当前问题更像是在预算收紧后重新判断优先级和架构取舍。',
        guidance: '先明确必须保留的业务目标，再比较架构路线的成本、风险和交付窗口。',
      },
      manualBrowseHint: '也可以手动浏览工作流，直接选择更熟悉的分析路径。',
    } as never)
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-1',
      contextId: 'quick-consult-1',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    const result = (await service.startQuickConsult({
      user,
      tenantId,
      problem: rawProblem,
    })) as any

    expect(result.classification).toMatchObject({
      confidence: 0.9,
      confidenceLevel: 'high',
      primaryProblemType: 'budget',
      scenarioLanguage: {
        label: '预算被砍，需要重新排优先级',
      },
      problemTypes: [
        expect.objectContaining({ id: 'budget', label: '预算约束' }),
        expect.objectContaining({ id: 'architecture', label: '架构取舍' }),
      ],
    })
    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: expect.objectContaining({
          primaryProblemType: 'budget',
        }),
      }),
    )
    expect(dependencies.contextRepository.createContext).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        metadata: expect.objectContaining({
          confidence: 0.9,
          classification: expect.objectContaining({
            ids: ['budget', 'architecture'],
            confidence: 0.9,
            confidenceLevel: 'high',
            primaryProblemType: 'budget',
            scenarioLabel: '预算被砍，需要重新排优先级',
          }),
        }),
      }),
    )
  })

  it('passes current tenant organization context into recommendation generation and analysis', async () => {
    const rawProblem = '基于企业背景评估数据安全咨询销售切入点。'
    const dependencies = createDependencies()
    dependencies.organizationContextService.getPromptContext.mockResolvedValueOnce(
      organizationPromptContext,
    )
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.9,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'strategy',
          label: '战略取舍',
          confidence: 0.9,
          scenarioLanguage: '企业销售切入点',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '企业销售切入点',
        summary: '需要结合企业背景判断咨询建议。',
        guidance: '系统应自动应用已保存的企业背景。',
      },
    } as never)
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-with-org',
      contextId: 'quick-consult-with-org',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-with-org',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-with-org',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
      dependencies.organizationContextService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: rawProblem,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'analysis_started' }))

    expect(dependencies.organizationContextService.getPromptContext).toHaveBeenCalledWith(tenantId)
    expect(dependencies.methodRecommendationService.generateRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationContext: organizationPromptContext,
      }),
    )
    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationContext: organizationPromptContext,
      }),
    )
  })

  it('continues Quick Consult when optional organization context loading fails', async () => {
    const rawProblem = '评估咨询产品的企业销售切入点。'
    const dependencies = createDependencies()
    dependencies.organizationContextService.getPromptContext.mockRejectedValueOnce(
      new Error('context store down'),
    )
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.9,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'strategy',
          label: '战略取舍',
          confidence: 0.9,
          scenarioLanguage: '企业销售切入点',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '企业销售切入点',
        summary: '需要判断咨询建议。',
        guidance: '企业背景不可用时仍应继续。',
      },
    } as never)
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-no-org',
      contextId: 'quick-consult-no-org',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-no-org',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-no-org',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
      dependencies.organizationContextService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: rawProblem,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'analysis_started' }))
    expect(dependencies.methodRecommendationService.generateRecommendations).toHaveBeenCalledWith(
      expect.not.objectContaining({
        organizationContext: expect.anything(),
      }),
    )
  })

  it('keeps low-confidence classification on the clarification path with manual browsing guidance', async () => {
    const rawProblem = '帮我看看增长和组织问题怎么办'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'ambiguous',
      confidence: 0.42,
      providerStatus: 'not_called',
      latencyMs: 1,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      clarificationQuestions: ['你最想优先解决的是增长、效率，还是风险？'],
      problemTypes: [
        {
          id: 'strategy',
          label: '战略取舍',
          confidence: 0.46,
          scenarioLanguage: '目标方向还不够清楚，需要先收敛决策边界',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '问题边界还不够清楚',
        summary: '当前描述还不足以给出确定路径，需要先补充目标、团队或风险边界。',
        guidance: '先回答澄清问题；如果你已经知道要用哪类方法，也可以手动浏览工作流。',
      },
      manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
    } as any)
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-clarifying',
      originalProblem: rawProblem,
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: ['你最想优先解决的是增长、效率，还是风险？'],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    const result = (await service.startQuickConsult({
      user,
      tenantId,
      problem: rawProblem,
    })) as any

    expect(result).toMatchObject({
      status: 'clarification_required',
      classification: {
        confidenceLevel: 'low',
        manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
      },
    })
    expect(result.classification.scenarioLanguage.summary).toContain('不足以给出确定路径')
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
    expect(dependencies.contextRepository.createContext).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        metadata: expect.objectContaining({
          classification: expect.objectContaining({
            confidenceLevel: 'low',
            manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
          }),
        }),
      }),
    )
  })

  it('does not start analysis when classification confidence is low even if clarity is clear', async () => {
    const rawProblem = '我们可能要调整方向，但还没想清楚团队和预算怎么取舍'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.48,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 1,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'strategy',
          label: '战略取舍',
          confidence: 0.48,
          scenarioLanguage: '方向很多，需要先判断该押注什么',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '问题边界还不够清楚',
        summary: '当前描述还不足以给出确定路径，需要先补充目标、团队或风险边界。',
        guidance: '先回答澄清问题；如果你已经知道要用哪类方法，也可以手动浏览工作流。',
      },
      manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
    } as any)
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-low-confidence',
      originalProblem: rawProblem,
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: ['你最想优先解决的是业务增长、风险控制、效率提升，还是合规整改？'],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: rawProblem,
      }),
    ).resolves.toMatchObject({
      status: 'clarification_required',
      classification: {
        confidenceLevel: 'low',
      },
    })
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
  })

  it('emits only privacy-safe classification telemetry fields when analysis starts', async () => {
    const rawProblem = '客户 ACME 的续约预算被砍，内部要求我们压缩数据平台改造范围。'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.88,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'budget',
          label: '预算约束',
          confidence: 0.9,
          scenarioLanguage: '预算被砍，需要重新排优先级',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '预算被砍，需要重新排优先级',
        summary: '不要把原始客户描述写进事件。',
        guidance: '只记录分类 ids、数量、置信度和场景标签。',
      },
      manualBrowseHint: '也可以手动浏览工作流。',
    } as any)
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-1',
      contextId: 'quick-consult-1',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await service.startQuickConsult({
      user,
      tenantId,
      problem: rawProblem,
    })

    const eventInput = dependencies.eventService.emitAudit.mock.calls[0][0]
    expect(eventInput.metadata).toEqual(
      expect.objectContaining({
        classification_ids: ['budget'],
        classification_count: 1,
        confidence: 0.88,
        confidence_level: 'high',
        scenario_label: '预算被砍，需要重新排优先级',
        provider_status: 'fake',
      }),
    )
    expect(JSON.stringify(eventInput)).not.toContain(rawProblem)
    expect(JSON.stringify(eventInput)).not.toMatch(
      /ACME|原始客户描述|rawProblem|raw_problem|problemText|problem_text|prompt|message|content/i,
    )
  })

  it('uses bounded classification labels and hints in persisted metadata and telemetry even when analyzer text is unsafe', async () => {
    const rawProblem = '客户 ACME 的预算被砍，需要重新排优先级。'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.88,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'budget',
          label: '客户 ACME 的预算被砍',
          confidence: 0.9,
          scenarioLanguage: '客户 ACME 的预算被砍，需要重新排优先级。',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '客户 ACME 的预算被砍，需要重新排优先级。',
        summary: '客户 ACME 的原始上下文不应进入 metadata 或 telemetry。',
        guidance: '只允许 bounded label 进入治理数据。',
      },
      manualBrowseHint: 'ACME rawProblem should not be persisted as a manual browse hint.',
    } as any)
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-1',
      contextId: 'quick-consult-1',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await service.startQuickConsult({
      user,
      tenantId,
      problem: rawProblem,
    })

    const createInput = dependencies.contextRepository.createContext.mock.calls[0][1]
    const eventInput = dependencies.eventService.emitAudit.mock.calls[0][0]
    expect(createInput.metadata).toMatchObject({
      classification: {
        labels: ['预算约束'],
        scenarioLabel: '预算被砍，需要重新排优先级',
        manualBrowseHint: '也可以手动浏览工作流，直接选择更熟悉的分析路径。',
      },
    })
    expect(eventInput.metadata).toMatchObject({
      scenario_label: '预算被砍，需要重新排优先级',
    })
    expect(JSON.stringify(createInput.metadata)).not.toContain('ACME')
    expect(JSON.stringify(createInput.metadata)).not.toContain('rawProblem')
    expect(JSON.stringify(eventInput.metadata)).not.toContain('ACME')
  })

  it('continues from clarification answers and attaches them to the persisted consult context', async () => {
    const dependencies = createDependencies()
    dependencies.contextRepository.findContextForActor.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: [
        'What business decision are you trying to make?',
        'Who will use it?',
      ],
      clarificationAnswers: [],
      ...createFreshContextDates(),
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      clarificationQuestions: [
        'What business decision are you trying to make?',
        'Who will use it?',
      ],
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
        {
          question: 'Who will use it?',
          answer: 'Customer success and implementation teams.',
        },
      ],
    })
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.88,
      normalizedProblem:
        'Help me with AI. What business decision are you trying to make?: Prioritize enterprise compliance onboarding. Who will use it?: Customer success and implementation teams.',
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 4,
      originalProblemContext: {
        text: 'Help me with AI.',
        language: 'en',
      },
    })
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: '550e8400-e29b-41d4-a716-446655440001',
      contextId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 5,
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    const result = await service.startQuickConsult({
      user,
      tenantId,
      contextId: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      problem: 'Help me with AI.',
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
        {
          question: 'Who will use it?',
          answer: 'Customer success and implementation teams.',
        },
      ],
    })

    expect(dependencies.contextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      '550e8400-e29b-41d4-a716-446655440001',
      actorId,
    )
    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantId,
      '550e8400-e29b-41d4-a716-446655440001',
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisPending,
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
          {
            question: 'Who will use it?',
            answer: 'Customer success and implementation teams.',
          },
        ],
      }),
    )
    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantId,
      '550e8400-e29b-41d4-a716-446655440001',
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisStarted,
      }),
    )
    expect(result).toMatchObject({
      status: 'analysis_started',
      contextId: '550e8400-e29b-41d4-a716-446655440001',
      originalProblemContext: {
        text: 'Help me with AI.',
      },
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
        {
          question: 'Who will use it?',
          answer: 'Customer success and implementation teams.',
        },
      ],
    })
    expect(dependencies.eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          clarification_answer_count: 2,
        }),
      }),
    )
  })

  it('rejects clarification continuation when the context id is not available', async () => {
    const dependencies = createDependencies()
    dependencies.contextRepository.findContextForActor.mockResolvedValue(null)
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        problem: 'Help me with AI.',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE]),
      }),
    })
    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
    expect(dependencies.contextRepository.createContext).not.toHaveBeenCalled()
  })

  it('rejects clarification continuation that does not answer the persisted questions', async () => {
    const dependencies = createDependencies()
    dependencies.contextRepository.findContextForActor.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: [
        'What business decision are you trying to make?',
        'Who will use it?',
      ],
      clarificationAnswers: [],
      ...createFreshContextDates(),
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        problem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE]),
      }),
    })
    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
  })

  it('rejects clarification continuation with a context id but no usable answers', async () => {
    const dependencies = createDependencies()
    dependencies.contextRepository.findContextForActor.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: [
        'What business decision are you trying to make?',
        'Who will use it?',
      ],
      clarificationAnswers: [],
      ...createFreshContextDates(),
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        problem: 'Help me with AI.',
        clarificationAnswers: [{ question: '', answer: 'drop me' }],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_CLARIFICATION_INCOMPLETE_MESSAGE]),
      }),
    })
    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
    expect(dependencies.contextRepository.updateContext).not.toHaveBeenCalled()
  })

  it('rejects clarification continuation for completed or expired contexts', async () => {
    const dependencies = createDependencies()
    dependencies.contextRepository.findContextForActor.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      status: AdvisoryQuickConsultContextStatus.AnalysisStarted,
      clarificationQuestions: ['What business decision are you trying to make?'],
      clarificationAnswers: [],
      ...createFreshContextDates(),
    })
    const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000)
    dependencies.contextRepository.findContextForActor.mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      status: AdvisoryQuickConsultContextStatus.ClarificationRequired,
      clarificationQuestions: ['What business decision are you trying to make?'],
      clarificationAnswers: [],
      createdAt: expiredDate,
      updatedAt: expiredDate,
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )
    const input = {
      user,
      tenantId,
      contextId: '550e8400-e29b-41d4-a716-446655440001',
      problem: 'Help me with AI.',
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
      ],
    }

    await expect(service.startQuickConsult(input)).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE]),
      }),
    })
    await expect(service.startQuickConsult(input)).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_CONTEXT_NOT_FOUND_MESSAGE]),
      }),
    })
    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
    expect(dependencies.contextRepository.updateContext).not.toHaveBeenCalled()
  })

  it('marks the consult context failed when analysis start fails before emitting success audit', async () => {
    const rawProblem = 'Assess ISO 27001 onboarding risk for enterprise customers.'
    const dependencies = createDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.91,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'en',
      },
    })
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-1',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.analysisRunner.startAnalysis.mockRejectedValue(new Error('provider timeout'))
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: rawProblem,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.arrayContaining([THINKTANK_QUICK_CONSULT_START_FAILED_MESSAGE]),
      }),
    })

    expect(dependencies.contextRepository.createContext).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisPending,
      }),
    )
    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantId,
      'quick-consult-1',
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisFailed,
        providerStatus: 'degraded',
      }),
    )
    expect(dependencies.eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-1',
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: expect.objectContaining({
          failure_stage: 'analysis_start',
          provider_status: 'degraded',
        }),
      }),
    )
  })

  it('treats short but specific Chinese compliance problems as clear', async () => {
    const analyzer = new QuickConsultIntakeAnalyzer()

    await expect(
      analyzer.classifyProblem({
        problem: 'ISO27001整改优先级',
        tenantId,
        user,
      }),
    ).resolves.toMatchObject({
      clarity: 'clear',
      normalizedProblem: 'ISO27001整改优先级',
    })
  })

  it('classifies common strategy, innovation, architecture, team, budget, and process scenarios deterministically', async () => {
    const analyzer = new QuickConsultIntakeAnalyzer()

    const result = (await analyzer.classifyProblem({
      problem: '预算被砍后，我们要重新排优先级，调整平台架构路线，并优化跨团队交付流程。',
      tenantId,
      user,
    })) as any

    expect(result.clarity).toBe('clear')
    expect(result.problemTypes.map((problemType: { id: string }) => problemType.id)).toEqual(
      expect.arrayContaining(['budget', 'architecture', 'team', 'process']),
    )
    expect(result.scenarioLanguage.label).toMatch(/预算|优先级/)
    expect(result.confidenceLevel).toBe('high')
  })

  it('returns recommendations, persists safe recommendation metadata, and emits completed telemetry', async () => {
    const rawProblem = '预算被砍后，我们需要重新排优先级并调整数据平台架构路线。'
    const dependencies = createDependencies()
    const recommendationService = {
      generateRecommendations: jest.fn().mockResolvedValue({
        confidence: QuickConsultRecommendationConfidence.Confident,
        generatedAt: '2026-05-20T00:00:00.000Z',
        sourceRefCount: 2,
        recommendations: [
          {
            id: 'quick-consult-recommendations:problem-solving:1',
            recommendationId: 'quick-consult-recommendations:problem-solving:1',
            workflowKey: 'problem-solving',
            methodName: 'Problem Solving',
            rank: 1,
            rationale: '预算约束需要先拆清取舍。',
            primaryRationale: '预算约束需要先拆清取舍。',
            expandedRationale: '该方法适合预算约束场景。',
            fitScenario: 'Systematic diagnosis and solution design',
            durationMinutes: 35,
            expectedDuration: '25-35 minutes',
            expectedOutput: 'Root causes and options.',
            classificationRefs: ['budget'],
            sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
          },
          {
            id: 'quick-consult-recommendations:product-brief:2',
            recommendationId: 'canonical-product-brief-recommendation',
            workflowKey: 'product-brief',
            methodName: 'Product Brief',
            rank: 2,
            rationale: '预算约束需要先收敛目标和成功标准。',
            primaryRationale: '预算约束需要先收敛目标和成功标准。',
            expandedRationale: '该方法适合产品机会取舍场景。',
            fitScenario: 'Product opportunity framing',
            durationMinutes: 40,
            expectedDuration: '30-40 minutes',
            expectedOutput: 'Product framing brief.',
            classificationRefs: ['budget'],
            sourceRefs: ['workflow:product-brief', 'method:product-brief:library-1'],
          },
        ],
      }),
    } as unknown as jest.Mocked<QuickConsultMethodRecommendationService>
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.9,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'budget',
          label: '预算约束',
          confidence: 0.9,
          scenarioLanguage: '预算被砍，需要重新排优先级',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '预算被砍，需要重新排优先级',
        summary: '当前问题更像是在预算收紧后重新判断优先级。',
        guidance: '先明确必须保留的业务目标，再比较路线取舍。',
      },
      manualBrowseHint: '也可以手动浏览工作流。',
    } as any)
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-recommendations',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: 'quick-consult-recommendations',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-recommendations',
      contextId: 'quick-consult-recommendations',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      recommendationService,
    )

    const result = (await service.startQuickConsult({ user, tenantId, problem: rawProblem })) as any

    expect(result.recommendations).toEqual([
      expect.objectContaining({
        id: 'quick-consult-recommendations:problem-solving:1',
        workflowKey: 'problem-solving',
        methodName: 'Problem Solving',
      }),
      expect.objectContaining({
        id: 'quick-consult-recommendations:product-brief:2',
        workflowKey: 'product-brief',
        methodName: 'Product Brief',
      }),
    ])
    expect(result.recommendationConfidence).toBe('confident')
    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantId,
      'quick-consult-recommendations',
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisStarted,
        metadata: expect.objectContaining({
          recommendations: expect.objectContaining({
            status: 'generated',
            ids: [
              'quick-consult-recommendations:problem-solving:1',
              'canonical-product-brief-recommendation',
            ],
            workflowKeys: ['problem-solving', 'product-brief'],
            generatedAt: '2026-05-20T00:00:00.000Z',
          }),
        }),
      }),
    )
    const completedEvent = dependencies.eventService.emitAudit.mock.calls
      .map((call) => call[0])
      .find((event) => event.eventName === ThinkTankEventName.QuickConsultCompleted)
    expect(completedEvent).toEqual(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultCompleted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-recommendations',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: expect.objectContaining({
          recommendation_count: 2,
          recommendation_ids: [
            'quick-consult-recommendations:problem-solving:1',
            'canonical-product-brief-recommendation',
          ],
          top_workflow_key: 'problem-solving',
          classification_ids: ['budget'],
          confidence_level: 'high',
          provider_status: 'fake',
        }),
      }),
    )
    expect(JSON.stringify(completedEvent)).not.toContain(rawProblem)
    expect(JSON.stringify(completedEvent)).not.toMatch(
      /rawProblem|problemText|prompt|message|content|rationale|fitScenario/i,
    )
  })

  it('returns the durable persisted context id when analysis runner reports a provider context id', async () => {
    const dependencies = createDependencies()
    const rawProblem = 'Assess compliance onboarding risk.'
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.9,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'en',
      },
      problemTypes: [
        {
          id: 'risk',
          label: '风险控制',
          confidence: 0.9,
          scenarioLanguage: '风险正在影响决策，需要先判断影响面和缓解路径',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '风险正在影响决策，需要先判断影响面和缓解路径',
        summary: '当前问题更像是在风险影响决策时明确缓解路径。',
        guidance: '先判断影响面，再比较缓解动作。',
      },
      manualBrowseHint: '也可以手动浏览工作流。',
    } as any)
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440036',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
      ...createFreshContextDates(),
    })
    dependencies.contextRepository.updateContext.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440036',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
      ...createFreshContextDates(),
    })
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'provider-consultation-1',
      contextId: 'provider-context-1',
      status: 'analysis_started',
      providerStatus: 'fake',
      latencyMs: 3,
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService as never,
    )

    const result = await service.startQuickConsult({ user, tenantId, problem: rawProblem })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'analysis_started',
        contextId: '550e8400-e29b-41d4-a716-446655440036',
        consultId: '550e8400-e29b-41d4-a716-446655440036',
        consultationId: 'provider-consultation-1',
      }),
    )
    expect(dependencies.eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultStarted,
        subjectId: '550e8400-e29b-41d4-a716-446655440036',
      }),
    )
  })

  it('emits failed telemetry when recommendation generation cannot complete', async () => {
    const rawProblem = '预算被砍后，我们需要重新排优先级。'
    const dependencies = createDependencies()
    const recommendationService = {
      generateRecommendations: jest
        .fn()
        .mockRejectedValue(new Error('provider copied prompt text: ACME secret')),
    } as unknown as jest.Mocked<QuickConsultMethodRecommendationService>
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.86,
      normalizedProblem: rawProblem,
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 2,
      originalProblemContext: {
        text: rawProblem,
        language: 'zh-CN',
      },
      problemTypes: [
        {
          id: 'budget',
          label: '预算约束',
          confidence: 0.86,
          scenarioLanguage: '预算被砍，需要重新排优先级',
        },
      ],
      confidenceLevel: 'high',
      scenarioLanguage: {
        label: '预算被砍，需要重新排优先级',
        summary: '当前问题更像是在预算收紧后重新判断优先级。',
        guidance: '先明确必须保留的业务目标，再比较路线取舍。',
      },
      manualBrowseHint: '也可以手动浏览工作流。',
    } as any)
    dependencies.contextRepository.createContext.mockResolvedValue({
      id: 'quick-consult-recommendation-failed',
      originalProblem: rawProblem,
      clarificationQuestions: [],
      clarificationAnswers: [],
    })
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      recommendationService,
    )

    await expect(
      service.startQuickConsult({ user, tenantId, problem: rawProblem }),
    ).rejects.toThrow(ServiceUnavailableException)

    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
    expect(dependencies.contextRepository.updateContext).toHaveBeenCalledWith(
      tenantId,
      'quick-consult-recommendation-failed',
      expect.objectContaining({
        status: AdvisoryQuickConsultContextStatus.AnalysisFailed,
        providerStatus: 'degraded',
        metadata: expect.objectContaining({
          recommendations: expect.objectContaining({
            status: 'failed',
          }),
        }),
      }),
    )
    const failedEvent = dependencies.eventService.emitAudit.mock.calls
      .map((call) => call[0])
      .find((event) => event.eventName === ThinkTankEventName.QuickConsultFailed)
    expect(failedEvent).toEqual(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-recommendation-failed',
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: expect.objectContaining({
          failure_stage: 'recommendation_generation',
          provider_status: 'degraded',
          classification_ids: ['budget'],
          confidence_level: 'high',
        }),
      }),
    )
    expect(JSON.stringify(failedEvent)).not.toContain(rawProblem)
    expect(JSON.stringify(failedEvent)).not.toContain('ACME secret')
    expect(JSON.stringify(failedEvent)).not.toMatch(
      /prompt|message|content|rawProblem|problemText|stack|rationale/i,
    )
  })
})
