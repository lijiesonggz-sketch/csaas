import { Repository } from 'typeorm'
import { AdvisoryOutputRating } from '../../../database/entities/advisory-output-rating.entity'
import { AdvisoryOutputRatingRepository } from './advisory-output-rating.repository'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const outputId = '990e8400-e29b-41d4-a716-446655440000'
const sessionId = '550e8400-e29b-41d4-a716-446655440000'

function createRating(overrides: Partial<AdvisoryOutputRating> = {}): AdvisoryOutputRating {
  return {
    id: 'rating-1',
    tenantId,
    actorId,
    outputId,
    sessionId,
    rating: 4,
    feedbackText: 'Useful executive summary.',
    isFavorited: false,
    ratedAt: new Date('2026-05-21T06:00:00.000Z'),
    favoritedAt: null,
    metadata: {},
    createdAt: new Date('2026-05-21T06:00:00.000Z'),
    updatedAt: new Date('2026-05-21T06:00:00.000Z'),
    ...overrides,
  }
}

describe('AdvisoryOutputRatingRepository', () => {
  let typeormRepository: jest.Mocked<Repository<AdvisoryOutputRating>>
  let repository: AdvisoryOutputRatingRepository

  beforeEach(() => {
    typeormRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as never

    repository = new AdvisoryOutputRatingRepository(typeormRepository)
  })

  test('[P0][4.4-BE-004][AC1,AC3] atomically upserts a tenant+actor+output rating instead of creating duplicates', async () => {
    const updated = createRating({
      rating: 5,
      feedbackText: 'Updated feedback.',
      isFavorited: true,
    })
    typeormRepository.query.mockResolvedValueOnce([toRawRating(updated)])

    await expect(
      repository.upsertRating(tenantId, {
        actorId,
        sessionId,
        outputId,
        rating: 5,
        feedbackText: 'Updated feedback.',
        metadata: { workflowKey: 'problem-solving' },
      }),
    ).resolves.toEqual(updated)

    expect(typeormRepository.query.mock.calls[0][0]).toContain(
      'ON CONFLICT ("tenant_id", "actor_id", "output_id") DO UPDATE',
    )
    expect(typeormRepository.query.mock.calls[0][1]).toEqual([
      tenantId,
      actorId,
      sessionId,
      outputId,
      5,
      'Updated feedback.',
      JSON.stringify({ workflowKey: 'problem-solving' }),
      true,
    ])
    expect(typeormRepository.findOne).not.toHaveBeenCalled()
    expect(typeormRepository.create).not.toHaveBeenCalled()
    expect(typeormRepository.update).not.toHaveBeenCalled()
  })

  test('[P1][4.4-BE-004A][AC1] preserves existing feedback text when a re-rating omits feedbackText', async () => {
    typeormRepository.query.mockResolvedValueOnce([
      toRawRating(createRating({ rating: 3, feedbackText: 'Existing private feedback.' })),
    ])

    await repository.upsertRating(tenantId, {
      actorId,
      sessionId,
      outputId,
      rating: 3,
      metadata: { workflowKey: 'problem-solving' },
    })

    expect(typeormRepository.query.mock.calls[0][0]).toContain(
      'WHEN $8::boolean THEN EXCLUDED."feedback_text"',
    )
    expect(typeormRepository.query.mock.calls[0][1][5]).toBeNull()
    expect(typeormRepository.query.mock.calls[0][1][7]).toBe(false)
  })

  test('[P0][4.4-BE-005][AC2,AC3] creates a favorite-only row without forcing a default rating', async () => {
    const created = createRating({
      rating: null,
      feedbackText: null,
      isFavorited: true,
      ratedAt: null,
      favoritedAt: new Date('2026-05-21T06:10:00.000Z'),
    })
    typeormRepository.query.mockResolvedValueOnce([toRawRating(created)])

    await expect(
      repository.upsertFavorite(tenantId, {
        actorId,
        sessionId,
        outputId,
        isFavorited: true,
        metadata: { workflowKey: 'problem-solving' },
      }),
    ).resolves.toEqual(created)

    expect(typeormRepository.query.mock.calls[0][0]).toContain(
      'ON CONFLICT ("tenant_id", "actor_id", "output_id") DO UPDATE',
    )
    expect(typeormRepository.query.mock.calls[0][1]).toEqual([
      tenantId,
      actorId,
      sessionId,
      outputId,
      true,
      JSON.stringify({ workflowKey: 'problem-solving' }),
    ])
    expect(typeormRepository.create).not.toHaveBeenCalled()
    expect(typeormRepository.save).not.toHaveBeenCalled()
  })

  test('[P0][4.4-BE-006][AC2,AC3] batch-loads asset states by tenant actor and output ids', async () => {
    const queryBuilder = createSelectQueryBuilderMock([
      createRating({ outputId, isFavorited: true }),
    ])
    typeormRepository.createQueryBuilder.mockReturnValue(queryBuilder as never)

    await expect(
      repository.findStatesForOutputIds(tenantId, actorId, [outputId, outputId]),
    ).resolves.toEqual([
      {
        outputId,
        rating: 4,
        feedbackTextPresent: true,
        isFavorited: true,
        updatedAt: '2026-05-21T06:00:00.000Z',
      },
    ])

    expect(queryBuilder.where).toHaveBeenCalledWith('rating.tenant_id = :tenantId', {
      tenantId,
    })
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('rating.actor_id = :actorId', {
      actorId,
    })
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('rating.output_id IN (:...outputIds)', {
      outputIds: [outputId],
    })
    expect(typeormRepository.find).not.toHaveBeenCalled()
  })
})

function createSelectQueryBuilderMock(items: AdvisoryOutputRating[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(items),
  }
}

function toRawRating(rating: AdvisoryOutputRating): Record<string, unknown> {
  return {
    id: rating.id,
    tenantId: rating.tenantId,
    actorId: rating.actorId,
    outputId: rating.outputId,
    sessionId: rating.sessionId,
    rating: rating.rating,
    feedbackText: rating.feedbackText,
    isFavorited: rating.isFavorited,
    ratedAt: rating.ratedAt,
    favoritedAt: rating.favoritedAt,
    metadata: rating.metadata,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
  }
}
