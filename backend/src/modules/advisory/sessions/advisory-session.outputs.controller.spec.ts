import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { AdvisorySessionController } from './advisory-session.controller'
import { AdvisorySessionService } from './advisory-session.service'

const outputDraft = {
  id: 'output-1',
  sessionId: 'session-1',
  workflowKey: 'problem-solving',
  status: 'draft',
  title: 'Problem Solving Report Draft',
  summary: 'Live report draft for the problem-solving workflow.',
  contentMarkdown: '# Problem Solving Report Draft',
  sections: [
    {
      id: 'section-1',
      stepIndex: 1,
      heading: 'Diagnose retention',
      contentMarkdown: '[AI Generated]\n\nRetention drops after the second session.',
      aiLabel: '[AI Generated]',
      metadata: { ai_generated: true },
    },
  ],
  aiLabelMetadata: {
    visible_label: '[AI Generated]',
    ai_generated: true,
    machine_readable: true,
  },
  metadata: {
    section_count: 1,
    last_step_index: 1,
  },
}

describe('AdvisorySessionController workflow outputs (ATDD RED)', () => {
  let controller: AdvisorySessionController
  let service: jest.Mocked<
    Pick<
      AdvisorySessionService,
      | 'getSessionOutput'
      | 'listSessionOutputs'
      | 'appendOutputSection'
      | 'completeOutput'
      | 'getSessionCheckpoint'
      | 'getOutputAssetState'
      | 'submitOutputRating'
      | 'updateOutputFavorite'
    >
  >

  beforeEach(async () => {
    service = {
      getSessionOutput: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        output: outputDraft,
      }),
      listSessionOutputs: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        outputs: [outputDraft],
      }),
      appendOutputSection: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        output: outputDraft,
        section: outputDraft.sections[0],
      }),
      completeOutput: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        output: { ...outputDraft, status: 'completed' },
      }),
      getSessionCheckpoint: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        source: 'cold',
        checkpoint: {
          sessionId: 'session-1',
          workflowKey: 'problem-solving',
          workflowType: 'Problem Solving',
          currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
          conversation: {
            messageCount: 2,
            historyPointer: 'conversation_messages:session-1',
          },
          documentState: {
            outputId: 'output-1',
            status: 'draft',
            sectionCount: 1,
          },
          lastActivityAt: '2026-05-21T00:00:00.000Z',
        },
      }),
      getOutputAssetState: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        assetState: {
          outputId: 'output-1',
          rating: 4,
          feedbackTextPresent: true,
          isFavorited: false,
          updatedAt: '2026-05-21T06:00:00.000Z',
        },
      }),
      submitOutputRating: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        assetState: {
          outputId: 'output-1',
          rating: 5,
          feedbackTextPresent: true,
          isFavorited: false,
          updatedAt: '2026-05-21T06:05:00.000Z',
        },
      }),
      updateOutputFavorite: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        assetState: {
          outputId: 'output-1',
          rating: null,
          feedbackTextPresent: false,
          isFavorited: true,
          updatedAt: '2026-05-21T06:10:00.000Z',
        },
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

  test('[P0] exposes guarded backend output routes under the existing advisory controller', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdvisorySessionController)).toBe('advisory')
    expect(Reflect.getMetadata(GUARDS_METADATA, AdvisorySessionController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, TenantGuard]),
    )
    expect(Reflect.getMetadata(PATH_METADATA, controller.getOutput)).toBe(
      'sessions/:sessionId/output',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.getOutput)).toBe(RequestMethod.GET)
    expect(Reflect.getMetadata(PATH_METADATA, controller.appendOutputSection)).toBe(
      'sessions/:sessionId/output/sections',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.appendOutputSection)).toBe(
      RequestMethod.POST,
    )
    expect(Reflect.getMetadata(PATH_METADATA, controller.completeOutput)).toBe(
      'sessions/:sessionId/output/complete',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.completeOutput)).toBe(RequestMethod.POST)
    expect(Reflect.getMetadata(PATH_METADATA, controller.getCheckpoint)).toBe(
      'sessions/:sessionId/checkpoint',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.getCheckpoint)).toBe(RequestMethod.GET)
    expect(Reflect.getMetadata(PATH_METADATA, controller.getOutputAssetState)).toBe(
      'sessions/:sessionId/output/state',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.getOutputAssetState)).toBe(
      RequestMethod.GET,
    )
    expect(Reflect.getMetadata(PATH_METADATA, controller.submitOutputRating)).toBe(
      'sessions/:sessionId/output/rating',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.submitOutputRating)).toBe(
      RequestMethod.PUT,
    )
    expect(Reflect.getMetadata(PATH_METADATA, controller.updateOutputFavorite)).toBe(
      'sessions/:sessionId/output/favorite',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, controller.updateOutputFavorite)).toBe(
      RequestMethod.PUT,
    )
  })

  test('[P0] returns the current session output in a ThinkTank-owned data envelope', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.getOutput('session-1', undefined, user as never, 'tenant-1'),
    ).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        output: outputDraft,
      },
    })
    expect(service.getSessionOutput).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })
  })

  test('[P0] forwards only the safe outputId query when reading a specific history report', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.getOutput('session-1', ' output-1 ', user as never, 'tenant-1'),
    ).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        output: outputDraft,
      },
    })
    expect(service.getSessionOutput).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      outputId: 'output-1',
    })
  })

  test('[P0] appends an output section without accepting tenant or direct output ownership from the request body', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.appendOutputSection(
        'session-1',
        {
          tenantId: 'attacker-tenant',
          outputId: 'attacker-output',
          stepIndex: 1,
          stepLabel: 'Diagnose retention',
          contentMarkdown: 'Retention drops after the second session.',
          sourceMessageId: 'assistant-message-1',
          providerMetadata: {
            provider: 'fake',
            model: 'fake-thinktank-model',
            rawPrompt: 'do not relay',
          },
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: expect.objectContaining({
        sessionId: 'session-1',
        output: expect.objectContaining({
          sections: [expect.objectContaining({ aiLabel: '[AI Generated]' })],
        }),
      }),
    })

    expect(service.appendOutputSection).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      stepIndex: 1,
      stepLabel: 'Diagnose retention',
      contentMarkdown: 'Retention drops after the second session.',
      sourceMessageId: 'assistant-message-1',
      providerMetadata: {
        provider: 'fake',
        model: 'fake-thinktank-model',
      },
    })
  })

  test('[P0] completes the active output draft without relaying raw report content from the request body', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.completeOutput(
        'session-1',
        {
          tenantId: 'attacker-tenant',
          outputId: 'attacker-output',
          outcome: 'success',
          contentMarkdown: 'raw report body should not be accepted here',
          sections: [{ contentMarkdown: 'raw section should not be accepted here' }],
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        output: expect.objectContaining({ status: 'completed' }),
      },
    })

    expect(service.completeOutput).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      outcome: 'success',
    })
    expect(JSON.stringify(service.completeOutput.mock.calls[0][0])).not.toMatch(
      /raw report|raw section|attacker-tenant|attacker-output/i,
    )
  })

  test('[P0] returns the latest checkpoint summary without accepting tenant from request body', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(controller.getCheckpoint('session-1', user as never, 'tenant-1')).resolves.toEqual(
      {
        data: expect.objectContaining({
          sessionId: 'session-1',
          source: 'cold',
          checkpoint: expect.objectContaining({
            workflowKey: 'problem-solving',
            documentState: expect.objectContaining({
              outputId: 'output-1',
              sectionCount: 1,
            }),
          }),
        }),
      },
    )

    expect(service.getSessionCheckpoint).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
    })
  })

  test('[P0][4.4-BE-013][AC1,AC4] forwards rating bodies through a safe whitelist only', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.submitOutputRating(
        'session-1',
        {
          tenantId: 'attacker-tenant',
          actorId: 'attacker-actor',
          sessionId: 'attacker-session',
          outputId: ' output-1 ',
          rating: 5,
          feedbackText: '  高管摘要很有帮助  ',
          contentMarkdown: 'raw report text must not be forwarded',
          sections: [{ contentMarkdown: 'raw section text must not be forwarded' }],
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        assetState: expect.objectContaining({
          outputId: 'output-1',
          rating: 5,
          feedbackTextPresent: true,
        }),
      },
    })

    expect(service.submitOutputRating).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      outputId: 'output-1',
      rating: 5,
      feedbackText: '高管摘要很有帮助',
    })
    expect(JSON.stringify(service.submitOutputRating.mock.calls[0][0])).not.toMatch(
      /attacker|raw report|raw section|contentMarkdown|sections/i,
    )
  })

  test('[P0][4.4-BE-014][AC2,AC4] forwards favorite updates without browser-owned scope', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.updateOutputFavorite(
        'session-1',
        {
          tenantId: 'attacker-tenant',
          actorId: 'attacker-actor',
          outputId: ' output-1 ',
          isFavorited: true,
          title: 'raw title should not be accepted',
        } as never,
        user as never,
        'tenant-1',
      ),
    ).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        assetState: expect.objectContaining({
          outputId: 'output-1',
          isFavorited: true,
          rating: null,
        }),
      },
    })

    expect(service.updateOutputFavorite).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      outputId: 'output-1',
      isFavorited: true,
    })
    expect(JSON.stringify(service.updateOutputFavorite.mock.calls[0][0])).not.toMatch(
      /attacker|raw title/i,
    )
  })

  test('[P0][4.4-BE-015][AC2,AC4] reads output asset state by outputId query only', async () => {
    const user = { id: 'user-1', organizationId: 'org-1' }

    await expect(
      controller.getOutputAssetState('session-1', ' output-1 ', user as never, 'tenant-1'),
    ).resolves.toEqual({
      data: {
        sessionId: 'session-1',
        assetState: expect.objectContaining({
          outputId: 'output-1',
          rating: 4,
          isFavorited: false,
        }),
      },
    })

    expect(service.getOutputAssetState).toHaveBeenCalledWith({
      user,
      tenantId: 'tenant-1',
      sessionId: 'session-1',
      outputId: 'output-1',
    })
  })
})
