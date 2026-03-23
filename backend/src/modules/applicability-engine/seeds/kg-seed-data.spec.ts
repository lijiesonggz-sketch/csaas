import { loadKgSeedData } from './kg-seed-data'

describe('loadKgSeedData', () => {
  it('should load a complete KG baseline package set', () => {
    const seedData = loadKgSeedData()

    expect(seedData.controlPacks).toHaveLength(25)
    expect(seedData.demoProfiles).toHaveLength(6)
    expect(seedData.expectedResults).toHaveLength(6)
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

    for (const rule of seedData.applicabilityRules) {
      expect(packCodes.has(rule.targetCode)).toBe(true)
    }

    for (const expected of seedData.expectedResults) {
      expect(demoProfileCodes.has(expected.profileCode)).toBe(true)

      for (const packCode of expected.matchedPackCodes) {
        expect(packCodes.has(packCode)).toBe(true)
      }
    }
  })
})
