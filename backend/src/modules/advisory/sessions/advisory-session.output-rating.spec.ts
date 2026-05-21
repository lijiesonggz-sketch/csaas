import { BadRequestException, NotFoundException } from '@nestjs/common'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputStatus,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryWorkflowSessionStatus } from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisoryOutputRatingRepository } from '../outputs/advisory-output-rating.repository'
import { AdvisoryWorkflowOutputRepository } from '../outputs/advisory-workflow-output.repository'
import { ThinkTankProviderGatewayService } from '../provider-gateway/thinktank-provider-gateway.service'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisorySessionRepository } from './advisory-session.repository'
import { AdvisorySessionService } from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const outputId = '990e8400-e29b-41d4-a716-446655440000'

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId,
}

const activeSession = {
  id: sessionId,
  tenantId,
  actorId,
  workflowKey: 'problem-solving',
  workflowDisplayName: 'Problem Solving',
  scenarioLabel: 'Systematic diagnosis and solution design',
  status: AdvisoryWorkflowSessionStatus.Active,
  currentStep: { index: 1, label: 'Diagnose retention', sourceRef: 'current-step:1' },
  sourceRefs: ['workflow:problem-solving', 'current-step:1'],
  metadata: {},
  failureCode: null,
  failureMessage: null,
  createdAt: new Date('2026-05-21T05:00:00.000Z'),
  updatedAt: new Date('2026-05-21T05:00:00.000Z'),
}

function createOutput(overrides: Partial<AdvisoryWorkflowOutput> = {}): AdvisoryWorkflowOutput {
  return {
    id: outputId,
    tenantId,
    sessionId,
    actorId,
    workflowKey: 'problem-solving',
    status: AdvisoryWorkflowOutputStatus.Completed,
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    contentMarkdown: '# Retention Diagnosis\n\nUsers drop after setup.',
    sections: [
      {
        id: 'section-1',
        stepIndex: 1,
        heading: 'Diagnose retention',
        contentMarkdown: '[AI Generated]\n\nUsers drop after setup.',
        aiLabel: '[AI Generated]',
        metadata: { ai_generated: true },
        createdAt: '2026-05-21T05:10:00.000Z',
      },
    ],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
    },
    metadata: { section_count: 1 },
    createdAt: new Date('2026-05-21T05:00:00.000Z'),
    updatedAt: new Date('2026-05-21T05:10:00.000Z'),
    ...overrides,
  }
}

describe('AdvisorySessionService output rating and favorites', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let sessionRepository: jest.Mocked<Pick<AdvisorySessionRepository, 'findSessionById'>>
  let outputRepository: jest.Mocked<
    Pick<
      AdvisoryWorkflowOutputRepository,
      'findOutputById' | 'findActiveDraftForSession' | 'findLatestCompletedForSession'
    >
  >
  let ratingRepository: jest.Mocked<
    Pick<
      AdvisoryOutputRatingRepository,
      'upsertRating' | 'upsertFavorite' | 'findStateForOutput' | 'findStatesForOutputIds'
    >
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitTelemetry'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    sessionRepository = {
      findSessionById: jest.fn().mockResolvedValue(activeSession),
    }
    outputRepository = {
      findOutputById: jest.fn().mockResolvedValue(createOutput()),
      findActiveDraftForSession: jest.fn().mockResolvedValue(null),
      findLatestCompletedForSession: jest.fn().mockResolvedValue(createOutput()),
    }
    ratingRepository = {
      upsertRating: jest.fn().mockResolvedValue({
        outputId,
        rating: 5,
        feedbackTextPresent: true,
        isFavorited: false,
        updatedAt: '2026-05-21T06:00:00.000Z',
      }),
      upsertFavorite: jest.fn().mockResolvedValue({
        outputId,
        rating: null,
        feedbackTextPresent: false,
        isFavorited: true,
        updatedAt: '2026-05-21T06:05:00.000Z',
      }),
      findStateForOutput: jest.fn().mockResolvedValue({
        outputId,
        rating: 4,
        feedbackTextPresent: true,
        isFavorited: true,
        updatedAt: '2026-05-21T06:00:00.000Z',
      }),
      findStatesForOutputIds: jest.fn().mockResolvedValue([]),
    } as never
    eventService = {
      emitTelemetry: jest.fn().mockResolvedValue(undefined),
    }
    service = new AdvisorySessionService(
      accessService as never,
      {
        discoverWorkflows: jest.fn(),
        findWorkflow: jest.fn(),
      } as unknown as ThinkTankWorkflowRegistryService,
      { assemblePrompt: jest.fn() } as unknown as ThinkTankPromptAssemblerService,
      sessionRepository as never,
      eventService as never,
      undefined,
      {} as ThinkTankProviderGatewayService,
      outputRepository as never,
      undefined,
      undefined,
      undefined,
      undefined,
      ratingRepository as never,
    )
  })

  test('[P0][4.4-BE-007][AC1,AC3] submits a 1-5 report rating as an upsert scoped to tenant actor and output', async () => {
    await expect(
      service.submitOutputRating({
        user,
        tenantId,
        sessionId,
        outputId,
        rating: 5,
        feedbackText: '  高管摘要很有帮助  ',
      }),
    ).resolves.toEqual({
      sessionId,
      assetState: {
        outputId,
        rating: 5,
        feedbackTextPresent: true,
        isFavorited: false,
        updatedAt: '2026-05-21T06:00:00.000Z',
      },
    })

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(sessionRepository.findSessionById).toHaveBeenCalledWith(tenantId, sessionId)
    expect(outputRepository.findOutputById).toHaveBeenCalledWith(tenantId, outputId)
    expect(ratingRepository.upsertRating).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        actorId,
        sessionId,
        outputId,
        rating: 5,
        feedbackText: '高管摘要很有帮助',
        feedbackTextProvided: true,
        metadata: expect.objectContaining({ workflowKey: 'problem-solving' }),
      }),
    )
  })

  test('[P0][4.4-BE-008][AC1] emits rating telemetry without raw report content or feedback text', async () => {
    await service.submitOutputRating({
      user,
      tenantId,
      sessionId,
      outputId,
      rating: 4,
      feedbackText: 'Do not leak this feedback text.',
    })

    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.OutputRatingSubmitted,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Output,
        subjectId: outputId,
        outcome: ThinkTankEventOutcome.Success,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: expect.objectContaining({
          sessionId,
          outputId,
          workflowType: 'problem-solving',
        }),
        telemetry: expect.objectContaining({
          entityType: 'ThinkTankOutputRating',
          organizationId,
        }),
        metadata: expect.objectContaining({
          rating: 4,
          feedbackTextPresent: true,
          feedbackTextLength: 'Do not leak this feedback text.'.length,
          isFavorited: false,
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitTelemetry.mock.calls[0][0])).not.toMatch(
      /Users drop|Retention Diagnosis|Do not leak this feedback text|contentMarkdown|sections|report|document/i,
    )
  })

  test.each([undefined, null, 0, 6, 3.5, '5'])(
    '[P0][4.4-BE-009][AC1] rejects invalid rating value %p before persistence',
    async (rating) => {
      await expect(
        service.submitOutputRating({
          user,
          tenantId,
          sessionId,
          outputId,
          rating,
        }),
      ).rejects.toThrow(BadRequestException)

      expect(ratingRepository.upsertRating).not.toHaveBeenCalled()
      expect(eventService.emitTelemetry).not.toHaveBeenCalled()
    },
  )

  test('[P0][4.4-BE-010][AC2,AC3] favorites and unfavorites reports without forcing a rating', async () => {
    await expect(
      service.updateOutputFavorite({
        user,
        tenantId,
        sessionId,
        outputId,
        isFavorited: true,
      }),
    ).resolves.toEqual({
      sessionId,
      assetState: {
        outputId,
        rating: null,
        feedbackTextPresent: false,
        isFavorited: true,
        updatedAt: '2026-05-21T06:05:00.000Z',
      },
    })

    expect(ratingRepository.upsertFavorite).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        actorId,
        sessionId,
        outputId,
        isFavorited: true,
      }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.OutputFavoriteUpdated,
        metadata: expect.objectContaining({
          isFavorited: true,
          rating: null,
        }),
      }),
    )
  })

  test('[P0][4.4-BE-011][AC4] blocks direct output ids outside the current session or actor without leaking metadata', async () => {
    outputRepository.findOutputById.mockResolvedValueOnce(
      createOutput({
        id: 'foreign-output',
        sessionId: 'foreign-session',
        actorId: 'foreign-actor',
        title: 'Foreign report title',
      }),
    )

    await expect(
      service.submitOutputRating({
        user,
        tenantId,
        sessionId,
        outputId: 'foreign-output',
        rating: 5,
      }),
    ).rejects.toThrow(NotFoundException)

    expect(ratingRepository.upsertRating).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  test('[P0][4.4-BE-011A][AC4] blocks favorite and state reads for direct output ids outside the current session or actor', async () => {
    outputRepository.findOutputById.mockResolvedValue(
      createOutput({
        id: 'foreign-output',
        sessionId: 'foreign-session',
        actorId: 'foreign-actor',
        title: 'Foreign report title',
      }),
    )

    await expect(
      service.updateOutputFavorite({
        user,
        tenantId,
        sessionId,
        outputId: 'foreign-output',
        isFavorited: true,
      }),
    ).rejects.toThrow(NotFoundException)
    await expect(
      service.getOutputAssetState({
        user,
        tenantId,
        sessionId,
        outputId: 'foreign-output',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(ratingRepository.upsertFavorite).not.toHaveBeenCalled()
    expect(ratingRepository.findStateForOutput).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  test('[P0][4.4-BE-011B][AC1,AC2] requires explicit outputId for mutating report asset state', async () => {
    await expect(
      service.submitOutputRating({
        user,
        tenantId,
        sessionId,
        rating: 5,
      }),
    ).rejects.toThrow(BadRequestException)
    await expect(
      service.updateOutputFavorite({
        user,
        tenantId,
        sessionId,
        isFavorited: true,
      }),
    ).rejects.toThrow(BadRequestException)

    expect(outputRepository.findActiveDraftForSession).not.toHaveBeenCalled()
    expect(outputRepository.findLatestCompletedForSession).not.toHaveBeenCalled()
    expect(ratingRepository.upsertRating).not.toHaveBeenCalled()
    expect(ratingRepository.upsertFavorite).not.toHaveBeenCalled()
  })

  test('[P0][4.4-BE-012][AC2] attaches current user asset state when reading an authorized output', async () => {
    await expect(
      service.getSessionOutput({
        user,
        tenantId,
        sessionId,
        outputId,
      }),
    ).resolves.toEqual({
      sessionId,
      output: expect.objectContaining({
        id: outputId,
        assetState: {
          outputId,
          rating: 4,
          feedbackTextPresent: true,
          isFavorited: true,
          updatedAt: '2026-05-21T06:00:00.000Z',
        },
      }),
    })
  })
})
