import { Test, TestingModule } from '@nestjs/testing'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { ApplicabilityEngineModule } from '../applicability-engine.module'
import { loadKgSeedData } from '../seeds/kg-seed-data'
import { RulePredicate } from '../types/applicability.types'
import { RuleEvaluatorService } from './rule-evaluator.service'

type OperatorCase = {
  label: string
  predicate: RulePredicate
  profile: Record<string, unknown>
  expectedMatched: boolean
}

const operatorCases: OperatorCase[] = [
  {
    label: 'eq match',
    predicate: { all: [{ field: 'industry', op: 'eq', value: 'bank' }] },
    profile: { industry: 'bank' },
    expectedMatched: true,
  },
  {
    label: 'eq miss',
    predicate: { all: [{ field: 'industry', op: 'eq', value: 'bank' }] },
    profile: { industry: 'fund' },
    expectedMatched: false,
  },
  {
    label: 'neq match',
    predicate: { all: [{ field: 'industry', op: 'neq', value: 'insurance' }] },
    profile: { industry: 'bank' },
    expectedMatched: true,
  },
  {
    label: 'neq miss',
    predicate: { all: [{ field: 'industry', op: 'neq', value: 'bank' }] },
    profile: { industry: 'bank' },
    expectedMatched: false,
  },
  {
    label: 'in match',
    predicate: { all: [{ field: 'assetBucket', op: 'in', value: ['large', 'mega'] }] },
    profile: { assetBucket: 'large' },
    expectedMatched: true,
  },
  {
    label: 'in miss',
    predicate: { all: [{ field: 'assetBucket', op: 'in', value: ['large', 'mega'] }] },
    profile: { assetBucket: 'small' },
    expectedMatched: false,
  },
  {
    label: 'not_in match',
    predicate: { all: [{ field: 'industry', op: 'not_in', value: ['other'] }] },
    profile: { industry: 'bank' },
    expectedMatched: true,
  },
  {
    label: 'not_in miss',
    predicate: { all: [{ field: 'industry', op: 'not_in', value: ['bank', 'fund'] }] },
    profile: { industry: 'bank' },
    expectedMatched: false,
  },
  {
    label: 'gt match',
    predicate: { all: [{ field: 'score', op: 'gt', value: 80 }] },
    profile: { score: 90 },
    expectedMatched: true,
  },
  {
    label: 'gt miss',
    predicate: { all: [{ field: 'score', op: 'gt', value: 80 }] },
    profile: { score: 80 },
    expectedMatched: false,
  },
  {
    label: 'gte match',
    predicate: { all: [{ field: 'score', op: 'gte', value: 80 }] },
    profile: { score: 80 },
    expectedMatched: true,
  },
  {
    label: 'gte miss',
    predicate: { all: [{ field: 'score', op: 'gte', value: 80 }] },
    profile: { score: 79 },
    expectedMatched: false,
  },
  {
    label: 'lt match',
    predicate: { all: [{ field: 'score', op: 'lt', value: 3 }] },
    profile: { score: 2 },
    expectedMatched: true,
  },
  {
    label: 'lt miss',
    predicate: { all: [{ field: 'score', op: 'lt', value: 3 }] },
    profile: { score: 3 },
    expectedMatched: false,
  },
  {
    label: 'lte match',
    predicate: { all: [{ field: 'score', op: 'lte', value: 3 }] },
    profile: { score: 3 },
    expectedMatched: true,
  },
  {
    label: 'lte miss',
    predicate: { all: [{ field: 'score', op: 'lte', value: 3 }] },
    profile: { score: 4 },
    expectedMatched: false,
  },
  {
    label: 'exists match',
    predicate: { all: [{ field: 'industry', op: 'exists' }] },
    profile: { industry: 'bank' },
    expectedMatched: true,
  },
  {
    label: 'exists miss',
    predicate: { all: [{ field: 'industry', op: 'exists' }] },
    profile: { industry: '' },
    expectedMatched: false,
  },
  {
    label: 'is_true match',
    predicate: { all: [{ field: 'hasAiServices', op: 'is_true' }] },
    profile: { hasAiServices: true },
    expectedMatched: true,
  },
  {
    label: 'is_true miss',
    predicate: { all: [{ field: 'hasAiServices', op: 'is_true' }] },
    profile: { hasAiServices: false },
    expectedMatched: false,
  },
  {
    label: 'is_false match',
    predicate: { all: [{ field: 'recentMajorIncident', op: 'is_false' }] },
    profile: { recentMajorIncident: false },
    expectedMatched: true,
  },
  {
    label: 'is_false miss',
    predicate: { all: [{ field: 'recentMajorIncident', op: 'is_false' }] },
    profile: { recentMajorIncident: true },
    expectedMatched: false,
  },
  {
    label: 'contains match',
    predicate: { all: [{ field: 'licenses', op: 'contains', value: 'brokerage' }] },
    profile: { licenses: ['brokerage', 'asset-management'] },
    expectedMatched: true,
  },
  {
    label: 'contains miss',
    predicate: { all: [{ field: 'licenses', op: 'contains', value: 'brokerage' }] },
    profile: { licenses: ['custody'] },
    expectedMatched: false,
  },
]

const nestedPredicateFixture: RulePredicate = {
  all: [
    { field: 'industry', op: 'eq', value: 'bank' },
    {
      any: [
        { field: 'usesCloud', op: 'is_true' },
        { field: 'hasDatacenter', op: 'is_true' },
      ],
    },
    {
      not: [{ field: 'recentMajorIncident', op: 'is_true' }],
    },
  ],
}

// @ts-expect-error RulePredicate must contain exactly one logical root.
const invalidPredicateFixture: RulePredicate = { all: [], any: [] }

void invalidPredicateFixture

describe('RuleEvaluatorService', () => {
  let service: RuleEvaluatorService

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RuleEvaluatorService],
    }).compile()

    service = moduleRef.get(RuleEvaluatorService)
  })

  it('should be exported by ApplicabilityEngineModule', () => {
    const exportsMetadata =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, ApplicabilityEngineModule) ?? []

    expect(exportsMetadata).toEqual(expect.arrayContaining([RuleEvaluatorService]))
    expect(service).toBeDefined()
  })

  it.each(operatorCases)(
    'should evaluate operator case: $label',
    ({ predicate, profile, expectedMatched }) => {
      const result = service.evaluatePredicate(predicate, profile)

      expect(result.matched).toBe(expectedMatched)
    },
  )

  it('should evaluate nested all/any/not predicate trees', () => {
    const result = service.evaluatePredicate(nestedPredicateFixture, {
      industry: 'bank',
      usesCloud: true,
      hasDatacenter: false,
      recentMajorIncident: false,
    })

    expect(result.matched).toBe(true)
  })

  it('should keep exists semantics correct for false, 0 and empty string edge cases', () => {
    expect(
      service.evaluatePredicate(
        { all: [{ field: 'hasPersonalInfo', op: 'exists' }] },
        { hasPersonalInfo: false },
      ).matched,
    ).toBe(true)

    expect(
      service.evaluatePredicate({ all: [{ field: 'score', op: 'exists' }] }, { score: 0 }).matched,
    ).toBe(true)

    expect(
      service.evaluatePredicate({ all: [{ field: 'industry', op: 'exists' }] }, { industry: '' })
        .matched,
    ).toBe(false)
  })

  it.each([
    {
      label: 'gt type guard',
      predicate: { all: [{ field: 'score', op: 'gt', value: 80 }] } as RulePredicate,
      profile: { score: '90' },
    },
    {
      label: 'gte type guard',
      predicate: { all: [{ field: 'score', op: 'gte', value: 80 }] } as RulePredicate,
      profile: { score: '80' },
    },
    {
      label: 'lt type guard',
      predicate: { all: [{ field: 'score', op: 'lt', value: 3 }] } as RulePredicate,
      profile: { score: '2' },
    },
    {
      label: 'lte type guard',
      predicate: { all: [{ field: 'score', op: 'lte', value: 3 }] } as RulePredicate,
      profile: { score: '3' },
    },
  ])(
    'should return false for comparison operators when operand types are invalid: $label',
    ({ predicate, profile }) => {
      expect(service.evaluatePredicate(predicate, profile).matched).toBe(false)
    },
  )

  it('should record trace entries for all branches even when all() already failed', () => {
    const result = service.evaluatePredicate(
      {
        all: [
          { field: 'industry', op: 'eq', value: 'fund' },
          { field: 'hasAiServices', op: 'is_true' },
        ],
      },
      {
        industry: 'bank',
        hasAiServices: true,
      },
    )

    expect(result.matched).toBe(false)
    expect(result.traceEntries).toMatchObject([
      {
        field: 'industry',
        matched: false,
        logicalPath: ['all'],
      },
      {
        field: 'hasAiServices',
        matched: true,
        logicalPath: ['all'],
      },
    ])
  })

  it('should return structured trace context for matched and unmatched conditions', () => {
    const result = service.evaluatePredicate(
      {
        all: [
          { field: 'industry', op: 'eq', value: 'bank' },
          { field: 'hasAiServices', op: 'is_true' },
        ],
      },
      {
        industry: 'bank',
        hasAiServices: false,
      },
    )

    expect(result).toMatchObject({
      matched: false,
      traceEntries: [
        {
          field: 'industry',
          op: 'eq',
          expectedValue: 'bank',
          actualValue: 'bank',
          matched: true,
          logicalPath: ['all'],
        },
        {
          field: 'hasAiServices',
          op: 'is_true',
          expectedValue: true,
          actualValue: false,
          matched: false,
          logicalPath: ['all'],
        },
      ],
    })
  })

  it('should preserve logical path information for conditions nested under not', () => {
    const result = service.evaluatePredicate(
      {
        not: [{ field: 'recentMajorIncident', op: 'is_true' }],
      },
      {
        recentMajorIncident: false,
      },
    )

    expect(result.matched).toBe(true)
    expect(result.traceEntries).toMatchObject([
      {
        field: 'recentMajorIncident',
        op: 'is_true',
        actualValue: false,
        matched: false,
        logicalPath: ['not'],
      },
    ])
  })

  it('should throw when a condition uses an unsupported operator at runtime', () => {
    expect(() =>
      service.evaluatePredicate(
        {
          all: [{ field: 'industry', op: 'unsupported' as never, value: 'bank' }],
        },
        {
          industry: 'bank',
        },
      ),
    ).toThrow('Unsupported operator: unsupported')
  })

  it('should reject predicates with multiple logical roots at runtime', () => {
    expect(() =>
      service.evaluatePredicate(
        {
          all: [{ field: 'industry', op: 'eq', value: 'bank' }],
          any: [{ field: 'usesCloud', op: 'is_true' }],
        } as unknown as RulePredicate,
        {
          industry: 'bank',
          usesCloud: true,
        },
      ),
    ).toThrow('Each predicate must contain exactly one logical root')
  })

  it('should reject predicates with unsupported logical roots at runtime', () => {
    expect(() =>
      service.evaluatePredicate(
        {
          xor: [{ field: 'industry', op: 'eq', value: 'bank' }],
        } as unknown as RulePredicate,
        {
          industry: 'bank',
        },
      ),
    ).toThrow('Unsupported logical operator: xor')
  })

  it('should reject logical roots without child nodes', () => {
    expect(() =>
      service.evaluatePredicate(
        {
          all: [],
        },
        {
          industry: 'bank',
        },
      ),
    ).toThrow('Predicate root all must contain at least one child node')
  })

  it('should evaluate seeded bank rule smoke scenario using camelCase profile fields', () => {
    const seedData = loadKgSeedData()
    const rule = seedData.applicabilityRules.find(
      (candidate) => candidate.ruleCode === 'RULE-PACK-SECTOR-BANK-INCLUDE-001',
    )
    const profile = seedData.demoProfiles.find(
      (candidate) => candidate.profileCode === 'demo-bank-mega-legal-person',
    )

    expect(rule).toBeDefined()
    expect(profile).toBeDefined()

    const result = service.evaluatePredicate(rule!.predicate, profile!.profile)

    expect(result.matched).toBe(true)
    expect(result.traceEntries[0]).toMatchObject({
      field: 'industry',
      op: 'eq',
      actualValue: 'bank',
      expectedValue: 'bank',
      matched: true,
      logicalPath: ['all'],
    })
  })
})
