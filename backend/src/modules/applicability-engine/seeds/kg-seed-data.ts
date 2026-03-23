import * as fs from 'fs'
import * as path from 'path'
import {
  ApplicabilityRuleTargetType,
  ApplicabilityRuleType,
} from '../../../database/entities/applicability-rule.entity'
import {
  ControlPackMaturityLevel,
  ControlPackType,
  CONTROL_PACK_MATURITY_LEVELS,
  CONTROL_PACK_TYPES,
} from '../../../database/entities/control-pack.entity'
import {
  OrgProfileSeedRecord,
  RulePredicate,
  RuleResult,
} from '../types/applicability.types'

export interface ControlPackSeedRecord {
  packCode: string
  packName: string
  packType: ControlPackType
  maturityLevel: ControlPackMaturityLevel
  priority: number
  description: string
  status?: string
}

export interface PackFamilyMappingSeedRecord {
  packCode: string
  controlFamilies: string[]
}

export interface ApplicabilityRuleSeedRecord {
  ruleCode: string
  targetType: ApplicabilityRuleTargetType
  targetCode: string
  ruleType: ApplicabilityRuleType
  priority: number
  predicate: RulePredicate
  result?: RuleResult
  effectiveFrom?: string | null
  effectiveTo?: string | null
  status?: string
}

export interface DemoProfileSeedRecord {
  profileCode: string
  name: string
  profile: OrgProfileSeedRecord
}

export interface ResolverExpectedResultSeedRecord {
  profileCode: string
  matchedPackCodes: string[]
  notes?: string[]
}

export interface KgSeedData {
  controlPacks: ControlPackSeedRecord[]
  packFamilyMappings: PackFamilyMappingSeedRecord[]
  applicabilityRules: ApplicabilityRuleSeedRecord[]
  demoProfiles: DemoProfileSeedRecord[]
  expectedResults: ResolverExpectedResultSeedRecord[]
}

const DATA_DIR = path.resolve(__dirname, 'data')

function readSeedFile<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8')) as T
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`)
    }
    seen.add(value)
  }
}

function validatePredicate(predicate: RulePredicate): void {
  const entries = Object.entries(predicate)

  if (entries.length !== 1) {
    throw new Error('Each predicate must contain exactly one logical root')
  }

  const [operator, conditions] = entries[0]

  if (!['all', 'any', 'not'].includes(operator)) {
    throw new Error(`Unsupported predicate root: ${operator}`)
  }

  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error(`Predicate root ${operator} must contain at least one condition`)
  }

  for (const condition of conditions) {
    if (!condition.field) {
      throw new Error('Predicate condition is missing field')
    }

    if (!condition.op) {
      throw new Error(`Predicate condition for field ${condition.field} is missing op`)
    }
  }
}

export function validateKgSeedData(seedData: KgSeedData): KgSeedData {
  if (seedData.controlPacks.length < 25) {
    throw new Error('KG baseline requires at least 25 control packs')
  }

  if (seedData.demoProfiles.length < 6) {
    throw new Error('KG baseline requires at least 6 demo profiles')
  }

  if (seedData.expectedResults.length < 6) {
    throw new Error('KG baseline requires at least 6 expected results')
  }

  assertUnique(
    seedData.controlPacks.map((pack) => pack.packCode),
    'control pack code',
  )
  assertUnique(
    seedData.applicabilityRules.map((rule) => rule.ruleCode),
    'applicability rule code',
  )
  assertUnique(
    seedData.demoProfiles.map((profile) => profile.profileCode),
    'demo profile code',
  )
  assertUnique(
    seedData.expectedResults.map((result) => result.profileCode),
    'expected result profile code',
  )

  const packTypeSet = new Set(seedData.controlPacks.map((pack) => pack.packType))
  const maturityLevelSet = new Set(seedData.controlPacks.map((pack) => pack.maturityLevel))

  for (const packType of CONTROL_PACK_TYPES) {
    if (!packTypeSet.has(packType)) {
      throw new Error(`Missing control pack type: ${packType}`)
    }
  }

  for (const maturityLevel of CONTROL_PACK_MATURITY_LEVELS) {
    if (!maturityLevelSet.has(maturityLevel)) {
      throw new Error(`Missing control pack maturity level: ${maturityLevel}`)
    }
  }

  const packCodeSet = new Set(seedData.controlPacks.map((pack) => pack.packCode))
  const mappedPackCodeSet = new Set(seedData.packFamilyMappings.map((mapping) => mapping.packCode))

  for (const pack of seedData.controlPacks) {
    if (!pack.packCode || !pack.packName || !pack.description) {
      throw new Error(`Control pack ${pack.packCode || '<missing>'} has incomplete metadata`)
    }

    if (!mappedPackCodeSet.has(pack.packCode)) {
      throw new Error(`Missing pack-family mapping for ${pack.packCode}`)
    }
  }

  for (const mapping of seedData.packFamilyMappings) {
    if (!packCodeSet.has(mapping.packCode)) {
      throw new Error(`Pack-family mapping references unknown pack ${mapping.packCode}`)
    }

    if (!Array.isArray(mapping.controlFamilies) || mapping.controlFamilies.length === 0) {
      throw new Error(`Pack-family mapping for ${mapping.packCode} must contain control families`)
    }
  }

  for (const rule of seedData.applicabilityRules) {
    if (!packCodeSet.has(rule.targetCode)) {
      throw new Error(`Applicability rule ${rule.ruleCode} references unknown pack ${rule.targetCode}`)
    }

    validatePredicate(rule.predicate)
  }

  const demoProfileCodeSet = new Set(seedData.demoProfiles.map((profile) => profile.profileCode))

  for (const result of seedData.expectedResults) {
    if (!demoProfileCodeSet.has(result.profileCode)) {
      throw new Error(`Expected result references unknown profile ${result.profileCode}`)
    }

    for (const packCode of result.matchedPackCodes) {
      if (!packCodeSet.has(packCode)) {
        throw new Error(
          `Expected result for ${result.profileCode} references unknown pack ${packCode}`,
        )
      }
    }
  }

  return seedData
}

export function loadKgSeedData(): KgSeedData {
  const seedData: KgSeedData = {
    controlPacks: readSeedFile<ControlPackSeedRecord[]>('control-pack.seed.json'),
    packFamilyMappings: readSeedFile<PackFamilyMappingSeedRecord[]>(
      'pack-family-mapping.seed.json',
    ),
    applicabilityRules: readSeedFile<ApplicabilityRuleSeedRecord[]>(
      'applicability-rule.seed.json',
    ),
    demoProfiles: readSeedFile<DemoProfileSeedRecord[]>('org-profile-demo.seed.json'),
    expectedResults: readSeedFile<ResolverExpectedResultSeedRecord[]>(
      'resolver-expected-result.seed.json',
    ),
  }

  return validateKgSeedData(seedData)
}
