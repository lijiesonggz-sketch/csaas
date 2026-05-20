type QuickConsultUserContext = {
  id: string
  organizationId: string
  role?: string
}

type QuickConsultStartInput = {
  user: QuickConsultUserContext
  tenantId: string
  problem: string
  metadata?: Record<string, unknown>
}

const quickConsultServiceModulePath = './quick-consult.service'
const quickConsultControllerModulePath = './quick-consult.controller'
const thinkTankEventContractModulePath = '../events/thinktank-event-contract'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const bodyTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'

const user: QuickConsultUserContext = {
  id: actorId,
  organizationId,
  role: 'consultant',
}

const createServiceDependencies = () => ({
  accessService: {
    assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
  },
  intakeAnalyzer: {
    classifyProblem: jest.fn(),
  },
  analysisRunner: {
    startAnalysis: jest.fn(),
  },
  eventService: {
    emitAudit: jest.fn().mockResolvedValue(undefined),
  },
  contextRepository: {
    createContext: jest.fn(),
    findContextForActor: jest.fn().mockResolvedValue(null),
    updateContext: jest.fn(),
  },
})

const instantiateQuickConsultService = async (
  dependencies = createServiceDependencies(),
): Promise<{ service: any; dependencies: ReturnType<typeof createServiceDependencies> }> => {
  const { QuickConsultService } = await import(quickConsultServiceModulePath)

  return {
    service: new QuickConsultService(
      dependencies.accessService,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService,
      dependencies.contextRepository,
    ),
    dependencies,
  }
}

describe('QuickConsult Problem Intake API (ATDD RED)', () => {
  it.skip('[P0][3.1-API-001] rejects blank problem intake before provider or event work', async () => {
    const { service, dependencies } = await instantiateQuickConsultService()

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: '   ',
      } satisfies QuickConsultStartInput),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        message: expect.arrayContaining([expect.stringMatching(/problem.*required|empty/i)]),
      }),
    })

    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
    expect(dependencies.eventService.emitAudit).not.toHaveBeenCalled()
  })

  it.skip('[P0][3.1-API-002] rejects overlong problem intake with a deterministic validation error', async () => {
    const { service, dependencies } = await instantiateQuickConsultService()
    const overlongProblem = 'A'.repeat(5001)

    await expect(
      service.startQuickConsult({
        user,
        tenantId,
        problem: overlongProblem,
      } satisfies QuickConsultStartInput),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        message: expect.arrayContaining([expect.stringMatching(/problem.*5000|too long|max/i)]),
      }),
    })

    expect(dependencies.intakeAnalyzer.classifyProblem).not.toHaveBeenCalled()
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
    expect(dependencies.eventService.emitAudit).not.toHaveBeenCalled()
  })

  it.skip('[P0][3.1-API-003] returns one or two clarification questions for ambiguous input and preserves original problem context', async () => {
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'ambiguous',
      confidence: 0.42,
      originalProblemContext: {
        text: '我们的合规有点乱，帮我看看怎么办',
        language: 'zh-CN',
      },
      clarificationQuestions: [
        '你最担心的是审计不通过、整改成本，还是业务中断？',
        '当前涉及哪个系统或业务范围？',
      ],
    })
    const { service } = await instantiateQuickConsultService(dependencies)

    const result = await service.startQuickConsult({
      user,
      tenantId,
      problem: '我们的合规有点乱，帮我看看怎么办',
    } satisfies QuickConsultStartInput)

    expect(result).toEqual(
      expect.objectContaining({
        status: 'clarification_required',
        originalProblemContext: expect.objectContaining({
          text: '我们的合规有点乱，帮我看看怎么办',
          language: 'zh-CN',
        }),
        clarificationQuestions: expect.any(Array),
      }),
    )
    expect(result.clarificationQuestions).toHaveLength(2)
    expect(result.clarificationQuestions).toEqual(
      expect.arrayContaining([expect.stringMatching(/担心|系统|范围|目标/)]),
    )
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
  })

  it.skip('[P0][3.1-API-004] starts analysis for clear input and emits QuickConsultStarted with user and tenant context', async () => {
    const {
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      ThinkTankSubjectType,
    } = await import(thinkTankEventContractModulePath)
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.91,
      normalizedProblem:
        'Assess ISO 27001 gap remediation priorities for the customer data platform.',
      provider: 'gpt-4o-mini',
      providerStatus: 'ok',
      latencyMs: 187,
    })
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-1',
      status: 'analysis_started',
    })
    const { service } = await instantiateQuickConsultService(dependencies)

    const result = await service.startQuickConsult({
      user,
      tenantId,
      problem: '请分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。',
    } satisfies QuickConsultStartInput)

    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        organizationId,
        tenantId,
        normalizedProblem: expect.stringContaining('ISO 27001'),
      }),
    )
    expect(dependencies.eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultStarted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-1',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        consultationId: 'quick-consult-1',
        status: 'analysis_started',
      }),
    )
  })

  it.skip('[P1][3.1-API-005] records provider status and latency metadata without leaking raw problem text', async () => {
    const { ThinkTankEventName } = await import(thinkTankEventContractModulePath)
    const rawProblem = '请分析客户数据平台 ISO 27001 差距整改优先级，重点是访问控制和日志留存。'
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.88,
      normalizedProblem: 'Assess ISO 27001 remediation priorities.',
      provider: 'qwen-plus',
      providerStatus: 'degraded',
      latencyMs: 243,
    })
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-2',
      status: 'analysis_started',
    })
    const { service } = await instantiateQuickConsultService(dependencies)

    await service.startQuickConsult({
      user,
      tenantId,
      problem: rawProblem,
    } satisfies QuickConsultStartInput)

    const emittedEvent = dependencies.eventService.emitAudit.mock.calls.at(-1)?.[0]
    expect(emittedEvent).toEqual(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultStarted,
        optional: expect.objectContaining({
          provider: 'qwen-plus',
          latencyMs: 243,
        }),
        metadata: expect.objectContaining({
          provider_status: 'degraded',
          clarity: 'clear',
        }),
      }),
    )
    expect(JSON.stringify(emittedEvent)).not.toContain(rawProblem)
    expect(JSON.stringify(emittedEvent)).not.toMatch(
      /rawProblem|raw_problem|problemText|problem_text|prompt|message|content/i,
    )
  })

  it.skip('[P0][3.1-API-006] controller passes authenticated user and route tenant context and ignores body tenantId', async () => {
    const { QuickConsultController } = await import(quickConsultControllerModulePath)
    const service = {
      startQuickConsult: jest.fn().mockResolvedValue({
        consultationId: 'quick-consult-3',
        status: 'analysis_started',
      }),
    }
    const controller = new QuickConsultController(service)

    await expect(
      controller.startQuickConsult(user, tenantId, {
        tenantId: bodyTenantId,
        problem: '请分析客户数据平台 ISO 27001 差距整改优先级。',
      }),
    ).resolves.toEqual({
      data: {
        consultationId: 'quick-consult-3',
        status: 'analysis_started',
      },
    })

    expect(service.startQuickConsult).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        tenantId,
        problem: '请分析客户数据平台 ISO 27001 差距整改优先级。',
      }),
    )
    expect(service.startQuickConsult).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: bodyTenantId,
      }),
    )
  })
})

describe('QuickConsult Problem Type Detection API (ATDD RED)', () => {
  it.skip('[P0][3.2-API-001] assigns one or more problem type classifications with user-facing scenario language for strategy, innovation, architecture, team, budget, and process problems', async () => {
    // RED intent: deterministic analyzer/service output includes bounded classification ids
    // and scenario language such as "预算被砍，需要重新排优先级", not consulting method names.
  })

  it.skip('[P0][3.2-API-002] returns classification metadata in analysis_started response and passes it to the analysis runner without exposing consulting method names as the primary explanation', async () => {
    // RED intent: startQuickConsult response and runner input include classification metadata
    // while Story 3.3 remains responsible for recommendation cards.
  })

  it.skip('[P0][3.2-API-003] treats low-confidence classification as not ready for confident recommendation and offers clarification questions plus manual browsing alternatives', async () => {
    // RED intent: low confidence keeps the clarification path and exposes a manual browse hint.
  })

  it.skip('[P1][3.2-API-004] persists structured classification metadata on the tenant-scoped quick consult context after classification completes', async () => {
    // RED intent: quick_consult_contexts.metadata.classification stores ids, labels,
    // confidence, scenario label, and manual browse hint without a new table.
  })

  it.skip('[P1][3.2-API-005] emits only privacy-safe classification telemetry fields and never copies raw problem text, scenario narrative, prompt, message, or content into audit metadata', async () => {
    // RED intent: audit metadata contains only classification ids/count, confidence bucket,
    // scenario label, and provider status.
  })
})

describe('QuickConsult Method Recommendations API (ATDD RED)', () => {
  const quickConsultRawProblem =
    '预算被砍 30%，客户数据平台还要完成 ISO 27001 整改；请帮我判断架构取舍、优先级和下一步方法。'

  const highConfidenceClassification = {
    clarity: 'clear' as const,
    confidence: 0.92,
    confidenceLevel: 'high' as const,
    originalProblemContext: {
      text: quickConsultRawProblem,
      language: 'zh-CN' as const,
    },
    normalizedProblem:
      'Budget-constrained ISO 27001 platform remediation requires architecture and priority tradeoff.',
    provider: 'fake',
    providerStatus: 'fake' as const,
    latencyMs: 21,
    problemTypes: [
      {
        id: 'budget' as const,
        label: '预算约束',
        confidence: 0.92,
        scenarioLanguage: '预算被砍，需要重新排优先级',
      },
      {
        id: 'architecture' as const,
        label: '架构取舍',
        confidence: 0.87,
        scenarioLanguage: '技术路线需要在成本和长期能力之间取舍',
      },
      {
        id: 'compliance' as const,
        label: '合规整改',
        confidence: 0.8,
        scenarioLanguage: '合规要求临近，需要明确整改范围和优先级',
      },
    ],
    primaryProblemType: 'budget' as const,
    scenarioLanguage: {
      label: '预算被砍，需要重新排优先级',
      summary: '当前问题更像是在预算收紧后重新判断优先级和关键取舍。',
      guidance: '先明确必须保留的业务目标，再比较路线的成本、风险和交付窗口。',
    },
    manualBrowseHint: '也可以手动浏览工作流，直接选择更熟悉的分析路径。',
  }

  const createDurableContext = (id = 'quick-consult-context-33') => ({
    id,
    originalProblem: quickConsultRawProblem,
    normalizedProblem: highConfidenceClassification.normalizedProblem,
    clarificationQuestions: [],
    clarificationAnswers: [],
  })

  it.skip('[P0][3.3-API-001] returns two or three recommendation cards with method name, rationale, fit scenario, duration, output, and source refs', async () => {
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue(highConfidenceClassification)
    dependencies.contextRepository.createContext.mockResolvedValue(createDurableContext())
    dependencies.contextRepository.updateContext.mockResolvedValue(createDurableContext())
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-context-33',
      contextId: 'quick-consult-context-33',
      status: 'analysis_started',
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 25,
      analysisWindowMinutes: 5,
      preview: {
        nextStepLabel: 'Review recommended methods',
        estimatedDurationMinutes: 5,
      },
      classification: expect.any(Object),
    })
    const { service } = await instantiateQuickConsultService(dependencies)

    const result = await service.startQuickConsult({
      user,
      tenantId,
      problem: quickConsultRawProblem,
    } satisfies QuickConsultStartInput)

    expect(result.status).toBe('analysis_started')
    expect(result).toEqual(
      expect.objectContaining({
        contextId: 'quick-consult-context-33',
        recommendations: expect.any(Array),
      }),
    )
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2)
    expect(result.recommendations.length).toBeLessThanOrEqual(3)
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recommendationId: expect.stringMatching(/^quick-consult-context-33:/),
          workflowKey: expect.any(String),
          methodName: expect.any(String),
          rationale: expect.stringMatching(/预算|成本|优先级|tradeoff|cost/i),
          fitScenario: expect.any(String),
          durationMinutes: expect.any(Number),
          expectedOutput: expect.any(String),
          sourceRefs: expect.arrayContaining([
            expect.stringMatching(/^workflow:/),
            expect.stringMatching(/^method:/),
          ]),
        }),
      ]),
    )
    for (const recommendation of result.recommendations) {
      expect(recommendation.durationMinutes).toBeGreaterThan(0)
      expect(recommendation.durationMinutes).toBeLessThanOrEqual(120)
      expect(recommendation.sourceRefs.join(' ')).not.toMatch(/_bmad|[\\/]|prompt|content/i)
    }
  })

  it.skip('[P0][3.3-API-002] ranks recommendations deterministically from Story 3.2 classification order and confidence', async () => {
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue(highConfidenceClassification)
    dependencies.contextRepository.createContext.mockResolvedValue(createDurableContext())
    dependencies.contextRepository.updateContext.mockResolvedValue(createDurableContext())
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-context-33',
      contextId: 'quick-consult-context-33',
      status: 'analysis_started',
      classification: expect.any(Object),
    })
    const { service } = await instantiateQuickConsultService(dependencies)

    const first = await service.startQuickConsult({
      user,
      tenantId,
      problem: quickConsultRawProblem,
    })
    const second = await service.startQuickConsult({
      user,
      tenantId,
      problem: quickConsultRawProblem,
    })

    expect(
      first.recommendations.map((card: { recommendationId: string }) => card.recommendationId),
    ).toEqual(
      second.recommendations.map((card: { recommendationId: string }) => card.recommendationId),
    )
    expect(first.recommendations.map((card: { workflowKey: string }) => card.workflowKey)).toEqual([
      'problem-solving',
      'design-thinking',
      'domain-research',
    ])
    expect(
      first.recommendations.map(
        (card: { classificationRefs: string[] }) => card.classificationRefs,
      ),
    ).toEqual([['budget'], ['architecture'], ['compliance']])
    expect(first.recommendations.map((card: { rank: number }) => card.rank)).toEqual([1, 2, 3])
  })

  it.skip('[P0][3.3-API-003] returns no confident recommendation cards for low-confidence classification and keeps manual browse available', async () => {
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue({
      clarity: 'clear',
      confidence: 0.48,
      confidenceLevel: 'low',
      originalProblemContext: {
        text: '有点乱，帮我看看怎么选方法',
        language: 'zh-CN',
      },
      normalizedProblem: '有点乱，帮我看看怎么选方法',
      providerStatus: 'fake',
      latencyMs: 13,
      problemTypes: [
        {
          id: 'strategy',
          label: '战略取舍',
          confidence: 0.48,
          scenarioLanguage: '方向很多，需要先判断该押注什么',
        },
      ],
      primaryProblemType: 'strategy',
      scenarioLanguage: {
        label: '问题边界还不够清楚',
        summary: '当前描述还不足以给出确定路径，需要先补充目标、团队或风险边界。',
        guidance: '先回答澄清问题；如果你已经知道要用哪类方法，也可以手动浏览工作流。',
      },
      manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
    })
    dependencies.contextRepository.createContext.mockResolvedValue(
      createDurableContext('quick-consult-low'),
    )
    const { service } = await instantiateQuickConsultService(dependencies)

    const result = await service.startQuickConsult({
      user,
      tenantId,
      problem: '有点乱，帮我看看怎么选方法',
    } satisfies QuickConsultStartInput)

    expect(result.status).toBe('clarification_required')
    expect(result.classification.confidenceLevel).toBe('low')
    expect(result).toEqual(
      expect.objectContaining({
        recommendations: [],
        recommendationConfidence: 'none',
        manualBrowseHint: expect.stringMatching(/手动浏览/),
      }),
    )
    expect(dependencies.analysisRunner.startAnalysis).not.toHaveBeenCalled()
  })

  it.skip('[P0][3.3-API-004] emits thinktank.quick_consult.completed with privacy-safe recommendation telemetry after cards are generated', async () => {
    const {
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      ThinkTankSubjectType,
    } = await import(thinkTankEventContractModulePath)
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue(highConfidenceClassification)
    dependencies.contextRepository.createContext.mockResolvedValue(createDurableContext())
    dependencies.contextRepository.updateContext.mockResolvedValue(createDurableContext())
    dependencies.analysisRunner.startAnalysis.mockResolvedValue({
      consultationId: 'quick-consult-context-33',
      contextId: 'quick-consult-context-33',
      status: 'analysis_started',
      classification: expect.any(Object),
    })
    const { service } = await instantiateQuickConsultService(dependencies)

    await service.startQuickConsult({ user, tenantId, problem: quickConsultRawProblem })

    const completedEvent = dependencies.eventService.emitAudit.mock.calls
      .map((call) => call[0])
      .find((event) => event.eventName === ThinkTankEventName.QuickConsultCompleted)
    expect(completedEvent).toEqual(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultCompleted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-context-33',
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: expect.objectContaining({
          recommendation_count: expect.any(Number),
          recommendation_ids: expect.any(Array),
          top_workflow_key: 'problem-solving',
          classification_ids: ['budget', 'architecture', 'compliance'],
          confidence_level: 'high',
          source_ref_count: expect.any(Number),
        }),
      }),
    )
    expect(JSON.stringify(completedEvent)).not.toContain(quickConsultRawProblem)
    expect(JSON.stringify(completedEvent)).not.toMatch(
      /rawProblem|raw_problem|problemText|problem_text|prompt|message|content|rationale|fitScenario/i,
    )
  })

  it.skip('[P0][3.3-API-005] emits thinktank.quick_consult.failed with privacy-safe payload when recommendation generation cannot complete', async () => {
    const {
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      ThinkTankSubjectType,
    } = await import(thinkTankEventContractModulePath)
    const dependencies = createServiceDependencies()
    dependencies.intakeAnalyzer.classifyProblem.mockResolvedValue(highConfidenceClassification)
    dependencies.contextRepository.createContext.mockResolvedValue(createDurableContext())
    dependencies.contextRepository.updateContext.mockResolvedValue(createDurableContext())
    dependencies.analysisRunner.startAnalysis.mockRejectedValue(
      new Error('recommendation provider copied prompt text: ACME secret'),
    )
    const { service } = await instantiateQuickConsultService(dependencies)

    await expect(
      service.startQuickConsult({ user, tenantId, problem: quickConsultRawProblem }),
    ).rejects.toMatchObject({
      status: 503,
    })

    const failedEvent = dependencies.eventService.emitAudit.mock.calls
      .map((call) => call[0])
      .find((event) => event.eventName === ThinkTankEventName.QuickConsultFailed)
    expect(failedEvent).toEqual(
      expect.objectContaining({
        eventName: ThinkTankEventName.QuickConsultFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-context-33',
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: expect.objectContaining({
          failure_stage: 'recommendation_generation',
          provider_status: 'degraded',
          classification_ids: ['budget', 'architecture', 'compliance'],
          confidence_level: 'high',
        }),
      }),
    )
    expect(JSON.stringify(failedEvent)).not.toContain(quickConsultRawProblem)
    expect(JSON.stringify(failedEvent)).not.toContain('ACME secret')
    expect(JSON.stringify(failedEvent)).not.toMatch(
      /prompt|message|content|rawProblem|problemText|stack|rationale/i,
    )
  })

  it.skip('[P0][3.3-API-006] carries accepted recommendation quick consult metadata through existing workflow launch session metadata', async () => {
    const { AdvisorySessionService } = await import('../sessions/advisory-session.service')
    const { AdvisoryWorkflowSessionStatus } =
      await import('../../../database/entities/advisory-workflow-session.entity')
    const workflow = {
      key: 'problem-solving',
      displayName: 'Problem Solving workflow',
      scenarioLabel: 'Systematic diagnosis and solution design',
      sourcePath: '_bmad/cis/workflows/bmad-cis-problem-solving/workflow.md',
      supportedFileType: '.md',
      firstPromptSource: '_bmad/cis/workflows/bmad-cis-problem-solving/steps/step-01.md',
      methodLibraryPaths: ['_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv'],
      agentSourcePaths: ['_bmad/cis/agents/creative-problem-solver.md'],
      description: 'Problem solving description',
    }
    const repository = {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn(async (_tenantId, input) => ({
        id: 'session-from-recommendation',
        tenantId,
        actorId,
        workflowKey: input.workflowKey,
        workflowDisplayName: input.workflowDisplayName,
        scenarioLabel: input.scenarioLabel,
        status: input.status ?? AdvisoryWorkflowSessionStatus.Active,
        currentStep: input.currentStep,
        sourceRefs: input.sourceRefs,
        metadata: input.metadata,
        failureCode: null,
        failureMessage: null,
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      })),
    }
    const service = new AdvisorySessionService(
      { assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined) } as never,
      {
        discoverWorkflows: jest.fn(),
        findWorkflow: jest.fn().mockResolvedValue(workflow),
      } as never,
      {
        assemblePrompt: jest.fn().mockResolvedValue({
          workflow,
          visiblePrompt: 'Start from the accepted recommendation.',
          sourceRefs: [workflow.sourcePath, workflow.firstPromptSource],
          sources: [
            {
              relativePath: workflow.firstPromptSource,
              content: 'Start from the accepted recommendation.',
              contentHash: 'step-hash',
              extension: '.md',
              modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
            },
          ],
        }),
      } as never,
      repository as never,
      { emitAudit: jest.fn().mockResolvedValue(undefined) } as never,
    )

    const result = await (service as any).launchWorkflow({
      user,
      tenantId,
      workflowKey: 'problem-solving',
      quickConsultContextId: 'quick-consult-context-33',
      recommendationId: 'quick-consult-context-33:problem-solving:1',
      acceptedRecommendation: true,
    })

    expect(result.sessionId).toBe('session-from-recommendation')
    expect(repository.createLaunchSession).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        workflowKey: 'problem-solving',
        metadata: expect.objectContaining({
          workflow_key: 'problem-solving',
          quick_consult_context_id: 'quick-consult-context-33',
          recommendation_id: 'quick-consult-context-33:problem-solving:1',
          accepted_recommendation: true,
        }),
      }),
    )
  })
})

describe.skip('QuickConsult Manual Workflow and Method Browsing API (ATDD RED)', () => {
  const methodBrowseServiceModulePath = './quick-consult-method-browse.service'
  const manualBrowseContextId = 'quick-consult-context-34'
  const manualRawProblem = '预算被砍 30%，客户数据平台仍要完成 ISO 27001 整改。'
  const manualNormalizedProblem =
    'Budget-constrained ISO 27001 remediation needs workflow and method selection.'

  const manualBrowseWorkflowKeys = [
    'brainstorming',
    'domain-research',
    'market-research',
    'product-brief',
    'prd',
    'problem-solving',
    'design-thinking',
    'storytelling',
  ]

  const createManualWorkflow = (key: string, methodLibraryPaths: string[] = []) => ({
    key,
    displayName: `${key} workflow`,
    scenarioLabel: `${key} scenario label`,
    sourcePath: `_bmad/runtime/${key}/workflow.md`,
    supportedFileType: '.md' as const,
    firstPromptSource: `_bmad/runtime/${key}/steps/step-01.md`,
    methodLibraryPaths,
    agentSourcePaths: [],
    description: `${key} description`,
  })

  const manualBrowseWorkflows = [
    createManualWorkflow('brainstorming', [
      '_bmad/core/skills/bmad-brainstorming/brain-methods.csv',
    ]),
    createManualWorkflow('domain-research'),
    createManualWorkflow('market-research'),
    createManualWorkflow('product-brief'),
    createManualWorkflow('prd'),
    createManualWorkflow('problem-solving', [
      '_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv',
    ]),
    createManualWorkflow('design-thinking', [
      '_bmad/cis/workflows/bmad-cis-design-thinking/design-methods.csv',
    ]),
    createManualWorkflow('storytelling', [
      '_bmad/cis/workflows/bmad-cis-storytelling/story-types.csv',
    ]),
  ]

  const methodLibraries: Record<string, string> = {
    '_bmad/core/skills/bmad-brainstorming/brain-methods.csv': [
      'technique_name,category,description',
      'Constraint Busting,ideation,Challenge assumed limits safely.',
    ].join('\n'),
    '_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv': [
      'method_name,phase,description',
      'Root Cause Tree,diagnosis,Trace causal branches before choosing a fix.',
    ].join('\n'),
    '_bmad/cis/workflows/bmad-cis-design-thinking/design-methods.csv': [
      'name,category,description',
      'Empathy Map,discovery,Capture user pains and jobs.',
    ].join('\n'),
    '_bmad/cis/workflows/bmad-cis-storytelling/story-types.csv': [
      'name,description',
      'Stakeholder Narrative,Frame a message for sponsor alignment.',
    ].join('\n'),
  }

  const createMethodBrowseDependencies = (overrides: Record<string, unknown> = {}) => {
    const dependencies = {
      accessService: {
        assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
      },
      workflowRegistry: {
        discoverWorkflows: jest.fn().mockResolvedValue(manualBrowseWorkflows),
      },
      fileProvider: {
        load: jest.fn(async (sourcePath: string) => {
          const content = methodLibraries[sourcePath]
          if (!content) throw new Error(`Missing method library: ${sourcePath}`)

          return {
            relativePath: sourcePath,
            absolutePath: `D:/Csaas/${sourcePath}`,
            content,
            contentHash: `${sourcePath}-hash`,
            extension: '.csv' as const,
            modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
          }
        }),
      },
      workflowParser: {
        parseMethodLibrary: jest.fn((descriptor: { content: string }) => {
          const [headerLine, ...rows] = descriptor.content.trim().split(/\r?\n/)
          return { headers: headerLine.split(','), rowCount: rows.length }
        }),
      },
      eventService: {
        emitAudit: jest.fn().mockResolvedValue(undefined),
      },
    }

    return { ...dependencies, ...overrides } as any
  }

  const instantiateMethodBrowseService = async (
    dependencies = createMethodBrowseDependencies(),
  ): Promise<{ service: any; dependencies: any }> => {
    const { QuickConsultMethodBrowseService } = await import(methodBrowseServiceModulePath)

    return {
      service: new QuickConsultMethodBrowseService(
        dependencies.accessService,
        dependencies.workflowRegistry,
        dependencies.fileProvider,
        dependencies.workflowParser,
        dependencies.eventService,
      ),
      dependencies,
    }
  }

  const instantiateManualLaunchService = async (
    quickConsultContext: unknown = {
      id: manualBrowseContextId,
      tenantId,
      actorId,
      originalProblem: manualRawProblem,
      normalizedProblem: manualNormalizedProblem,
      metadata: {
        recommendations: {
          status: 'generated',
          ids: ['quick-consult-context-34:problem-solving:1'],
          workflowKeys: ['problem-solving'],
        },
      },
    },
  ) => {
    const { AdvisorySessionService } = await import('../sessions/advisory-session.service')
    const workflow = manualBrowseWorkflows.find((candidate) => candidate.key === 'design-thinking')!

    const repository = {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn(async (_tenant: string, input: any) => ({
        id: 'session-manual-design-thinking',
        tenantId,
        actorId,
        workflowKey: input.workflowKey,
        workflowDisplayName: input.workflowDisplayName,
        scenarioLabel: input.scenarioLabel,
        status: input.status ?? 'active',
        currentStep: input.currentStep,
        sourceRefs: input.sourceRefs,
        metadata: input.metadata,
        failureCode: null,
        failureMessage: null,
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      })),
    }
    const quickConsultContextRepository = {
      findContextForActor: jest.fn().mockResolvedValue(quickConsultContext),
    }
    const eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    }
    const assembler = {
      assemblePrompt: jest.fn().mockResolvedValue({
        workflow,
        visiblePrompt: 'Start design thinking safely.',
        sourceRefs: [workflow.sourcePath, workflow.firstPromptSource],
        sources: [
          {
            relativePath: workflow.firstPromptSource,
            content: 'Start design thinking safely.',
            contentHash: 'design-thinking-step-hash',
            extension: '.md',
            modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
          },
        ],
      }),
    }

    return {
      service: new AdvisorySessionService(
        { assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined) } as never,
        {
          discoverWorkflows: jest.fn(),
          findWorkflow: jest.fn().mockResolvedValue(workflow),
        } as never,
        assembler as never,
        repository as never,
        eventService as never,
        undefined,
        undefined,
        undefined,
        quickConsultContextRepository as never,
      ),
      repository,
      eventService,
      assembler,
      quickConsultContextRepository,
    }
  }

  it.skip('[P0][3.4-API-001][AC1] returns a scannable manual browse catalog with eight MVP workflows and file-driven method choices from supported CSV schemas', async () => {
    const { service, dependencies } = await instantiateMethodBrowseService()

    const result = await service.listManualBrowseCatalog({
      user,
      tenantId,
      quickConsultContextId: manualBrowseContextId,
      correlationId: 'manual-browse-correlation-1',
    })

    expect(dependencies.accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(
      user,
      tenantId,
    )
    expect(dependencies.workflowRegistry.discoverWorkflows).toHaveBeenCalledTimes(1)
    expect(result.methodCatalogStatus).toBe('available')
    expect(result.workflows).toHaveLength(8)
    expect(
      result.workflows.map((workflow: { workflowKey: string }) => workflow.workflowKey).sort(),
    ).toEqual([...manualBrowseWorkflowKeys].sort())
    expect(result.workflows[0]).toEqual(
      expect.objectContaining({
        workflowKey: expect.any(String),
        displayName: expect.any(String),
        scenarioLabel: expect.any(String),
        description: expect.any(String),
        sourceRefs: expect.arrayContaining([expect.stringMatching(/^workflow:/)]),
      }),
    )
    expect(result.methodChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'method:brainstorming:constraint-busting',
          workflowKey: 'brainstorming',
          methodName: 'Constraint Busting',
          category: 'ideation',
        }),
        expect.objectContaining({
          id: 'method:problem-solving:root-cause-tree',
          workflowKey: 'problem-solving',
          methodName: 'Root Cause Tree',
          phase: 'diagnosis',
        }),
        expect.objectContaining({
          id: 'method:design-thinking:empathy-map',
          workflowKey: 'design-thinking',
          methodName: 'Empathy Map',
          category: 'discovery',
        }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(/_bmad|\.csv|workflow\.md|prompt/i)
  })

  it.skip('[P0][3.4-API-002][AC1] controller exposes manual browse using authenticated tenant and actor context, ignoring browser-supplied tenant fields', async () => {
    const { QuickConsultController } = await import(quickConsultControllerModulePath)
    const quickConsultService = { startQuickConsult: jest.fn() }
    const methodBrowseService = {
      listManualBrowseCatalog: jest.fn().mockResolvedValue({
        workflows: [],
        methodChoices: [],
        methodCatalogStatus: 'available',
      }),
    }
    const controller = new (QuickConsultController as any)(quickConsultService, methodBrowseService)

    await expect(
      (controller as any).getManualBrowseCatalog(user, tenantId, {
        tenantId: bodyTenantId,
        actorId: 'attacker-actor',
        quickConsultContextId: ` ${manualBrowseContextId} `,
      }),
    ).resolves.toEqual({
      data: {
        workflows: [],
        methodChoices: [],
        methodCatalogStatus: 'available',
      },
    })

    expect(methodBrowseService.listManualBrowseCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        tenantId,
        quickConsultContextId: manualBrowseContextId,
      }),
    )
    expect(methodBrowseService.listManualBrowseCatalog).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: bodyTenantId }),
    )
  })

  it.skip('[P0][3.4-API-003][AC3] degrades method catalog failures into a recoverable response while preserving direct workflow selection and safe operational recording', async () => {
    const {
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      ThinkTankSubjectType,
    } = await import(thinkTankEventContractModulePath)
    const dependencies = createMethodBrowseDependencies({
      fileProvider: {
        load: jest.fn(async (sourcePath: string) => {
          throw new Error(`Cannot read ${sourcePath}; raw prompt ACME secret`)
        }),
      },
    })
    const { service } = await instantiateMethodBrowseService(dependencies)

    const result = await service.listManualBrowseCatalog({
      user,
      tenantId,
      quickConsultContextId: manualBrowseContextId,
      correlationId: 'manual-browse-correlation-1',
    })

    expect(result).toEqual(
      expect.objectContaining({
        methodCatalogStatus: 'degraded',
        recoverableMessage: expect.stringMatching(/稍后|暂时|工作流|workflow/i),
        workflows: expect.any(Array),
        methodChoices: [],
      }),
    )
    expect(result.workflows).toHaveLength(8)

    const emittedEvent = dependencies.eventService.emitAudit.mock.calls.at(-1)?.[0]
    expect(emittedEvent).toEqual(
      expect.objectContaining({
        eventName: ThinkTankEventName.MethodBrowseFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: manualBrowseContextId,
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        correlationId: 'manual-browse-correlation-1',
        metadata: expect.objectContaining({
          workflow_key_count: 8,
          method_count: 0,
          failure_category: expect.stringMatching(/method_library/i),
          runtime_status: 'degraded',
        }),
      }),
    )
    expect(JSON.stringify(emittedEvent)).not.toMatch(
      /_bmad|\.csv|raw prompt|ACME secret|prompt|content|message|path/i,
    )
  })

  it.skip('[P1][3.4-API-004][AC3] keeps manual browse recoverable when operational telemetry emission itself fails', async () => {
    const dependencies = createMethodBrowseDependencies({
      fileProvider: {
        load: jest.fn(async () => {
          throw new Error('method library parse failed with hidden prompt ACME secret')
        }),
      },
      eventService: {
        emitAudit: jest.fn().mockRejectedValue(new Error('audit sink unavailable')),
      },
    })
    const { service } = await instantiateMethodBrowseService(dependencies)

    await expect(
      service.listManualBrowseCatalog({
        user,
        tenantId,
        quickConsultContextId: manualBrowseContextId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        methodCatalogStatus: 'degraded',
        workflows: expect.any(Array),
      }),
    )
  })

  it.skip('[P0][3.4-API-005][AC2] launches a manual method choice through the existing workflow launch path without requiring accepted recommendation metadata', async () => {
    const { service, repository, eventService, quickConsultContextRepository } =
      await instantiateManualLaunchService()

    const result = await (service as any).launchWorkflow({
      user,
      tenantId,
      workflowKey: 'design-thinking',
      quickConsultContextId: manualBrowseContextId,
      manualChoice: true,
      manualChoiceKind: 'method',
      manualChoiceId: 'method:design-thinking:empathy-map',
      manualChoiceLabel: 'Empathy Map',
    })

    expect(result.sessionId).toBe('session-manual-design-thinking')
    expect(quickConsultContextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      manualBrowseContextId,
      actorId,
    )
    expect(repository.createLaunchSession).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        workflowKey: 'design-thinking',
        metadata: expect.objectContaining({
          workflow_key: 'design-thinking',
          quick_consult_context_id: manualBrowseContextId,
          manual_choice: true,
          manual_choice_kind: 'method',
          manual_choice_id: 'method:design-thinking:empathy-map',
          manual_choice_label: 'Empathy Map',
        }),
      }),
    )
    const metadata = repository.createLaunchSession.mock.calls[0][1].metadata
    expect(metadata).toEqual(
      expect.not.objectContaining({
        accepted_recommendation: true,
        recommendation_id: expect.any(String),
      }),
    )
    expect(result.firstPrompt).toContain(manualRawProblem)
    expect(result.firstPrompt).toContain(manualNormalizedProblem)
    expect(JSON.stringify(eventService.emitAudit.mock.calls)).not.toContain(manualRawProblem)
  })

  it.skip('[P0][3.4-API-006][AC2] carries manual Quick Consult context into provider prompts using metadata distinct from accepted recommendations', async () => {
    const { service, quickConsultContextRepository } = await instantiateManualLaunchService()
    const serviceAccess = service as unknown as {
      createProviderPromptContext(session: {
        tenantId: string
        actorId: string
        workflowKey: string
        currentStep: { index: number; label: string; sourceRef: string }
        metadata: Record<string, unknown>
      }): Promise<{ system: string }>
    }

    const providerPrompt = await serviceAccess.createProviderPromptContext({
      tenantId,
      actorId,
      workflowKey: 'design-thinking',
      currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
      metadata: {
        workflow_key: 'design-thinking',
        quick_consult_context_id: manualBrowseContextId,
        manual_choice: true,
        manual_choice_kind: 'method',
        manual_choice_id: 'method:design-thinking:empathy-map',
        manual_choice_label: 'Empathy Map',
      },
    })

    expect(quickConsultContextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      manualBrowseContextId,
      actorId,
    )
    expect(providerPrompt.system).toContain('Quick Consult Context')
    expect(providerPrompt.system).toContain(manualRawProblem)
    expect(providerPrompt.system).toContain(manualNormalizedProblem)
    expect(providerPrompt.system).not.toContain('Accepted Quick Consult Context')
  })

  it.skip('[P0][3.4-API-007][AC2] rejects manual Quick Consult context handoff when the context is not found for the server tenant and actor', async () => {
    const { BadRequestException } = await import('@nestjs/common')
    const { service, repository, quickConsultContextRepository } =
      await instantiateManualLaunchService(null)

    await expect(
      (service as any).launchWorkflow({
        user,
        tenantId,
        workflowKey: 'design-thinking',
        quickConsultContextId: manualBrowseContextId,
        manualChoice: true,
        manualChoiceKind: 'workflow',
        manualChoiceId: 'workflow:design-thinking',
        manualChoiceLabel: 'design-thinking workflow',
      }),
    ).rejects.toThrow(BadRequestException)

    expect(quickConsultContextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      manualBrowseContextId,
      actorId,
    )
    expect(repository.createLaunchSession).not.toHaveBeenCalled()
  })

  it.skip('[P1][3.4-API-008][AC3] registers method browse failure as an audit event and fails closed on raw-sensitive metadata', async () => {
    const {
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      ThinkTankSubjectType,
      normalizeThinkTankEvent,
    } = await import(thinkTankEventContractModulePath)

    const normalized = normalizeThinkTankEvent({
      eventName: ThinkTankEventName.MethodBrowseFailed,
      eventKind: 'audit',
      tenantId,
      actorId,
      subjectType: ThinkTankSubjectType.QuickConsult,
      subjectId: manualBrowseContextId,
      outcome: ThinkTankEventOutcome.Failure,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      metadata: {
        failureCategory: 'method_library_parse_failed',
        workflowKeyCount: 8,
        methodCount: 0,
        runtimeStatus: 'degraded',
      },
    })

    expect(normalized).toMatchObject({
      event_name: 'thinktank.method_browse.failed',
      failure_category: 'method_library_parse_failed',
      workflow_key_count: 8,
      method_count: 0,
      runtime_status: 'degraded',
    })

    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.MethodBrowseFailed,
        eventKind: 'audit',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: manualBrowseContextId,
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: {
          prompt: 'raw hidden prompt',
        },
      }),
    ).toThrow(/raw sensitive/i)
  })
})

const recommendationFeedbackServiceModulePath = './quick-consult-recommendation-feedback.service'
const recommendationFeedbackContextId = 'quick-consult-feedback-context-35'
const recommendationFeedbackRawProblem =
  'ACME raw problem: 我们的预算被砍，需要重新判断 ISO 27001 整改优先级。'
const recommendationFeedbackNormalizedProblem = '预算收紧后重新判断 ISO 27001 整改优先级。'
const recommendationFeedbackText = '推荐路径有帮助，但希望更明确区分合规整改和预算取舍。'
const recommendationFeedbackIds = [
  `${recommendationFeedbackContextId}:problem-solving:1`,
  `${recommendationFeedbackContextId}:product-brief:2`,
]
const recommendationFeedbackWorkflowKeys = ['problem-solving', 'product-brief']

const createRecommendationFeedbackContext = () => ({
  id: recommendationFeedbackContextId,
  tenantId,
  actorId,
  originalProblem: recommendationFeedbackRawProblem,
  normalizedProblem: recommendationFeedbackNormalizedProblem,
  metadata: {
    classification: {
      ids: ['budget', 'compliance'],
      labels: ['预算约束', '合规整改'],
      confidence: 0.86,
      confidenceLevel: 'high',
      primaryProblemType: 'budget',
      scenarioLabel: '预算被砍，需要重新排优先级',
    },
    recommendations: {
      status: 'generated',
      confidence: 'confident',
      ids: recommendationFeedbackIds,
      workflowKeys: recommendationFeedbackWorkflowKeys,
      generatedAt: '2026-05-20T14:00:00.000Z',
      sourceRefCount: 4,
    },
  },
  createdAt: new Date('2026-05-20T14:00:00.000Z'),
  updatedAt: new Date('2026-05-20T14:01:00.000Z'),
})

const createRecommendationFeedbackDependencies = (
  context: Record<string, unknown> | null = createRecommendationFeedbackContext(),
) => ({
  contextRepository: {
    findContextForActor: jest.fn().mockResolvedValue(context),
  },
  feedbackRepository: {
    createFeedback: jest
      .fn()
      .mockImplementation(async (_tenantId: string, data: Record<string, unknown>) => ({
        id: 'recommendation-feedback-35',
        tenantId: _tenantId,
        ...data,
        createdAt: new Date('2026-05-20T14:02:00.000Z'),
      })),
    findByContextForActor: jest.fn(),
  },
  eventService: {
    emitTelemetry: jest.fn().mockResolvedValue(undefined),
  },
})

const instantiateRecommendationFeedbackService = async (
  dependencies = createRecommendationFeedbackDependencies(),
): Promise<{
  service: any
  dependencies: ReturnType<typeof createRecommendationFeedbackDependencies>
}> => {
  const module = await import(recommendationFeedbackServiceModulePath)
  const Service = module.QuickConsultRecommendationFeedbackService

  return {
    service: new Service(
      dependencies.contextRepository,
      dependencies.feedbackRepository,
      dependencies.eventService,
    ),
    dependencies,
  }
}

describe.skip('Quick Consult Recommendation Feedback API (ATDD RED)', () => {
  it('[P0][3.5-API-001][AC1][AC3] saves a 1-5 recommendation rating with structured tenant-scoped dashboard data and privacy-safe telemetry', async () => {
    const { service, dependencies } = await instantiateRecommendationFeedbackService()

    const result = await service.submitRecommendationFeedback({
      user,
      tenantId,
      quickConsultContextId: recommendationFeedbackContextId,
      rating: 5,
      feedbackText: recommendationFeedbackText,
      recommendationIds: recommendationFeedbackIds,
      tenantIdFromBody: 'attacker-tenant',
      actorIdFromBody: 'attacker-actor',
      rawProblem: 'browser supplied raw problem must be ignored',
    })

    expect(dependencies.contextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      recommendationFeedbackContextId,
      actorId,
    )
    expect(dependencies.feedbackRepository.createFeedback).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        actorId,
        quickConsultContextId: recommendationFeedbackContextId,
        rating: 5,
        feedbackText: recommendationFeedbackText,
        problemTypeIds: ['budget', 'compliance'],
        primaryProblemType: 'budget',
        recommendationIds: recommendationFeedbackIds,
        workflowKeys: recommendationFeedbackWorkflowKeys,
        metadata: expect.objectContaining({
          recommendationConfidence: 'confident',
          feedbackTextLength: recommendationFeedbackText.length,
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 'recommendation-feedback-35',
        rating: 5,
        quickConsultContextId: recommendationFeedbackContextId,
        recommendationIds: recommendationFeedbackIds,
      }),
    )
    expect(dependencies.eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.recommendation.feedback_submitted',
        tenantId,
        actorId,
        subjectType: 'quick_consult',
        subjectId: recommendationFeedbackContextId,
        metadata: expect.objectContaining({
          rating: 5,
          feedbackTextPresent: true,
          feedbackTextLength: recommendationFeedbackText.length,
          problemTypeIds: ['budget', 'compliance'],
          primaryProblemType: 'budget',
          recommendationIds: recommendationFeedbackIds,
          recommendationCount: 2,
          workflowKeys: recommendationFeedbackWorkflowKeys,
        }),
      }),
    )

    const telemetryPayload = JSON.stringify(dependencies.eventService.emitTelemetry.mock.calls)
    expect(telemetryPayload).not.toContain(recommendationFeedbackRawProblem)
    expect(telemetryPayload).not.toContain(recommendationFeedbackNormalizedProblem)
    expect(telemetryPayload).not.toContain(recommendationFeedbackText)
  })

  it('[P0][3.5-API-002][AC2] rejects missing or invalid rating values without creating misleading default feedback', async () => {
    const { service, dependencies } = await instantiateRecommendationFeedbackService()

    for (const rating of [undefined, null, 0, 3.5, 6, '5']) {
      await expect(
        service.submitRecommendationFeedback({
          user,
          tenantId,
          quickConsultContextId: recommendationFeedbackContextId,
          rating,
        }),
      ).rejects.toMatchObject({
        status: 400,
      })
    }

    expect(dependencies.feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(dependencies.eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('[P0][3.5-API-003][AC3] rejects cross-tenant or cross-actor context access before feedback persistence or telemetry', async () => {
    const { BadRequestException } = await import('@nestjs/common')
    const dependencies = createRecommendationFeedbackDependencies(null)
    const { service } = await instantiateRecommendationFeedbackService(dependencies)

    await expect(
      service.submitRecommendationFeedback({
        user,
        tenantId,
        quickConsultContextId: recommendationFeedbackContextId,
        rating: 4,
      }),
    ).rejects.toThrow(BadRequestException)

    expect(dependencies.contextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      recommendationFeedbackContextId,
      actorId,
    )
    expect(dependencies.feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(dependencies.eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('[P0][3.5-API-004][AC3] normalizes recommendation feedback telemetry and fails closed on raw-sensitive metadata keys', async () => {
    const {
      ThinkTankEventName,
      ThinkTankEventOutcome,
      ThinkTankPrivacyClassification,
      ThinkTankSubjectType,
      normalizeThinkTankEvent,
    } = await import(thinkTankEventContractModulePath)

    const normalized = normalizeThinkTankEvent({
      eventName: ThinkTankEventName.RecommendationFeedbackSubmitted,
      eventKind: 'telemetry',
      tenantId,
      actorId,
      subjectType: ThinkTankSubjectType.QuickConsult,
      subjectId: recommendationFeedbackContextId,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      metadata: {
        rating: 4,
        feedbackTextPresent: true,
        feedbackTextLength: recommendationFeedbackText.length,
        problemTypeIds: ['budget', 'compliance'],
        primaryProblemType: 'budget',
        recommendationIds: recommendationFeedbackIds,
        recommendationCount: 2,
        workflowKeys: recommendationFeedbackWorkflowKeys,
      },
    })

    expect(normalized).toMatchObject({
      event_name: 'thinktank.recommendation.feedback_submitted',
      rating: 4,
      feedback_text_present: true,
      feedback_text_length: recommendationFeedbackText.length,
      primary_problem_type: 'budget',
      recommendation_count: 2,
    })
    expect(JSON.stringify(normalized)).not.toContain(recommendationFeedbackText)
    expect(JSON.stringify(normalized)).not.toContain(recommendationFeedbackRawProblem)

    expect(() =>
      normalizeThinkTankEvent({
        eventName: ThinkTankEventName.RecommendationFeedbackSubmitted,
        eventKind: 'telemetry',
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: recommendationFeedbackContextId,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        metadata: {
          prompt: 'raw hidden prompt',
        },
      }),
    ).toThrow(/raw sensitive/i)
  })
})
