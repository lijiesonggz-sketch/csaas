import * as fs from 'fs'
import * as path from 'path'
import {
  loadKgSeedData,
  loadResolverRuntimeData,
  validateKgSeedData,
  validateResolverRuntimeData,
} from './kg-seed-data'

describe('loadKgSeedData', () => {
  it('should load a complete KG baseline package set', () => {
    const seedData = loadKgSeedData()

    expect(seedData.controlPacks).toHaveLength(25)
    expect(seedData.demoProfiles).toHaveLength(6)
    expect(seedData.expectedResults).toHaveLength(6)
    expect(seedData.taxonomyL1).toHaveLength(8)
    expect(seedData.taxonomyL2.length).toBeGreaterThanOrEqual(5)
    expect(seedData.controlPoints.length).toBeGreaterThanOrEqual(6)
    expect(new Set(seedData.controlPacks.map((pack) => pack.packType))).toEqual(
      new Set(['base', 'sector', 'scene', 'strength']),
    )
    expect(new Set(seedData.controlPacks.map((pack) => pack.maturityLevel))).toEqual(
      new Set(['stable', 'preview']),
    )
  })

  it('should keep rule targets and expected results aligned with seeded pack codes', () => {
    const seedData = loadKgSeedData()
    const packCodes = new Set(seedData.controlPacks.map((pack) => pack.packCode))
    const demoProfileCodes = new Set(seedData.demoProfiles.map((profile) => profile.profileCode))
    const taxonomyL1Codes = new Set(seedData.taxonomyL1.map((taxonomy) => taxonomy.l1Code))
    const taxonomyL2Codes = new Set(seedData.taxonomyL2.map((taxonomy) => taxonomy.l2Code))

    for (const rule of seedData.applicabilityRules) {
      expect(packCodes.has(rule.targetCode)).toBe(true)
    }

    for (const expected of seedData.expectedResults) {
      expect(demoProfileCodes.has(expected.profileCode)).toBe(true)

      for (const packCode of expected.matchedPackCodes) {
        expect(packCodes.has(packCode)).toBe(true)
      }
    }

    for (const controlPoint of seedData.controlPoints) {
      expect(taxonomyL1Codes.has(controlPoint.l1Code)).toBe(true)
      expect(taxonomyL2Codes.has(controlPoint.l2Code)).toBe(true)
    }
  })

  it('should surface precise validation errors for nested predicate conditions missing op', () => {
    const seedData = JSON.parse(JSON.stringify(loadKgSeedData())) as ReturnType<
      typeof loadKgSeedData
    >

    seedData.applicabilityRules[0].predicate = {
      all: [
        {
          any: [{ field: 'industry' } as never],
        },
      ],
    }

    expect(() => validateKgSeedData(seedData)).toThrow(
      'Predicate condition for field industry is missing op',
    )
  })

  it('should declare seed data assets in nest-cli so runtime JSON fixtures are copied into dist', () => {
    const nestCliPath = path.resolve(__dirname, '../../../../nest-cli.json')
    const nestCli = JSON.parse(fs.readFileSync(nestCliPath, 'utf8')) as {
      compilerOptions?: {
        assets?: Array<{
          include?: string
          outDir?: string
        }>
      }
    }

    expect(nestCli.compilerOptions?.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          include: 'modules/applicability-engine/seeds/data/**/*',
          outDir: 'dist/src',
        }),
      ]),
    )
  })

  it('should allow additional resolver control rules beyond the required baseline set', () => {
    const runtimeData = JSON.parse(JSON.stringify(loadResolverRuntimeData())) as ReturnType<
      typeof loadResolverRuntimeData
    >

    runtimeData.controlRules.push({
      ruleCode: 'RULE-CTRL-EXTRA-TEST-001',
      targetType: 'control',
      targetCode: 'CTRL-ACC-002',
      ruleType: 'strengthen',
      priority: 40,
      predicate: {
        all: [{ field: 'industry', op: 'eq', value: 'bank' }],
      },
      result: {
        priority: 'HIGH',
      },
    })

    expect(() => validateResolverRuntimeData(runtimeData)).not.toThrow()
  })

  it('should align required control-point seed records with resolver fixture control ids and metadata', () => {
    const seedData = loadKgSeedData()
    const runtimeData = loadResolverRuntimeData(seedData)
    const runtimeControlsByCode = new Map(
      runtimeData.controlCatalog.map((control) => [control.controlCode, control] as const),
    )

    for (const controlCode of [
      'CTRL-ACC-002',
      'CTRL-BCP-003',
      'CTRL-DG-004',
      'CTRL-DATA-011',
      'CTRL-AI-001',
      'CTRL-AI-002',
    ]) {
      const seeded = seedData.controlPoints.find((control) => control.controlCode === controlCode)
      const runtime = runtimeControlsByCode.get(controlCode)

      expect(seeded).toBeDefined()
      expect(runtime).toBeDefined()
      expect(seeded?.controlId).toBe(runtime?.controlId)
      expect(seeded?.controlName).toBe(runtime?.controlName)
      expect(seeded?.controlFamily).toBe(runtime?.controlFamily)
      expect(seeded?.mandatoryDefault).toBe(runtime?.mandatoryDefault)
      expect(seeded?.priorityDefault).toBe(runtime?.priorityDefault)
    }
  })

  it('should reject resolver control assertions that reference unknown controls', () => {
    const runtimeData = JSON.parse(JSON.stringify(loadResolverRuntimeData())) as ReturnType<
      typeof loadResolverRuntimeData
    >

    runtimeData.controlAssertions[0].mustExcludeControlCodes = ['CTRL-NOT-EXIST-001']

    expect(() => validateResolverRuntimeData(runtimeData)).toThrow(
      'Resolver control assertions for demo-bank-mega-legal-person references unknown control CTRL-NOT-EXIST-001',
    )
  })

  it('should fail fast when control-point seed drifts from resolver fixture metadata', () => {
    const seedData = JSON.parse(JSON.stringify(loadKgSeedData())) as ReturnType<
      typeof loadKgSeedData
    >
    const runtimeData = JSON.parse(JSON.stringify(loadResolverRuntimeData())) as ReturnType<
      typeof loadResolverRuntimeData
    >

    seedData.controlPoints[0].controlName = 'Unexpected Drifted Name'

    expect(() => validateResolverRuntimeData(runtimeData, seedData)).toThrow(
      'Knowledge graph seed drift detected for CTRL-ACC-002: controlName mismatch against resolver-control-catalog fixture',
    )
  })
})
