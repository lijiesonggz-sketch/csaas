import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisorySessionController } from './advisory-session.controller'
import { AdvisorySessionService } from './advisory-session.service'

describe('AdvisorySessionController', () => {
  let controller: AdvisorySessionController
  let service: jest.Mocked<Pick<AdvisorySessionService, 'listWorkflows' | 'launchWorkflow'>>

  beforeEach(async () => {
    service = {
      listWorkflows: jest.fn().mockResolvedValue({
        workflows: [
          {
            key: 'brainstorming',
            displayName: 'Brainstorming',
            canonicalName: 'Brainstorming',
            scenarioLabel: 'Creative ideation',
          },
        ],
      }),
      launchWorkflow: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        status: 'active',
        workflow: {
          key: 'brainstorming',
          displayName: 'Brainstorming',
          canonicalName: 'Brainstorming',
          scenarioLabel: 'Creative ideation',
        },
        firstPrompt: 'Start brainstorming.',
        sourceRefs: ['_bmad/core/skills/bmad-brainstorming/workflow.md'],
        currentStep: {
          index: 1,
          label: '当前步骤',
          sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
        },
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisorySessionController],
      providers: [
        {
          provide: AdvisorySessionService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<AdvisorySessionController>(AdvisorySessionController)
  })

  it('returns workflow catalog in the standard advisory envelope using tenant context', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.getWorkflows(user as never, 'tenant-1')).resolves.toEqual({
      data: {
        workflows: [
          {
            key: 'brainstorming',
            displayName: 'Brainstorming',
            canonicalName: 'Brainstorming',
            scenarioLabel: 'Creative ideation',
          },
        ],
      },
    })
    expect(service.listWorkflows).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
    })
  })

  it('launches a workflow from the route param without accepting tenantId from request body', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.launchWorkflow(
        'brainstorming',
        {
          tenantId: 'attacker-tenant',
          quickConsultContextId: ' quick-consult-1 ',
          acceptedRecommendationId: ' recommendation-1 ',
          acceptedRecommendation: true,
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: expect.objectContaining({
        sessionId: 'session-1',
        status: 'active',
        firstPrompt: 'Start brainstorming.',
      }),
    })
    expect(service.launchWorkflow).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      workflowKey: 'brainstorming',
      quickConsultContextId: 'quick-consult-1',
      acceptedRecommendationId: 'recommendation-1',
      acceptedRecommendation: true,
      manualChoice: false,
      manualChoiceKind: undefined,
      manualChoiceId: undefined,
      manualChoiceLabel: undefined,
    })
  })

  it('passes manual launch metadata through the existing launch path and suppresses accepted fields', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await controller.launchWorkflow(
      'design-thinking',
      {
        quickConsultContextId: ' quick-consult-34 ',
        acceptedRecommendationId: 'recommendation-should-not-forward',
        acceptedRecommendation: true,
        manualChoice: true,
        manualChoiceKind: 'method',
        manualChoiceId: ' method:design-thinking:empathy-map ',
        manualChoiceLabel: ' Empathy Map ',
      } as never,
      user as never,
      'tenant-1',
    )

    expect(service.launchWorkflow).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      workflowKey: 'design-thinking',
      quickConsultContextId: 'quick-consult-34',
      acceptedRecommendationId: undefined,
      acceptedRecommendation: false,
      manualChoice: true,
      manualChoiceKind: 'method',
      manualChoiceId: 'method:design-thinking:empathy-map',
      manualChoiceLabel: 'Empathy Map',
    })
  })
})
