import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisorySessionController } from './advisory-session.controller'
import { AdvisorySessionService } from './advisory-session.service'

describe('AdvisorySessionController guided messages', () => {
  let controller: AdvisorySessionController
  let service: jest.Mocked<
    Pick<
      AdvisorySessionService,
      'listMessages' | 'submitMessage' | 'listWorkflows' | 'launchWorkflow'
    >
  >

  beforeEach(async () => {
    service = {
      listWorkflows: jest.fn(),
      launchWorkflow: jest.fn(),
      listMessages: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        messages: [],
      }),
      submitMessage: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        messages: [],
        assistantMessage: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Here is a guided summary.',
          decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
        },
        stream: [{ index: 0, delta: 'Here is a guided summary.', done: true }],
        decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
      }),
    } as never

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

  test('[P0] returns session messages without accepting tenantId from caller input', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.getMessages('session-1', user as never, 'tenant-1')).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
        messages: [],
      },
    })
    expect(service.listMessages).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })
  })

  test('[P0] submits a user answer through the session context and returns streamed advisor data', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.submitMessage(
        'session-1',
        { content: 'We need to inspect retention drop-off.', tenantId: 'attacker-tenant' } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: expect.objectContaining({
        sessionId: 'session-1',
        assistantMessage: expect.objectContaining({
          role: 'assistant',
          content: 'Here is a guided summary.',
        }),
        stream: [expect.objectContaining({ done: true })],
      }),
    })
    expect(service.submitMessage).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      content: 'We need to inspect retention drop-off.',
      decisionAction: undefined,
    })
  })
})
