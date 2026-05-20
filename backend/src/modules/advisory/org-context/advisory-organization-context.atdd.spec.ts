/* eslint-disable @typescript-eslint/no-require-imports */
// Story 3.6 ATDD RED parking tests for backend/API organization context behavior.
// Org-context modules are intentionally required only inside skipped tests.
// Provider endpoint: TODO - new endpoint, not yet implemented: GET /advisory/organization-context
// Provider endpoint: TODO - new endpoint, not yet implemented: PUT /advisory/organization-context
export {}
/*
 * Provider Scrutiny Evidence:
 * - GET /advisory/organization-context returns { data: { context, completenessScore, completeness, appliedToPrompts } }.
 * - PUT /advisory/organization-context accepts only organizationName, industry, and size.
 * - organizationName is required and trimmed; industry and size are optional and blank values become null/absent.
 * - tenantId, actorId, contextType, completenessScore, completenessMetadata, prompt, and audit fields are server-owned.
 * - Quick Consult and workflow launch must load only the current tenant's prompt context.
 */

const orgContextControllerModulePath = './advisory-organization-context.controller'
const orgContextServiceModulePath = './advisory-organization-context.service'
const orgContextRepositoryModulePath = './advisory-organization-context.repository'
const quickConsultServiceModulePath = '../quick-consult/quick-consult.service'
const advisorySessionServiceModulePath = '../sessions/advisory-session.service'

const tenantA = '660e8400-e29b-41d4-a716-446655440000'
const tenantB = '111e8400-e29b-41d4-a716-446655440000'
const actorA = '770e8400-e29b-41d4-a716-446655440000'
const actorB = '770e8400-e29b-41d4-a716-446655440999'
const organizationIdA = '880e8400-e29b-41d4-a716-446655440000'
const orgContextIdA = '990e8400-e29b-41d4-a716-446655440036'
const quickConsultProblem =
  'Assess ISO 27001 remediation priorities for the customer data platform.'

const userA = {
  id: actorA,
  organizationId: organizationIdA,
  role: 'consultant',
}

const createEnterpriseBackground = (overrides: Record<string, unknown> = {}) => ({
  id: orgContextIdA,
  tenantId: tenantA,
  contextType: 'enterprise_background',
  contextData: {
    organizationName: 'Tenant A Security Group',
    industry: 'Data security',
    size: '201-500',
  },
  completenessScore: 100,
  completenessMetadata: {
    requiredFieldsComplete: true,
    suppliedFields: ['organizationName', 'industry', 'size'],
    missingFields: [],
    updatedAt: '2026-05-20T15:33:04.000Z',
  },
  createdAt: new Date('2026-05-20T15:30:00.000Z'),
  updatedAt: new Date('2026-05-20T15:33:04.000Z'),
  ...overrides,
})

const createPromptContext = (overrides: Record<string, unknown> = {}) => ({
  contextId: orgContextIdA,
  organizationName: 'Tenant A Security Group',
  industry: 'Data security',
  size: '201-500',
  completenessScore: 100,
  completeness: {
    requiredFieldsComplete: true,
    missingFields: [],
    updatedAt: '2026-05-20T15:33:04.000Z',
  },
  ...overrides,
})

const createFirstUseEnvelope = () => ({
  context: null,
  completenessScore: 0,
  completeness: {
    requiredFieldsComplete: false,
    missingFields: ['organizationName', 'industry', 'size'],
    updatedAt: null,
  },
  appliedToPrompts: false,
})

const createSavedEnvelope = () => ({
  id: orgContextIdA,
  organizationName: 'Tenant A Security Group',
  industry: 'Data security',
  size: '201-500',
  completenessScore: 100,
  completeness: {
    requiredFieldsComplete: true,
    missingFields: [],
    updatedAt: '2026-05-20T15:33:04.000Z',
  },
  appliedToPrompts: false,
})

const createOrgContextRepositoryMock = (record: unknown = createEnterpriseBackground()) => ({
  findEnterpriseBackground: jest.fn().mockResolvedValue(record),
  createEnterpriseBackground: jest.fn().mockImplementation(async (tenantId, data) => ({
    ...createEnterpriseBackground({ tenantId }),
    ...data,
    id: orgContextIdA,
    updatedAt: new Date('2026-05-20T15:33:04.000Z'),
  })),
  updateEnterpriseBackground: jest.fn().mockImplementation(async (tenantId, contextId, data) => ({
    ...createEnterpriseBackground({ id: contextId, tenantId }),
    ...data,
    updatedAt: new Date('2026-05-20T15:40:00.000Z'),
  })),
})

const createOrgContextService = (repository = createOrgContextRepositoryMock(null)) => {
  const { AdvisoryOrganizationContextService } = require(orgContextServiceModulePath)
  return new AdvisoryOrganizationContextService(repository, {
    assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
  })
}

const createQuickConsultDependencies = (organizationPromptContext = createPromptContext()) => ({
  accessService: {
    assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
  },
  intakeAnalyzer: {
    classifyProblem: jest.fn().mockResolvedValue({
      clarity: 'clear',
      confidence: 0.92,
      confidenceLevel: 'high',
      originalProblemContext: { text: quickConsultProblem, language: 'en' },
      normalizedProblem: 'Assess ISO 27001 remediation priorities for the customer data platform.',
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 12,
      problemTypes: [
        {
          id: 'compliance',
          label: 'Compliance remediation',
          confidence: 0.92,
          scenarioLanguage: 'Compliance deadline requires scoped remediation priorities.',
        },
      ],
      primaryProblemType: 'compliance',
      scenarioLanguage: {
        label: 'Compliance remediation priority',
        summary: 'The problem is about selecting the next remediation priorities.',
        guidance: 'Compare risk, effort, and audit impact.',
      },
    }),
  },
  analysisRunner: {
    startAnalysis: jest.fn().mockResolvedValue({
      consultationId: 'quick-consult-36',
      contextId: 'quick-consult-36',
      status: 'analysis_started',
      provider: 'fake',
      providerStatus: 'fake',
      latencyMs: 14,
      analysisWindowMinutes: 5,
      preview: {
        nextStepLabel: 'Quick Consult analysis',
        estimatedDurationMinutes: 5,
      },
    }),
  },
  eventService: {
    emitAudit: jest.fn().mockResolvedValue(undefined),
    emitTelemetry: jest.fn().mockResolvedValue(undefined),
  },
  contextRepository: {
    findContextForActor: jest.fn().mockResolvedValue(null),
    createContext: jest.fn().mockResolvedValue({
      id: 'quick-consult-36',
      originalProblem: quickConsultProblem,
      normalizedProblem: 'Assess ISO 27001 remediation priorities for the customer data platform.',
      metadata: {},
    }),
    updateContext: jest.fn().mockResolvedValue({
      id: 'quick-consult-36',
      originalProblem: quickConsultProblem,
      normalizedProblem: 'Assess ISO 27001 remediation priorities for the customer data platform.',
      metadata: {},
    }),
  },
  methodRecommendationService: {
    generateRecommendations: jest.fn().mockResolvedValue({
      confidence: 'confident',
      generatedAt: '2026-05-20T15:33:04.000Z',
      sourceRefCount: 2,
      recommendations: [
        {
          recommendationId: 'quick-consult-36:problem-solving:1',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          rationale: 'Fits compliance remediation prioritization.',
          fitScenario: 'Compliance deadline requires prioritization.',
          durationMinutes: 45,
          expectedOutput: 'Prioritized remediation plan',
          sourceRefs: ['workflow:problem-solving', 'method:prioritization'],
          classificationRefs: ['compliance'],
          rank: 1,
        },
      ],
    }),
  },
  organizationContextService: {
    getPromptContext: jest.fn().mockResolvedValue(organizationPromptContext),
  },
})

const createWorkflowLaunchDependencies = (organizationPromptContext = createPromptContext()) => {
  const workflow = {
    key: 'design-thinking',
    displayName: 'Design Thinking',
    scenarioLabel: 'Improve customer onboarding',
    description: 'Design thinking workflow',
    estimatedDurationMinutes: 60,
    steps: [],
    sourceRefs: ['workflow:design-thinking'],
  }

  return {
    accessService: {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    },
    workflowRegistry: {
      findWorkflow: jest.fn().mockResolvedValue(workflow),
      discoverWorkflows: jest.fn().mockResolvedValue([workflow]),
    },
    promptAssembler: {
      assemblePrompt: jest.fn().mockResolvedValue({
        visiblePrompt: 'Static ThinkTank workflow prompt.',
        sourceRefs: ['workflow:design-thinking'],
        sources: [
          {
            relativePath: 'workflows/design-thinking.md',
            contentHash: '0123456789abcdef0123456789abcdef',
          },
        ],
      }),
    },
    sessionRepository: {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn().mockImplementation(async (tenantId, data) => ({
        id: 'workflow-session-36',
        tenantId,
        actorId: data.actorId,
        workflowKey: data.workflowKey,
        currentStep: data.currentStep,
        metadata: data.metadata,
      })),
    },
    eventService: {
      emitAudit: jest.fn().mockResolvedValue(undefined),
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
    },
    messageRepository: {},
    providerGateway: {},
    outputRepository: {},
    quickConsultContextRepository: {
      findContextForActor: jest.fn().mockResolvedValue(null),
    },
    workflowParser: {},
    organizationContextService: {
      getPromptContext: jest.fn().mockResolvedValue(organizationPromptContext),
    },
  }
}

describe('Story 3.6 Enterprise Background Organization Context API (ATDD RED)', () => {
  test.skip('[P0][3.6-API-001][AC1][AC2][AC4] controller exposes GET and PUT through trusted tenant/user context and whitelists request fields', async () => {
    const { AdvisoryOrganizationContextController } = require(orgContextControllerModulePath)
    const service = {
      getOrganizationContext: jest.fn().mockResolvedValue(createFirstUseEnvelope()),
      upsertOrganizationContext: jest.fn().mockResolvedValue(createSavedEnvelope()),
    }
    const controller = new AdvisoryOrganizationContextController(service)

    await expect(controller.getOrganizationContext(userA, tenantA)).resolves.toEqual({
      data: createFirstUseEnvelope(),
    })

    await expect(
      controller.upsertOrganizationContext(userA, tenantA, {
        organizationName: '  Tenant A Security Group  ',
        industry: '  Data security  ',
        size: '   ',
        tenantId: tenantB,
        actorId: actorB,
        contextType: 'attacker_supplied_context_type',
        completenessScore: 100,
        completenessMetadata: { requiredFieldsComplete: true, missingFields: [] },
        prompt: 'attacker supplied prompt must be ignored',
      }),
    ).resolves.toEqual({ data: createSavedEnvelope() })

    expect(service.getOrganizationContext).toHaveBeenCalledWith({ user: userA, tenantId: tenantA })
    expect(service.upsertOrganizationContext).toHaveBeenCalledWith({
      user: userA,
      tenantId: tenantA,
      organizationName: 'Tenant A Security Group',
      industry: 'Data security',
      size: undefined,
    })
    const forwardedPayload = service.upsertOrganizationContext.mock.calls[0][0]
    expect(forwardedPayload).toEqual(expect.not.objectContaining({ tenantId: tenantB }))
    expect(forwardedPayload).toEqual(expect.not.objectContaining({ actorId: actorB }))
    expect(forwardedPayload).toEqual(
      expect.not.objectContaining({ contextType: 'attacker_supplied_context_type' }),
    )
    expect(forwardedPayload).toEqual(expect.not.objectContaining({ completenessScore: 100 }))
  })

  test.skip('[P0][3.6-API-002][AC1][AC3] service returns a first-use empty envelope for the current tenant without leaking or inferring another tenant context', async () => {
    const repository = createOrgContextRepositoryMock(null)
    const service = createOrgContextService(repository)

    const result = await service.getOrganizationContext({ user: userA, tenantId: tenantA })

    expect(repository.findEnterpriseBackground).toHaveBeenCalledWith(tenantA)
    expect(repository.findEnterpriseBackground).not.toHaveBeenCalledWith(tenantB)
    expect(result).toEqual(
      expect.objectContaining({
        context: null,
        completenessScore: 0,
        completeness: expect.objectContaining({
          requiredFieldsComplete: false,
          missingFields: expect.arrayContaining(['organizationName']),
          updatedAt: null,
        }),
        appliedToPrompts: false,
      }),
    )
    expect(JSON.stringify(result)).not.toContain(tenantB)
    expect(JSON.stringify(result)).not.toContain('Tenant B Holdings')
  })

  test.skip('[P0][3.6-API-003][AC1] service rejects missing blank whitespace-only and over-limit organizationName before repository writes', async () => {
    const repository = createOrgContextRepositoryMock(null)
    const service = createOrgContextService(repository)

    for (const organizationName of [undefined, null, '', '   ']) {
      await expect(
        service.upsertOrganizationContext({
          user: userA,
          tenantId: tenantA,
          organizationName,
          industry: 'Data security',
          size: '201-500',
        }),
      ).rejects.toMatchObject({ status: 400 })
    }

    await expect(
      service.upsertOrganizationContext({
        user: userA,
        tenantId: tenantA,
        organizationName: 'A'.repeat(501),
      }),
    ).rejects.toMatchObject({ status: 400 })

    expect(repository.createEnterpriseBackground).not.toHaveBeenCalled()
    expect(repository.updateEnterpriseBackground).not.toHaveBeenCalled()
  })

  test.skip('[P0][3.6-API-004][AC1][AC2][AC3] service creates the tenant enterprise_background record with trimmed fields and server-owned completeness metadata', async () => {
    const repository = createOrgContextRepositoryMock(null)
    const service = createOrgContextService(repository)

    const result = await service.upsertOrganizationContext({
      user: userA,
      tenantId: tenantA,
      organizationName: '  Tenant A Security Group  ',
      industry: '  Data security  ',
      size: '   ',
      tenantIdFromBody: tenantB,
      actorIdFromBody: actorB,
      contextType: 'attacker_context_type',
      completenessScore: 100,
      completenessMetadata: { requiredFieldsComplete: true },
    })

    expect(repository.createEnterpriseBackground).toHaveBeenCalledWith(
      tenantA,
      expect.objectContaining({
        contextType: 'enterprise_background',
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: 'Data security',
          size: null,
        },
        completenessScore: expect.any(Number),
        completenessMetadata: expect.objectContaining({
          requiredFieldsComplete: true,
          missingFields: expect.arrayContaining(['size']),
          suppliedFields: expect.arrayContaining(['organizationName', 'industry']),
        }),
      }),
    )
    const persistedPayload = repository.createEnterpriseBackground.mock.calls[0][1]
    expect(persistedPayload.completenessScore).toBeGreaterThan(0)
    expect(persistedPayload.completenessScore).toBeLessThan(100)
    expect(JSON.stringify(persistedPayload)).not.toContain(tenantB)
    expect(JSON.stringify(persistedPayload)).not.toContain(actorB)
    expect(JSON.stringify(persistedPayload)).not.toContain('attacker_context_type')
    expect(result).toEqual(
      expect.objectContaining({
        id: orgContextIdA,
        organizationName: 'Tenant A Security Group',
        industry: 'Data security',
        size: null,
        completenessScore: expect.any(Number),
        completeness: expect.objectContaining({
          requiredFieldsComplete: true,
          missingFields: expect.arrayContaining(['size']),
        }),
        appliedToPrompts: false,
      }),
    )
  })

  test.skip('[P0][3.6-API-005][AC3][AC4] service updates only the current tenant owned context and recomputes completeness without tenant mutation', async () => {
    const existing = createEnterpriseBackground({
      contextData: {
        organizationName: 'Tenant A Security Group',
        industry: null,
        size: null,
      },
      completenessScore: 34,
      completenessMetadata: {
        requiredFieldsComplete: true,
        suppliedFields: ['organizationName'],
        missingFields: ['industry', 'size'],
        updatedAt: '2026-05-20T15:30:00.000Z',
      },
    })
    const repository = createOrgContextRepositoryMock(existing)
    const service = createOrgContextService(repository)

    const result = await service.upsertOrganizationContext({
      user: userA,
      tenantId: tenantA,
      organizationName: ' Tenant A Security Group ',
      industry: ' Compliance ',
      size: ' 201-500 ',
      id: 'attacker-id',
      tenantIdFromBody: tenantB,
    })

    expect(repository.findEnterpriseBackground).toHaveBeenCalledWith(tenantA)
    expect(repository.updateEnterpriseBackground).toHaveBeenCalledWith(
      tenantA,
      orgContextIdA,
      expect.objectContaining({
        contextType: 'enterprise_background',
        contextData: {
          organizationName: 'Tenant A Security Group',
          industry: 'Compliance',
          size: '201-500',
        },
        completenessScore: 100,
        completenessMetadata: expect.objectContaining({
          requiredFieldsComplete: true,
          missingFields: [],
        }),
      }),
    )
    const updatePayload = repository.updateEnterpriseBackground.mock.calls[0][2]
    expect(updatePayload).toEqual(expect.not.objectContaining({ id: 'attacker-id' }))
    expect(updatePayload).toEqual(expect.not.objectContaining({ tenantId: tenantB }))
    expect(result).toEqual(
      expect.objectContaining({
        organizationName: 'Tenant A Security Group',
        industry: 'Compliance',
        size: '201-500',
        completenessScore: 100,
        completeness: expect.objectContaining({ missingFields: [] }),
      }),
    )
  })

  test.skip('[P0][3.6-API-006][AC3] repository uses BaseRepository tenant scoping for find and update and strips immutable browser-owned fields', async () => {
    const { AdvisoryOrganizationContextRepository } = require(orgContextRepositoryModulePath)
    const typeormRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: orgContextIdA, ...entity })),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    }
    const repository = new AdvisoryOrganizationContextRepository(typeormRepository)

    await repository.findEnterpriseBackground(tenantA)
    expect(typeormRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenantA,
          contextType: 'enterprise_background',
        }),
      }),
    )

    await repository.updateEnterpriseBackground(tenantA, orgContextIdA, {
      id: 'attacker-id',
      tenantId: tenantB,
      contextType: 'enterprise_background',
      contextData: { organizationName: 'Tenant A Security Group' },
      completenessScore: 34,
    })

    expect(typeormRepository.update).toHaveBeenCalledWith(
      { id: orgContextIdA, tenantId: tenantA },
      expect.not.objectContaining({ id: 'attacker-id', tenantId: tenantB }),
    )
  })

  test.skip('[P0][3.6-API-007][AC2][AC3] Quick Consult loads current tenant organization prompt context automatically and stores only a safe applied-context marker', async () => {
    const { QuickConsultService } = require(quickConsultServiceModulePath)
    const dependencies = createQuickConsultDependencies(createPromptContext())
    const service = new QuickConsultService(
      dependencies.accessService,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService,
      dependencies.contextRepository,
      dependencies.methodRecommendationService,
      dependencies.organizationContextService,
    )

    const result = await service.startQuickConsult({
      user: userA,
      tenantId: tenantA,
      problem: quickConsultProblem,
    })

    expect(dependencies.organizationContextService.getPromptContext).toHaveBeenCalledWith(tenantA)
    expect(dependencies.organizationContextService.getPromptContext).not.toHaveBeenCalledWith(
      tenantB,
    )
    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        actorId: actorA,
        organizationContext: expect.objectContaining({
          contextId: orgContextIdA,
          organizationName: 'Tenant A Security Group',
          industry: 'Data security',
          size: '201-500',
          completenessScore: 100,
        }),
      }),
    )
    const updatePayload = dependencies.contextRepository.updateContext.mock.calls.at(-1)?.[2]
    expect(updatePayload.metadata).toEqual(
      expect.objectContaining({
        organizationContext: expect.objectContaining({
          applied: true,
          contextId: orgContextIdA,
          completenessScore: 100,
        }),
      }),
    )
    expect(JSON.stringify(updatePayload)).not.toContain('Tenant B Holdings')
    expect(result).toEqual(expect.objectContaining({ status: 'analysis_started' }))
  })

  test.skip('[P0][3.6-API-008][AC2][AC3][AC4] workflow launch and provider prompt context reference only the current tenant organization context', async () => {
    const { AdvisorySessionService } = require(advisorySessionServiceModulePath)
    const dependencies = createWorkflowLaunchDependencies(createPromptContext())
    const service = new AdvisorySessionService(
      dependencies.accessService,
      dependencies.workflowRegistry,
      dependencies.promptAssembler,
      dependencies.sessionRepository,
      dependencies.eventService,
      dependencies.messageRepository,
      dependencies.providerGateway,
      dependencies.outputRepository,
      dependencies.quickConsultContextRepository,
      dependencies.workflowParser,
      dependencies.organizationContextService,
    )

    const result = await service.launchWorkflow({
      user: userA,
      tenantId: tenantA,
      workflowKey: 'design-thinking',
    })

    expect(dependencies.organizationContextService.getPromptContext).toHaveBeenCalledWith(tenantA)
    expect(dependencies.organizationContextService.getPromptContext).not.toHaveBeenCalledWith(
      tenantB,
    )
    expect(dependencies.sessionRepository.createLaunchSession).toHaveBeenCalledWith(
      tenantA,
      expect.objectContaining({
        metadata: expect.objectContaining({
          organization_context_applied: true,
          organization_context_id: orgContextIdA,
          organization_context_completeness_score: 100,
        }),
      }),
    )
    expect(result.firstPrompt).toContain('Tenant A Security Group')
    expect(result.firstPrompt).toContain('Data security')
    expect(result.firstPrompt).not.toContain('Tenant B Holdings')
    expect(
      JSON.stringify(dependencies.sessionRepository.createLaunchSession.mock.calls),
    ).not.toContain(tenantB)
  })
})
