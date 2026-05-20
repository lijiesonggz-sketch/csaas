import { BadRequestException } from '@nestjs/common'
import { AdvisoryQuickConsultContext } from '../../../database/entities/advisory-quick-consult-context.entity'
import { QuickConsultRecommendationFeedbackService } from './quick-consult-recommendation-feedback.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const contextId = '550e8400-e29b-41d4-a716-446655440035'
const rawProblem = 'ACME raw problem should never appear in telemetry.'
const normalizedProblem = 'Normalized ACME raw problem should never appear in telemetry.'
const feedbackText = '推荐有帮助，但希望更明确解释预算和合规的取舍。'

const user = {
  id: actorId,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
  role: 'consultant',
}

const recommendationIds = [`${contextId}:problem-solving:1`, `${contextId}:product-brief:2`]
const workflowKeys = ['problem-solving', 'product-brief']

function createQuickConsultContext(): AdvisoryQuickConsultContext {
  return {
    id: contextId,
    tenantId,
    actorId,
    originalProblem: rawProblem,
    normalizedProblem,
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
        ids: recommendationIds,
        workflowKeys,
        generatedAt: '2026-05-20T14:00:00.000Z',
        sourceRefCount: 4,
      },
    },
    createdAt: new Date('2026-05-20T14:00:00.000Z'),
    updatedAt: new Date('2026-05-20T14:01:00.000Z'),
  } as unknown as AdvisoryQuickConsultContext
}

function createDependencies(
  context: AdvisoryQuickConsultContext | null = createQuickConsultContext(),
) {
  const feedbackRepository = {
    findFeedbackForContext: jest.fn().mockResolvedValue(null),
    createFeedback: jest
      .fn()
      .mockImplementation(async (_tenantId: string, data: Record<string, unknown>) => ({
        id: 'feedback-35',
        tenantId: _tenantId,
        ...data,
        createdAt: new Date('2026-05-20T14:02:00.000Z'),
      })),
  }
  const contextRepository = {
    findContextForActor: jest.fn().mockResolvedValue(context),
  }
  const eventService = {
    emitTelemetry: jest.fn().mockResolvedValue(undefined),
  }

  return {
    service: new QuickConsultRecommendationFeedbackService(
      contextRepository as never,
      feedbackRepository as never,
      eventService as never,
    ),
    feedbackRepository,
    contextRepository,
    eventService,
  }
}

describe('QuickConsultRecommendationFeedbackService', () => {
  it('saves recommendation feedback with server-owned tenant, actor, problem type, recommendation ids, and timestamp', async () => {
    const { service, feedbackRepository, contextRepository, eventService } = createDependencies()

    const result = await service.submitRecommendationFeedback({
      user,
      tenantId,
      quickConsultContextId: contextId,
      rating: 5,
      feedbackText,
      recommendationIds,
    })

    expect(contextRepository.findContextForActor).toHaveBeenCalledWith(tenantId, contextId, actorId)
    expect(feedbackRepository.findFeedbackForContext).toHaveBeenCalledWith(
      tenantId,
      actorId,
      contextId,
    )
    expect(feedbackRepository.createFeedback).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        actorId,
        quickConsultContextId: contextId,
        rating: 5,
        feedbackText,
        problemTypeIds: ['budget', 'compliance'],
        primaryProblemType: 'budget',
        recommendationIds,
        workflowKeys,
        metadata: expect.objectContaining({
          recommendationConfidence: 'confident',
          feedbackTextLength: feedbackText.length,
          sourceRefCount: 4,
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 'feedback-35',
        quickConsultContextId: contextId,
        rating: 5,
        recommendationIds,
        workflowKeys,
        createdAt: expect.any(Date),
      }),
    )

    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'thinktank.recommendation.feedback_submitted',
        tenantId,
        actorId,
        subjectType: 'quick_consult',
        subjectId: contextId,
        metadata: expect.objectContaining({
          rating: 5,
          feedbackTextPresent: true,
          feedbackTextLength: feedbackText.length,
          problemTypeIds: ['budget', 'compliance'],
          primaryProblemType: 'budget',
          recommendationIds,
          recommendationCount: 2,
          workflowKeys,
        }),
      }),
    )
    const telemetry = JSON.stringify(eventService.emitTelemetry.mock.calls)
    expect(telemetry).not.toContain(rawProblem)
    expect(telemetry).not.toContain(normalizedProblem)
    expect(telemetry).not.toContain(feedbackText)
  })

  it('rejects invalid or missing ratings without creating default feedback', async () => {
    const { service, feedbackRepository, eventService } = createDependencies()

    for (const rating of [undefined, null, 0, 3.5, 6, '5']) {
      await expect(
        service.submitRecommendationFeedback({
          user,
          tenantId,
          quickConsultContextId: contextId,
          rating,
        }),
      ).rejects.toThrow(BadRequestException)
    }

    expect(feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('rejects over-limit feedback text in the service layer before persistence', async () => {
    const { service, feedbackRepository, eventService } = createDependencies()

    await expect(
      service.submitRecommendationFeedback({
        user,
        tenantId,
        quickConsultContextId: contextId,
        rating: 4,
        feedbackText: 'x'.repeat(2001),
      }),
    ).rejects.toThrow(BadRequestException)

    expect(feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('rejects contexts that are not owned by the current tenant and actor', async () => {
    const { service, feedbackRepository, contextRepository, eventService } =
      createDependencies(null)

    await expect(
      service.submitRecommendationFeedback({
        user,
        tenantId,
        quickConsultContextId: contextId,
        rating: 4,
      }),
    ).rejects.toThrow(BadRequestException)

    expect(contextRepository.findContextForActor).toHaveBeenCalledWith(tenantId, contextId, actorId)
    expect(feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('rejects browser-supplied recommendation ids that are not in the server-owned recommendation set', async () => {
    const { service, feedbackRepository, eventService } = createDependencies()

    await expect(
      service.submitRecommendationFeedback({
        user,
        tenantId,
        quickConsultContextId: contextId,
        rating: 4,
        recommendationIds: [`${contextId}:fake-workflow:99`],
      }),
    ).rejects.toThrow(BadRequestException)

    expect(feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('treats browser-supplied recommendation ids as hints and persists the full server-owned set', async () => {
    const { service, feedbackRepository, eventService } = createDependencies()

    await service.submitRecommendationFeedback({
      user,
      tenantId,
      quickConsultContextId: contextId,
      rating: 4,
      recommendationIds: [recommendationIds[0]],
    })

    expect(feedbackRepository.createFeedback).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        recommendationIds,
        workflowKeys,
      }),
    )
    expect(eventService.emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          recommendationIds,
          workflowKeys,
          recommendationCount: 2,
        }),
      }),
    )
  })

  it('returns existing feedback for duplicate submissions without creating another record or telemetry event', async () => {
    const { service, feedbackRepository, eventService } = createDependencies()
    const existingFeedback = {
      id: 'feedback-existing',
      tenantId,
      actorId,
      quickConsultContextId: contextId,
      rating: 3,
      recommendationIds,
      workflowKeys,
      createdAt: new Date('2026-05-20T14:02:00.000Z'),
    }
    feedbackRepository.findFeedbackForContext.mockResolvedValue(existingFeedback)

    await expect(
      service.submitRecommendationFeedback({
        user,
        tenantId,
        quickConsultContextId: contextId,
        rating: 5,
        feedbackText,
        recommendationIds,
      }),
    ).resolves.toBe(existingFeedback)

    expect(feedbackRepository.createFeedback).not.toHaveBeenCalled()
    expect(eventService.emitTelemetry).not.toHaveBeenCalled()
  })

  it('returns saved feedback even when telemetry emission fails after persistence', async () => {
    const { service, feedbackRepository, eventService } = createDependencies()
    eventService.emitTelemetry.mockRejectedValue(new Error('audit backend unavailable'))

    await expect(
      service.submitRecommendationFeedback({
        user,
        tenantId,
        quickConsultContextId: contextId,
        rating: 5,
        feedbackText,
        recommendationIds,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'feedback-35',
        rating: 5,
      }),
    )

    expect(feedbackRepository.createFeedback).toHaveBeenCalledTimes(1)
    expect(eventService.emitTelemetry).toHaveBeenCalledTimes(1)
  })
})
