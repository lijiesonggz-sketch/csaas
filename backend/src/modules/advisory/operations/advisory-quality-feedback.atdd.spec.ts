export {}

const serviceModulePath = './advisory-quality-feedback.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const otherTenantId = '111e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const dateFrom = '2026-05-01T00:00:00.000Z'
const dateTo = '2026-05-22T23:59:59.999Z'

type RecommendationFeedbackRow = {
  id: string
  tenantId: string
  actorId: string
  rating: number
  feedbackText: string | null
  primaryProblemType: string | null
  recommendationIds: string[]
  workflowKeys: string[]
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

type OutputRatingRow = {
  id: string
  tenantId: string
  actorId: string
  outputId: string
  sessionId: string
  rating: number | null
  feedbackText: string | null
  metadata: Record<string, unknown>
  ratedAt: Date | null
  createdAt: Date
  updatedAt: Date
  workflowKey?: string | null
}

function recommendationFeedback(
  id: string,
  overrides: Partial<RecommendationFeedbackRow> = {},
): RecommendationFeedbackRow {
  return {
    id,
    tenantId,
    actorId,
    rating: 5,
    feedbackText: null,
    primaryProblemType: 'budget',
    recommendationIds: ['rec-1'],
    workflowKeys: ['problem-solving'],
    metadata: {},
    createdAt: new Date('2026-05-10T08:00:00.000Z'),
    updatedAt: new Date('2026-05-10T08:00:00.000Z'),
    ...overrides,
  }
}

function outputRating(id: string, overrides: Partial<OutputRatingRow> = {}): OutputRatingRow {
  return {
    id,
    tenantId,
    actorId,
    outputId: `output-${id}`,
    sessionId: `session-${id}`,
    rating: 4,
    feedbackText: null,
    metadata: {},
    ratedAt: new Date('2026-05-11T08:00:00.000Z'),
    createdAt: new Date('2026-05-11T08:00:00.000Z'),
    updatedAt: new Date('2026-05-11T08:00:00.000Z'),
    workflowKey: 'problem-solving',
    ...overrides,
  }
}

async function createService(options: {
  recommendationFeedbackRows?: RecommendationFeedbackRow[]
  outputRatingRows?: OutputRatingRow[]
  recommendationError?: Error
  outputError?: Error
}) {
  const { AdvisoryQualityFeedbackService } = await import(serviceModulePath)
  const recommendationFeedbackSource = {
    findForQualityAggregation: jest.fn().mockImplementation(() => {
      if (options.recommendationError) throw options.recommendationError
      return Promise.resolve(options.recommendationFeedbackRows ?? [])
    }),
  }
  const outputRatingSource = {
    findForQualityAggregation: jest.fn().mockImplementation(() => {
      if (options.outputError) throw options.outputError
      return Promise.resolve(options.outputRatingRows ?? [])
    }),
  }

  return {
    service: new AdvisoryQualityFeedbackService(recommendationFeedbackSource, outputRatingSource),
    recommendationFeedbackSource,
    outputRatingSource,
  }
}

describe('Story 6.4 quality feedback aggregation backend ATDD', () => {
  test('[P0][6.4-BE-001][AC1,AC3] aggregates recommendation feedback by workflow recommendation type tenant and date range', async () => {
    const { service, recommendationFeedbackSource } = await createService({
      recommendationFeedbackRows: [
        recommendationFeedback('rec-feedback-1', {
          rating: 5,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving', 'product-brief'],
          feedbackText: 'PRIVATE_feedback_should_not_return',
        }),
        recommendationFeedback('rec-feedback-2', {
          rating: 2,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          feedbackText: 'raw prompt conversation report content',
          createdAt: new Date('2026-05-12T08:00:00.000Z'),
        }),
        recommendationFeedback('rec-feedback-3', {
          rating: 1,
          primaryProblemType: 'compliance',
          workflowKeys: ['domain-research'],
          createdAt: new Date('2026-05-16T08:00:00.000Z'),
        }),
        recommendationFeedback('foreign-tenant', {
          tenantId: otherTenantId,
          rating: 1,
          workflowKeys: ['problem-solving'],
        }),
        recommendationFeedback('out-of-window', {
          rating: 1,
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-04-01T08:00:00.000Z'),
        }),
      ],
      outputRatingRows: [],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(recommendationFeedbackSource.findForQualityAggregation).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
      }),
    )
    expect(result.appliedFilters.tenantId).toBe(tenantId)
    expect(result.summary.recommendationRatings).toEqual(
      expect.objectContaining({
        sampleSize: 3,
        averageRating: 2.6667,
        lowQualityCount: 2,
        lowQualityRate: 0.6667,
        feedbackTextPresentCount: 2,
        feedbackTextWithheldCount: 2,
      }),
    )
    expect(result.summary.recommendationRatings.distribution).toEqual(
      expect.objectContaining({ 1: 1, 2: 1, 5: 1 }),
    )
    expect(result.byWorkflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowKey: 'problem-solving',
          sampleSize: 2,
          lowQualityCount: 1,
        }),
        expect.objectContaining({ workflowKey: 'product-brief', sampleSize: 1 }),
        expect.objectContaining({
          workflowKey: 'domain-research',
          sampleSize: 1,
          lowQualityCount: 1,
        }),
      ]),
    )
    expect(result.byRecommendationType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recommendationType: 'budget',
          sampleSize: 2,
          averageRating: 3.5,
          lowQualityCount: 1,
        }),
        expect.objectContaining({
          recommendationType: 'compliance',
          sampleSize: 1,
          averageRating: 1,
          lowQualityCount: 1,
        }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_feedback|raw prompt|conversation|report content/i,
    )
  })

  test('[P0][6.4-BE-002][AC1,AC3] aggregates output ratings by workflow using existing workflow output metadata', async () => {
    const { service, outputRatingSource } = await createService({
      recommendationFeedbackRows: [],
      outputRatingRows: [
        outputRating('1', {
          outputId: 'output-1',
          sessionId: 'session-1',
          rating: 4,
          feedbackText: 'PRIVATE_report_feedback',
          workflowKey: 'problem-solving',
        }),
        outputRating('2', {
          outputId: 'output-2',
          sessionId: 'session-2',
          rating: 2,
          workflowKey: 'product-brief',
          ratedAt: new Date('2026-05-13T08:00:00.000Z'),
        }),
        outputRating('3', {
          outputId: 'output-3',
          sessionId: 'session-3',
          rating: 1,
          workflowKey: 'product-brief',
          ratedAt: null,
          updatedAt: new Date('2026-05-15T08:00:00.000Z'),
        }),
        outputRating('foreign', { tenantId: otherTenantId, rating: 1 }),
      ],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(outputRatingSource.findForQualityAggregation).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, dateFrom: new Date(dateFrom), dateTo: new Date(dateTo) }),
    )
    expect(result.summary.outputRatings).toEqual(
      expect.objectContaining({
        sampleSize: 3,
        averageRating: 2.3333,
        lowQualityCount: 2,
        lowQualityRate: 0.6667,
        feedbackTextPresentCount: 1,
        feedbackTextWithheldCount: 1,
      }),
    )
    expect(result.byWorkflow).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowKey: 'problem-solving',
          outputSampleSize: 1,
          averageRating: 4,
        }),
        expect.objectContaining({
          workflowKey: 'product-brief',
          outputSampleSize: 2,
          averageRating: 1.5,
          lowQualityCount: 2,
        }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_report_feedback|report content/i)
  })

  test('[P0][6.4-BE-003][AC2] highlights low quality affected categories and trend direction', async () => {
    const { service } = await createService({
      recommendationFeedbackRows: [
        recommendationFeedback('previous-high-1', {
          rating: 5,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-02T08:00:00.000Z'),
        }),
        recommendationFeedback('previous-high-2', {
          rating: 4,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-04T08:00:00.000Z'),
        }),
        recommendationFeedback('current-low-1', {
          rating: 2,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-13T08:00:00.000Z'),
        }),
        recommendationFeedback('current-low-2', {
          rating: 1,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-16T08:00:00.000Z'),
        }),
        recommendationFeedback('current-low-3', {
          rating: 2,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-18T08:00:00.000Z'),
        }),
        recommendationFeedback('current-healthy', {
          rating: 5,
          primaryProblemType: 'compliance',
          workflowKeys: ['domain-research'],
          createdAt: new Date('2026-05-18T08:00:00.000Z'),
        }),
      ],
      outputRatingRows: [],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(result.lowQualityTrends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'recommendation_feedback',
          workflowKey: 'problem-solving',
          recommendationType: 'budget',
          direction: 'up',
          currentLowQualityRate: 1,
          previousLowQualityRate: 0,
        }),
      ]),
    )
    expect(result.lowQualityTrends).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowKey: 'domain-research',
          recommendationType: 'compliance',
        }),
      ]),
    )
    expect(JSON.stringify(result.lowQualityTrends)).not.toMatch(
      /PRIVATE_|raw.*(feedback|prompt|conversation|report)/i,
    )
  })

  test('[P1][6.4-BE-004][AC1,AC2] reports instrumentation gaps for missing metadata and malformed ratings', async () => {
    const { service } = await createService({
      recommendationFeedbackRows: [
        recommendationFeedback('valid-feedback', { rating: 5, workflowKeys: ['problem-solving'] }),
        recommendationFeedback('missing-workflow', { rating: 4, workflowKeys: [] }),
        recommendationFeedback('missing-category', { rating: 4, primaryProblemType: null }),
        recommendationFeedback('malformed-metadata', { rating: 4, metadata: 'broken' as never }),
        recommendationFeedback('bad-rating', { rating: 6 }),
      ],
      outputRatingRows: [
        outputRating('valid-output', { rating: 5, workflowKey: 'problem-solving' }),
        outputRating('orphaned-output', { rating: 4, workflowKey: null }),
        outputRating('favorite-only', { rating: null, workflowKey: 'problem-solving' }),
        outputRating('malformed-output-metadata', {
          rating: 4,
          workflowKey: 'problem-solving',
          metadata: 'broken' as never,
        }),
        outputRating('bad-output-rating', { rating: 0, workflowKey: 'product-brief' }),
      ],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(result.summary.recommendationRatings.sampleSize).toBe(2)
    expect(result.summary.outputRatings.sampleSize).toBe(2)
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'missing_workflow_key' }),
        expect.objectContaining({ reason: 'missing_recommendation_category' }),
        expect.objectContaining({ reason: 'orphaned_output_rating' }),
        expect.objectContaining({ reason: 'out_of_range_rating' }),
        expect.objectContaining({ reason: 'missing_output_workflow_metadata' }),
        expect.objectContaining({ reason: 'malformed_metadata' }),
      ]),
    )
    expect(result.instrumentationGaps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'out_of_range_rating', count: 2 }),
      ]),
    )
    expect(JSON.stringify(result.instrumentationGaps)).not.toMatch(
      /PRIVATE_|raw.*(feedback|prompt|conversation|report)/i,
    )
  })

  test('[P1][6.4-BE-007][AC1] honors groupBy filters without returning unrequested group arrays', async () => {
    const { service } = await createService({
      recommendationFeedbackRows: [
        recommendationFeedback('feedback-1', {
          rating: 5,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
        }),
      ],
      outputRatingRows: [outputRating('output-1', { rating: 4, workflowKey: 'problem-solving' })],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      groupBy: ['time'],
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(result.byWorkflow).toEqual([])
    expect(result.byRecommendationType).toEqual([])
    expect(result.byTenant).toEqual([])
    expect(result.byPeriod).toEqual(
      expect.arrayContaining([expect.objectContaining({ period: '2026-05-10' })]),
    )
  })

  test('[P1][6.4-BE-008][AC2] includes report output ratings and flat/down affected categories in low quality trends', async () => {
    const { service } = await createService({
      recommendationFeedbackRows: [
        recommendationFeedback('previous-low-rec', {
          rating: 1,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-02T08:00:00.000Z'),
        }),
        recommendationFeedback('current-low-rec', {
          rating: 2,
          primaryProblemType: 'budget',
          workflowKeys: ['problem-solving'],
          createdAt: new Date('2026-05-16T08:00:00.000Z'),
        }),
      ],
      outputRatingRows: [
        outputRating('previous-output-good', {
          rating: 5,
          workflowKey: 'product-brief',
          ratedAt: new Date('2026-05-02T08:00:00.000Z'),
        }),
        outputRating('current-output-low-1', {
          rating: 1,
          workflowKey: 'product-brief',
          ratedAt: new Date('2026-05-16T08:00:00.000Z'),
        }),
        outputRating('current-output-low-2', {
          rating: 2,
          workflowKey: 'product-brief',
          ratedAt: new Date('2026-05-18T08:00:00.000Z'),
        }),
      ],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(result.lowQualityTrends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'recommendation_feedback',
          workflowKey: 'problem-solving',
          recommendationType: 'budget',
          direction: 'flat',
          currentLowQualityRate: 1,
        }),
        expect.objectContaining({
          source: 'output_ratings',
          workflowKey: 'product-brief',
          recommendationType: 'report-output',
          direction: 'up',
          currentLowQualityRate: 1,
        }),
      ]),
    )
  })

  test('[P1][6.4-BE-005][AC1,AC2] returns unavailable state with null rates when quality sources fail', async () => {
    const { service } = await createService({
      recommendationError: new Error('feedback store unavailable'),
      outputRatingRows: [],
    })

    const result = await service.getQualityFeedback({
      actor: { id: actorId, tenantId },
      currentTenantId: tenantId,
      tenantId,
      dateFrom,
      dateTo,
      now: new Date('2026-05-23T00:00:00.000Z'),
    })

    expect(result.summary.measurementStatus).toBe('unavailable')
    expect(result.summary.recommendationRatings.averageRating).toBeNull()
    expect(result.summary.recommendationRatings.lowQualityRate).toBeNull()
    expect(result.summary.outputRatings.averageRating).toBeNull()
    expect(result.summary.outputRatings.lowQualityRate).toBeNull()
    expect(result.byWorkflow).toEqual([])
    expect(result.freshness).toEqual(expect.objectContaining({ status: 'unavailable' }))
    expect(result.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'quality_feedback_source_unavailable',
          source: 'recommendation_feedback',
        }),
      ]),
    )
  })

  test('[P0][6.4-BE-006][AC3] enforces service tenant scope before reading rows', async () => {
    const { service, recommendationFeedbackSource, outputRatingSource } = await createService({
      recommendationFeedbackRows: [],
      outputRatingRows: [],
    })

    await expect(
      service.getQualityFeedback({
        actor: { id: actorId, tenantId },
        currentTenantId: tenantId,
        tenantId: otherTenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow(/other tenant|无权查看其他租户/i)

    expect(recommendationFeedbackSource.findForQualityAggregation).not.toHaveBeenCalled()
    expect(outputRatingSource.findForQualityAggregation).not.toHaveBeenCalled()
  })

  test('[P0][6.4-BE-009][AC3] rejects foreign tenant scope when currentTenantId is omitted but actor tenant is present', async () => {
    const { service, recommendationFeedbackSource, outputRatingSource } = await createService({
      recommendationFeedbackRows: [],
      outputRatingRows: [],
    })

    await expect(
      service.getQualityFeedback({
        actor: { id: actorId, tenantId },
        tenantId: otherTenantId,
        dateFrom,
        dateTo,
      }),
    ).rejects.toThrow(/other tenant|无权查看其他租户/i)

    expect(recommendationFeedbackSource.findForQualityAggregation).not.toHaveBeenCalled()
    expect(outputRatingSource.findForQualityAggregation).not.toHaveBeenCalled()
  })
})
