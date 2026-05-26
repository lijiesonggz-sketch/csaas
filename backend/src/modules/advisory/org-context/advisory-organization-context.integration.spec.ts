import { AdvisoryQuickConsultContextStatus } from '../../../database/entities/advisory-quick-consult-context.entity'
import {
  QuickConsultAnalysisRunner,
  QuickConsultIntakeAnalyzer,
  QuickConsultService,
} from '../quick-consult/quick-consult.service'
import { QuickConsultMethodRecommendationService } from '../quick-consult/quick-consult-method-recommendation.service'
import { ThinkTankWorkflowParserService } from '../runtime/workflow-parser.service'
import { AdvisorySessionService } from '../sessions/advisory-session.service'

const tenantA = '660e8400-e29b-41d4-a716-446655440000'
const tenantB = '111e8400-e29b-41d4-a716-446655440000'
const actorA = '770e8400-e29b-41d4-a716-446655440000'
const organizationContextId = '990e8400-e29b-41d4-a716-446655440036'
const user = {
  id: actorA,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
  role: 'consultant',
}

const organizationPromptContext = {
  contextId: organizationContextId,
  organizationName: 'Tenant A Security Group',
  industry: 'Data security',
  size: '201-500',
  completenessScore: 100,
  completeness: {
    requiredFieldsComplete: true,
    missingFields: [],
    updatedAt: '2026-05-20T15:33:04.000Z',
  },
}

function createQuickConsultDependencies() {
  return {
    accessService: {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    },
    intakeAnalyzer: {
      classifyProblem: jest.fn().mockResolvedValue({
        clarity: 'clear',
        confidence: 0.92,
        confidenceLevel: 'high',
        originalProblemContext: {
          text: 'Assess ISO 27001 remediation priorities.',
          language: 'en',
        },
        normalizedProblem: 'Assess ISO 27001 remediation priorities.',
        provider: 'fake',
        providerStatus: 'fake',
        latencyMs: 12,
        problemTypes: [
          {
            id: 'compliance',
            label: '合规整改',
            confidence: 0.92,
            scenarioLanguage: '合规要求临近，需要明确整改范围和优先级',
          },
        ],
        primaryProblemType: 'compliance',
        scenarioLanguage: {
          label: '合规要求临近，需要明确整改范围和优先级',
          summary: '需要比较整改范围、优先级和业务影响。',
          guidance: '先厘清涉及系统、审计要求和整改成本。',
        },
      }),
    } as unknown as jest.Mocked<QuickConsultIntakeAnalyzer>,
    analysisRunner: {
      startAnalysis: jest.fn().mockResolvedValue({
        consultationId: 'quick-consult-36',
        contextId: 'quick-consult-36',
        status: 'analysis_started',
        provider: 'fake',
        providerStatus: 'fake',
        latencyMs: 14,
        analysisWindowMinutes: 5,
      }),
    } as unknown as jest.Mocked<QuickConsultAnalysisRunner>,
    eventService: {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    },
    contextRepository: {
      findContextForActor: jest.fn().mockResolvedValue(null),
      createContext: jest.fn().mockResolvedValue({
        id: 'quick-consult-36',
        originalProblem: 'Assess ISO 27001 remediation priorities.',
        normalizedProblem: 'Assess ISO 27001 remediation priorities.',
        status: AdvisoryQuickConsultContextStatus.AnalysisPending,
      }),
      updateContext: jest.fn().mockResolvedValue({
        id: 'quick-consult-36',
        originalProblem: 'Assess ISO 27001 remediation priorities.',
        normalizedProblem: 'Assess ISO 27001 remediation priorities.',
        status: AdvisoryQuickConsultContextStatus.AnalysisStarted,
      }),
    },
    methodRecommendationService: {
      generateRecommendations: jest.fn().mockResolvedValue({
        confidence: 'confident',
        generatedAt: '2026-05-20T15:33:04.000Z',
        sourceRefCount: 4,
        recommendations: [
          {
            recommendationId: 'quick-consult-36:problem-solving:1',
            workflowKey: 'problem-solving',
            classificationRefs: ['compliance'],
          },
          {
            recommendationId: 'quick-consult-36:domain-research:2',
            workflowKey: 'domain-research',
            classificationRefs: ['compliance'],
          },
        ],
      }),
    } as unknown as jest.Mocked<QuickConsultMethodRecommendationService>,
    organizationContextService: {
      getPromptContext: jest.fn().mockResolvedValue(organizationPromptContext),
    },
  }
}

function createWorkflowDependencies() {
  const workflow = {
    key: 'design-thinking',
    displayName: 'Design Thinking',
    scenarioLabel: 'Improve customer onboarding',
    sourcePath: '_bmad/runtime/design-thinking/workflow.md',
    firstPromptSource: '_bmad/runtime/design-thinking/steps/step-01.md',
    methodLibraryPaths: [],
    agentSourcePaths: [],
    description: 'Design thinking workflow',
  }

  return {
    accessService: {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    },
    workflowRegistry: {
      discoverWorkflows: jest.fn().mockResolvedValue([workflow]),
      findWorkflow: jest.fn().mockResolvedValue(workflow),
    },
    promptAssembler: {
      assemblePrompt: jest.fn().mockResolvedValue({
        workflow,
        visiblePrompt: 'Static ThinkTank workflow prompt.',
        sourceRefs: [workflow.sourcePath, workflow.firstPromptSource],
        sources: [
          {
            relativePath: workflow.sourcePath,
            content: '# workflow',
            contentHash: 'workflow-hash',
            extension: '.md',
            modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
          },
          {
            relativePath: workflow.firstPromptSource,
            content: 'Start design thinking safely.',
            contentHash: 'step-hash',
            extension: '.md',
            modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
          },
        ],
      }),
    },
    sessionRepository: {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn(async (_tenantId: string, input: Record<string, unknown>) => ({
        id: 'workflow-session-36',
        tenantId: _tenantId,
        actorId: input.actorId,
        workflowKey: input.workflowKey,
        currentStep: input.currentStep,
        metadata: input.metadata,
      })),
    },
    eventService: {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    },
    organizationContextService: {
      getPromptContext: jest.fn().mockResolvedValue(organizationPromptContext),
    },
  }
}

describe('Advisory organization context integration', () => {
  it('loads current tenant organization context into Quick Consult and stores only a safe marker', async () => {
    const dependencies = createQuickConsultDependencies()
    const service = new QuickConsultService(
      dependencies.accessService as never,
      dependencies.intakeAnalyzer,
      dependencies.analysisRunner,
      dependencies.eventService as never,
      dependencies.contextRepository as never,
      dependencies.methodRecommendationService,
      dependencies.organizationContextService as never,
    )

    const result = await service.startQuickConsult({
      user,
      tenantId: tenantA,
      problem: 'Assess ISO 27001 remediation priorities.',
    })

    expect(dependencies.organizationContextService.getPromptContext).toHaveBeenCalledWith(tenantA)
    expect(dependencies.organizationContextService.getPromptContext).not.toHaveBeenCalledWith(
      tenantB,
    )
    expect(dependencies.analysisRunner.startAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        actorId: actorA,
        organizationContext: organizationPromptContext,
      }),
    )
    const finalUpdatePayload = dependencies.contextRepository.updateContext.mock.calls.at(-1)?.[2]
    expect(finalUpdatePayload.metadata).toEqual(
      expect.objectContaining({
        organizationContext: {
          applied: true,
          contextId: organizationContextId,
          completenessScore: 100,
          requiredFieldsComplete: true,
          missingFields: [],
        },
      }),
    )
    expect(JSON.stringify(finalUpdatePayload)).not.toContain('Tenant B Holdings')
    expect(result).toEqual(expect.objectContaining({ status: 'analysis_started' }))
  })

  it('loads current tenant organization context into workflow launch prompt and metadata', async () => {
    const dependencies = createWorkflowDependencies()
    const service = new AdvisorySessionService(
      dependencies.accessService as never,
      dependencies.workflowRegistry as never,
      dependencies.promptAssembler as never,
      dependencies.sessionRepository as never,
      dependencies.eventService as never,
      undefined,
      undefined,
      undefined,
      undefined,
      new ThinkTankWorkflowParserService(),
      dependencies.organizationContextService as never,
    )

    const result = await service.launchWorkflow({
      user,
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
          organization_context_id: organizationContextId,
          organization_context_completeness_score: 100,
        }),
      }),
    )
    expect(result.firstPrompt).toContain('已加载企业背景')
    expect(result.firstPrompt).not.toContain('Organization Context')
    expect(result.firstPrompt).not.toContain('Tenant A Security Group')
    expect(result.firstPrompt).not.toContain('Data security')
    expect(result.firstPrompt).not.toContain('Tenant B Holdings')

    const launchInput = dependencies.sessionRepository.createLaunchSession.mock.calls[0][1]
    const providerPrompt = await (
      service as unknown as {
        createProviderPromptContext(session: {
          tenantId: string
          actorId: string
          workflowKey: string
          currentStep: unknown
          metadata: Record<string, unknown>
        }): Promise<{ system: string }>
      }
    ).createProviderPromptContext({
      tenantId: tenantA,
      actorId: actorA,
      workflowKey: 'design-thinking',
      currentStep: launchInput.currentStep,
      metadata: launchInput.metadata as Record<string, unknown>,
    })
    expect(providerPrompt.system).toContain('Organization Context')
    expect(providerPrompt.system).toContain('Tenant A Security Group')
    expect(providerPrompt.system).toContain('Data security')
    expect(providerPrompt.system).not.toContain('Tenant B Holdings')
  })
})
