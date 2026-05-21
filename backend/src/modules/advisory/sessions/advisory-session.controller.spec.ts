import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisorySessionController } from './advisory-session.controller'
import { AdvisorySessionService } from './advisory-session.service'

describe('AdvisorySessionController', () => {
  let controller: AdvisorySessionController
  let service: jest.Mocked<
    Pick<
      AdvisorySessionService,
      | 'listWorkflows'
      | 'launchWorkflow'
      | 'listUnfinishedSessions'
      | 'resumeSession'
      | 'listSessionHistory'
      | 'searchSessionHistory'
    >
  >

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
      listUnfinishedSessions: jest.fn().mockResolvedValue({
        sessions: [
          {
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            workflowType: 'Problem Solving',
            title: 'Retention Diagnosis',
            lastStep: { index: 2, label: 'Map constraints' },
            status: 'active',
            statusSummary: '未完成 - Map constraints',
            lastActivityAt: '2026-05-21T01:06:00.000Z',
            checkpointSource: 'hot',
          },
        ],
      }),
      resumeSession: jest.fn().mockResolvedValue({
        session: {
          sessionId: 'session-1',
          workflowKey: 'problem-solving',
          workflowType: 'Problem Solving',
          title: 'Retention Diagnosis',
          lastStep: { index: 2, label: 'Map constraints' },
          status: 'active',
          statusSummary: '未完成 - Map constraints',
          lastActivityAt: '2026-05-21T01:06:00.000Z',
          checkpointSource: 'fallback',
        },
        messages: [],
        output: null,
        checkpointSource: 'fallback',
        recoveryMessage: {
          title: '已恢复未完成会话',
          content: '已从最近保存的对话和报告草稿恢复。',
          lastStep: 'Map constraints',
          keyConclusions: [],
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        },
        recoveredState: {
          lastStep: 'Map constraints',
          messageCount: 0,
          outputSectionCount: 0,
          recoveredFrom: 'persisted-state',
        },
        missingState: ['checkpoint', 'conversation', 'document'],
      }),
      listSessionHistory: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'session-1',
            resultType: 'session',
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            workflowType: 'Problem Solving',
            title: 'Retention Diagnosis',
            summary: '未完成 - Map constraints',
            status: 'active',
            lastStep: { index: 2, label: 'Map constraints' },
            timestamp: '2026-05-21T01:06:00.000Z',
            openTarget: 'resume-session',
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      }),
      searchSessionHistory: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'output-1',
            resultType: 'output',
            sessionId: 'session-1',
            outputId: 'output-1',
            workflowKey: 'problem-solving',
            workflowType: 'Problem Solving',
            title: 'Retention Diagnosis',
            summary: 'Users drop after setup.',
            status: 'completed',
            timestamp: '2026-05-21T01:08:00.000Z',
            openTarget: 'view-output',
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
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

  it('[P0][4.2-BE-006][AC1] returns unfinished sessions in the standard envelope using tenant context', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.listUnfinishedSessions(user as never, 'tenant-1')).resolves.toEqual({
      data: {
        sessions: [
          expect.objectContaining({
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            title: 'Retention Diagnosis',
            checkpointSource: 'hot',
          }),
        ],
      },
    })
    expect(service.listUnfinishedSessions).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
    })
  })

  it('[P0][4.2-BE-007][AC2,AC3] resumes a session from the route param without accepting tenant or actor from the request body', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.resumeSession('session-1', user as never, 'tenant-1')).resolves.toEqual({
      data: expect.objectContaining({
        checkpointSource: 'fallback',
        recoveryMessage: expect.objectContaining({
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        }),
        missingState: ['checkpoint', 'conversation', 'document'],
      }),
    })
    expect(service.resumeSession).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })
  })

  it('[P0][4.3-BE-001][AC1] lists scoped session history with filters from query only', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.listSessionHistory(
        {
          q: 'retention',
          type: 'all',
          workflowKey: 'problem-solving',
          status: 'active',
          from: '2026-05-20T00:00:00.000Z',
          to: '2026-05-22T00:00:00.000Z',
          page: '1',
          limit: '20',
          tenantId: 'attacker-tenant',
          actorId: 'attacker-actor',
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: {
        items: [
          expect.objectContaining({
            resultType: 'session',
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            status: 'active',
            openTarget: 'resume-session',
          }),
        ],
        meta: { page: 1, limit: 20, total: 1 },
      },
    })
    expect(service.listSessionHistory).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      query: expect.objectContaining({
        q: 'retention',
        type: 'all',
        workflowKey: 'problem-solving',
        status: 'active',
        from: '2026-05-20T00:00:00.000Z',
        to: '2026-05-22T00:00:00.000Z',
        page: '1',
        limit: '20',
      }),
    })
    expect(JSON.stringify(service.listSessionHistory.mock.calls[0][0].query)).not.toContain(
      'attacker',
    )
  })

  it('[P0][4.3-BE-011][AC1,AC2] exposes guarded history and search routes under the advisory controller', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdvisorySessionController)).toBe('advisory')
    expect(Reflect.getMetadata(GUARDS_METADATA, AdvisorySessionController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard]),
    )
    expect(Reflect.getMetadata(PATH_METADATA, controller.listSessionHistory)).toBe(
      'sessions/history',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.listSessionHistory)).toBe(
      RequestMethod.GET,
    )
    expect(Reflect.getMetadata(PATH_METADATA, controller.searchSessionHistory)).toBe(
      'sessions/search',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.searchSessionHistory)).toBe(
      RequestMethod.GET,
    )
  })

  it('[P0][4.3-BE-002][AC2] searches history through the scoped service contract', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.searchSessionHistory(
        {
          q: 'setup guidance',
          type: 'output',
          status: 'completed',
          tenantId: 'attacker-tenant',
          actorId: 'attacker-actor',
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: {
        items: [
          expect.objectContaining({
            resultType: 'output',
            outputId: 'output-1',
            title: 'Retention Diagnosis',
            workflowType: 'Problem Solving',
            timestamp: '2026-05-21T01:08:00.000Z',
            openTarget: 'view-output',
          }),
        ],
        meta: { page: 1, limit: 20, total: 1 },
      },
    })
    expect(service.searchSessionHistory).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      query: {
        q: 'setup guidance',
        type: 'output',
        status: 'completed',
      },
    })
  })
})
