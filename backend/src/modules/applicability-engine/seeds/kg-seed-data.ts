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
  CONTROL_POINT_RISK_LEVELS,
  CONTROL_POINT_STATUSES,
  CONTROL_POINT_TYPES,
  ControlPointRiskLevel,
  ControlPointStatus,
  ControlPointType,
} from '../../../database/entities/control-point.entity'
import { TAXONOMY_STATUSES, TaxonomyStatus } from '../../../database/entities/taxonomy-l1.entity'
import {
  NormalizedResolverRule,
  OrgProfileSeedRecord,
  PredicateNode,
  RuleCondition,
  RuleLogicalOperator,
  RulePredicate,
  RuleResult,
  ResolverControlAssertionRecord,
  ResolverControlCatalogRecord,
  ResolverControlRuleRecord,
  ResolutionPriority,
  RULE_LOGICAL_OPERATORS,
  RESOLUTION_PRIORITIES,
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

export interface TaxonomyL1SeedRecord {
  l1Code: string
  l1Name: string
  sortOrder: number
  status: TaxonomyStatus
}

export interface TaxonomyL2SeedRecord {
  l2Code: string
  l1Code: string
  l2Name: string
  l2Desc?: string | null
  sortOrder: number
  status: TaxonomyStatus
}

export interface ControlPointSeedRecord {
  controlId: string
  controlCode: string
  controlName: string
  controlDesc?: string | null
  l1Code: string
  l2Code: string
  controlFamily: string
  controlType: ControlPointType
  mandatoryDefault: boolean
  priorityDefault: ResolutionPriority
  riskLevelDefault: ControlPointRiskLevel
  ownerRoleHint?: string[] | null
  status: ControlPointStatus
}

export interface KgSeedData {
  controlPacks: ControlPackSeedRecord[]
  packFamilyMappings: PackFamilyMappingSeedRecord[]
  applicabilityRules: ApplicabilityRuleSeedRecord[]
  demoProfiles: DemoProfileSeedRecord[]
  expectedResults: ResolverExpectedResultSeedRecord[]
  taxonomyL1: TaxonomyL1SeedRecord[]
  taxonomyL2: TaxonomyL2SeedRecord[]
  controlPoints: ControlPointSeedRecord[]
}

export interface ResolverRuntimeData {
  packFamilyMappings: PackFamilyMappingSeedRecord[]
  controlCatalog: ResolverControlCatalogRecord[]
  controlRules: ResolverControlRuleRecord[]
  controlAssertions: ResolverControlAssertionRecord[]
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

function assertKnownControlCodes(
  controlCodes: string[],
  knownControlCodes: Set<string>,
  label: string,
): void {
  for (const controlCode of controlCodes) {
    if (!knownControlCodes.has(controlCode)) {
      throw new Error(`${label} references unknown control ${controlCode}`)
    }
  }
}

function assertKnownL1Code(l1Code: string, knownL1Codes: Set<string>, label: string): void {
  if (!knownL1Codes.has(l1Code)) {
    throw new Error(`${label} references unknown taxonomy L1 code ${l1Code}`)
  }
}

function assertKnownL2Code(l2Code: string, knownL2Codes: Set<string>, label: string): void {
  if (!knownL2Codes.has(l2Code)) {
    throw new Error(`${label} references unknown taxonomy L2 code ${l2Code}`)
  }
}

function isRuleConditionLike(node: unknown): node is Partial<RuleCondition> {
  return typeof node === 'object' && node !== null && ('field' in node || 'op' in node)
}

function isRulePredicate(node: unknown): node is RulePredicate {
  return (
    typeof node === 'object' &&
    node !== null &&
    RULE_LOGICAL_OPERATORS.some((operator) => operator in (node as Record<string, unknown>))
  )
}

function validatePredicateNode(node: PredicateNode): void {
  if (isRuleConditionLike(node)) {
    if (!node.field) {
      throw new Error('Predicate condition is missing field')
    }

    if (!node.op) {
      throw new Error(`Predicate condition for field ${node.field} is missing op`)
    }

    return
  }

  if (isRulePredicate(node)) {
    validatePredicate(node)
    return
  }

  throw new Error('Predicate node must be a condition or logical predicate')
}

function validatePredicate(predicate: RulePredicate): void {
  const entries = Object.entries(predicate)

  if (entries.length !== 1) {
    throw new Error('Each predicate must contain exactly one logical root')
  }

  const [operator, conditions] = entries[0]

  if (!RULE_LOGICAL_OPERATORS.includes(operator as RuleLogicalOperator)) {
    throw new Error(`Unsupported predicate root: ${operator}`)
  }

  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error(`Predicate root ${operator} must contain at least one condition`)
  }

  for (const condition of conditions as PredicateNode[]) {
    validatePredicateNode(condition)
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

  if (seedData.taxonomyL1.length < 8) {
    throw new Error('KG taxonomy baseline requires at least 8 taxonomy L1 records')
  }

  if (seedData.controlPoints.length < 6) {
    throw new Error('KG catalog baseline requires at least 6 control point seed records')
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
  assertUnique(
    seedData.taxonomyL1.map((taxonomy) => taxonomy.l1Code),
    'taxonomy L1 code',
  )
  assertUnique(
    seedData.taxonomyL2.map((taxonomy) => taxonomy.l2Code),
    'taxonomy L2 code',
  )
  assertUnique(
    seedData.controlPoints.map((control) => control.controlId),
    'control point id',
  )
  assertUnique(
    seedData.controlPoints.map((control) => control.controlCode),
    'control point code',
  )

  const packTypeSet = new Set(seedData.controlPacks.map((pack) => pack.packType))
  const maturityLevelSet = new Set(seedData.controlPacks.map((pack) => pack.maturityLevel))
  const taxonomyStatusSet = new Set(TAXONOMY_STATUSES)
  const controlPointTypeSet = new Set(CONTROL_POINT_TYPES)
  const controlPointRiskSet = new Set(CONTROL_POINT_RISK_LEVELS)
  const controlPointStatusSet = new Set(CONTROL_POINT_STATUSES)

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
  const taxonomyL1CodeSet = new Set(seedData.taxonomyL1.map((taxonomy) => taxonomy.l1Code))
  const taxonomyL2CodeSet = new Set(seedData.taxonomyL2.map((taxonomy) => taxonomy.l2Code))
  const taxonomyL2ByCode = new Map(
    seedData.taxonomyL2.map((taxonomy) => [taxonomy.l2Code, taxonomy] as const),
  )

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

  for (const taxonomy of seedData.taxonomyL1) {
    if (!taxonomy.l1Code || !taxonomy.l1Name) {
      throw new Error(`Taxonomy L1 ${taxonomy.l1Code || '<missing>'} has incomplete metadata`)
    }

    if (!taxonomyStatusSet.has(taxonomy.status)) {
      throw new Error(`Taxonomy L1 ${taxonomy.l1Code} has invalid status ${taxonomy.status}`)
    }
  }

  for (const taxonomy of seedData.taxonomyL2) {
    if (!taxonomy.l2Code || !taxonomy.l1Code || !taxonomy.l2Name) {
      throw new Error(`Taxonomy L2 ${taxonomy.l2Code || '<missing>'} has incomplete metadata`)
    }

    assertKnownL1Code(taxonomy.l1Code, taxonomyL1CodeSet, `Taxonomy L2 ${taxonomy.l2Code}`)

    if (!taxonomyStatusSet.has(taxonomy.status)) {
      throw new Error(`Taxonomy L2 ${taxonomy.l2Code} has invalid status ${taxonomy.status}`)
    }
  }

  for (const rule of seedData.applicabilityRules) {
    if (!packCodeSet.has(rule.targetCode)) {
      throw new Error(
        `Applicability rule ${rule.ruleCode} references unknown pack ${rule.targetCode}`,
      )
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

  const requiredControlCodes = ['CTRL-ACC-002', 'CTRL-BCP-003', 'CTRL-DG-004', 'CTRL-DATA-011']

  for (const controlCode of requiredControlCodes) {
    if (!seedData.controlPoints.some((control) => control.controlCode === controlCode)) {
      throw new Error(`Control point seed is missing required control ${controlCode}`)
    }
  }

  const aiControlCount = seedData.controlPoints.filter((control) =>
    control.controlFamily.startsWith('AI_'),
  ).length

  if (aiControlCount < 2) {
    throw new Error('Control point seed requires at least 2 AI family controls')
  }

  for (const control of seedData.controlPoints) {
    if (
      !control.controlId ||
      !control.controlCode ||
      !control.controlName ||
      !control.l1Code ||
      !control.l2Code ||
      !control.controlFamily
    ) {
      throw new Error(`Control point ${control.controlCode || '<missing>'} has incomplete metadata`)
    }

    assertKnownL1Code(control.l1Code, taxonomyL1CodeSet, `Control point ${control.controlCode}`)
    assertKnownL2Code(control.l2Code, taxonomyL2CodeSet, `Control point ${control.controlCode}`)

    const taxonomyL2 = taxonomyL2ByCode.get(control.l2Code)

    if (!taxonomyL2 || taxonomyL2.l1Code !== control.l1Code) {
      throw new Error(
        `Control point ${control.controlCode} has invalid l1Code/l2Code hierarchy mapping`,
      )
    }

    if (!controlPointTypeSet.has(control.controlType)) {
      throw new Error(
        `Control point ${control.controlCode} has invalid controlType ${control.controlType}`,
      )
    }

    if (!RESOLUTION_PRIORITIES.includes(control.priorityDefault)) {
      throw new Error(
        `Control point ${control.controlCode} has invalid priorityDefault ${control.priorityDefault}`,
      )
    }

    if (!controlPointRiskSet.has(control.riskLevelDefault)) {
      throw new Error(
        `Control point ${control.controlCode} has invalid riskLevelDefault ${control.riskLevelDefault}`,
      )
    }

    if (!controlPointStatusSet.has(control.status)) {
      throw new Error(`Control point ${control.controlCode} has invalid status ${control.status}`)
    }

    if (control.ownerRoleHint && !Array.isArray(control.ownerRoleHint)) {
      throw new Error(`Control point ${control.controlCode} ownerRoleHint must be an array`)
    }
  }

  return seedData
}

export function loadKgSeedData(): KgSeedData {
  const taxonomySeed = readSeedFile<{ l1: TaxonomyL1SeedRecord[]; l2: TaxonomyL2SeedRecord[] }>(
    'taxonomy.seed.json',
  )
  const seedData: KgSeedData = {
    controlPacks: readSeedFile<ControlPackSeedRecord[]>('control-pack.seed.json'),
    packFamilyMappings: readSeedFile<PackFamilyMappingSeedRecord[]>(
      'pack-family-mapping.seed.json',
    ),
    applicabilityRules: readSeedFile<ApplicabilityRuleSeedRecord[]>('applicability-rule.seed.json'),
    demoProfiles: readSeedFile<DemoProfileSeedRecord[]>('org-profile-demo.seed.json'),
    expectedResults: readSeedFile<ResolverExpectedResultSeedRecord[]>(
      'resolver-expected-result.seed.json',
    ),
    taxonomyL1: taxonomySeed.l1,
    taxonomyL2: taxonomySeed.l2,
    controlPoints: readSeedFile<ControlPointSeedRecord[]>('control-point.seed.json'),
  }

  return validateKgSeedData(seedData)
}

export function validateResolverRuntimeData(
  runtimeData: ResolverRuntimeData,
  seedData: KgSeedData = loadKgSeedData(),
): ResolverRuntimeData {
  assertUnique(
    runtimeData.controlCatalog.map((control) => control.controlId),
    'resolver control id',
  )
  assertUnique(
    runtimeData.controlCatalog.map((control) => control.controlCode),
    'resolver control code',
  )
  assertUnique(
    runtimeData.controlRules.map((rule) => rule.ruleCode),
    'resolver control rule code',
  )
  assertUnique(
    runtimeData.controlAssertions.map((assertion) => assertion.profileCode),
    'resolver control assertion profile code',
  )

  if (runtimeData.controlCatalog.length < 12) {
    throw new Error('Resolver control catalog requires at least 12 controls')
  }

  const controlCodeSet = new Set(runtimeData.controlCatalog.map((control) => control.controlCode))
  const controlPointSeedByCode = new Map(
    seedData.controlPoints.map((control) => [control.controlCode, control] as const),
  )
  const requiredControlCodes = ['CTRL-ACC-002', 'CTRL-BCP-003', 'CTRL-DG-004', 'CTRL-DATA-011']

  for (const controlCode of requiredControlCodes) {
    if (!controlCodeSet.has(controlCode)) {
      throw new Error(`Resolver control catalog is missing required control ${controlCode}`)
    }
  }

  const aiControlCount = runtimeData.controlCatalog.filter((control) =>
    control.controlFamily.startsWith('AI_'),
  ).length

  if (aiControlCount < 2) {
    throw new Error('Resolver control catalog requires at least 2 AI family controls')
  }

  for (const control of runtimeData.controlCatalog) {
    if (!RESOLUTION_PRIORITIES.includes(control.priorityDefault)) {
      throw new Error(
        `Resolver control ${control.controlCode} has invalid priorityDefault ${control.priorityDefault}`,
      )
    }

    if (!Array.isArray(control.questionPackCodes)) {
      throw new Error(`Resolver control ${control.controlCode} is missing questionPackCodes`)
    }

    if (!Array.isArray(control.evidencePackCodes)) {
      throw new Error(`Resolver control ${control.controlCode} is missing evidencePackCodes`)
    }

    if (!Array.isArray(control.remediationPackCodes)) {
      throw new Error(`Resolver control ${control.controlCode} is missing remediationPackCodes`)
    }

    const seededControl = controlPointSeedByCode.get(control.controlCode)

    if (seededControl) {
      const mismatchedFields: string[] = []

      if (seededControl.controlId !== control.controlId) {
        mismatchedFields.push('controlId')
      }

      if (seededControl.controlName !== control.controlName) {
        mismatchedFields.push('controlName')
      }

      if (seededControl.controlFamily !== control.controlFamily) {
        mismatchedFields.push('controlFamily')
      }

      if (seededControl.mandatoryDefault !== control.mandatoryDefault) {
        mismatchedFields.push('mandatoryDefault')
      }

      if (seededControl.priorityDefault !== control.priorityDefault) {
        mismatchedFields.push('priorityDefault')
      }

      if (mismatchedFields.length > 0) {
        throw new Error(
          `Knowledge graph seed drift detected for ${control.controlCode}: ${mismatchedFields.join('/')} mismatch against resolver-control-catalog fixture`,
        )
      }
    }
  }

  const packCodeSet = new Set(seedData.controlPacks.map((pack) => pack.packCode))
  const requiredRuleCodes = new Set([
    'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001',
    'RULE-CTRL-BCP-RTO-STRENGTHEN-001',
    'RULE-CTRL-DG-REPORTING-STRENGTHEN-001',
    'RULE-CTRL-DATA-CROSSBORDER-STRENGTHEN-001',
    'RULE-CTRL-AI-EXCLUDE-NO-AI-001',
  ])

  if (runtimeData.controlRules.length < requiredRuleCodes.size) {
    throw new Error('Resolver control rules must contain at least the 5 required records')
  }

  const seenRequiredRuleCodes = new Set<string>()

  for (const rule of runtimeData.controlRules) {
    if (requiredRuleCodes.has(rule.ruleCode)) {
      seenRequiredRuleCodes.add(rule.ruleCode)
    }

    validatePredicate(rule.predicate)

    if (rule.targetType === 'control' && !controlCodeSet.has(rule.targetCode)) {
      throw new Error(
        `Resolver control rule ${rule.ruleCode} references unknown control ${rule.targetCode}`,
      )
    }

    if (rule.targetType === 'pack' && !packCodeSet.has(rule.targetCode)) {
      throw new Error(
        `Resolver control rule ${rule.ruleCode} references unknown pack ${rule.targetCode}`,
      )
    }
  }

  for (const requiredRuleCode of requiredRuleCodes) {
    if (!seenRequiredRuleCodes.has(requiredRuleCode)) {
      throw new Error(`Resolver control rules are missing required rule ${requiredRuleCode}`)
    }
  }

  const demoProfileCodeSet = new Set(seedData.demoProfiles.map((profile) => profile.profileCode))

  if (runtimeData.controlAssertions.length !== demoProfileCodeSet.size) {
    throw new Error('Resolver control assertions must cover all 6 demo profiles')
  }

  for (const assertion of runtimeData.controlAssertions) {
    if (!demoProfileCodeSet.has(assertion.profileCode)) {
      throw new Error(
        `Resolver control assertions reference unknown profile ${assertion.profileCode}`,
      )
    }

    const nonEmptyAssertionCount = [
      assertion.mustContainControlCodes,
      assertion.mustHaveMandatoryControlCodes,
      assertion.mustHaveHighPriorityControlCodes,
      assertion.mustExcludeControlCodes,
    ].filter((values) => Array.isArray(values) && values.length > 0).length

    if (nonEmptyAssertionCount === 0) {
      throw new Error(
        `Resolver control assertions for ${assertion.profileCode} must contain at least one non-empty assertion list`,
      )
    }

    assertKnownControlCodes(
      assertion.mustContainControlCodes,
      controlCodeSet,
      `Resolver control assertions for ${assertion.profileCode}`,
    )
    assertKnownControlCodes(
      assertion.mustHaveMandatoryControlCodes,
      controlCodeSet,
      `Resolver control assertions for ${assertion.profileCode}`,
    )
    assertKnownControlCodes(
      assertion.mustHaveHighPriorityControlCodes,
      controlCodeSet,
      `Resolver control assertions for ${assertion.profileCode}`,
    )
    assertKnownControlCodes(
      assertion.mustExcludeControlCodes,
      controlCodeSet,
      `Resolver control assertions for ${assertion.profileCode}`,
    )
  }

  return runtimeData
}

export function loadResolverRuntimeData(
  seedData: KgSeedData = loadKgSeedData(),
): ResolverRuntimeData {
  const runtimeData: ResolverRuntimeData = {
    packFamilyMappings: seedData.packFamilyMappings,
    controlCatalog: readSeedFile<ResolverControlCatalogRecord[]>(
      'resolver-control-catalog.fixture.json',
    ),
    controlRules: readSeedFile<ResolverControlRuleRecord[]>('resolver-control-rules.fixture.json'),
    controlAssertions: readSeedFile<ResolverControlAssertionRecord[]>(
      'resolver-control-assertions.fixture.json',
    ),
  }

  return validateResolverRuntimeData(runtimeData, seedData)
}

export function normalizeFixtureResolverRules(
  runtimeData: ResolverRuntimeData = loadResolverRuntimeData(),
): NormalizedResolverRule[] {
  return runtimeData.controlRules
    .map((rule) => ({
      ...rule,
      source: 'fixture' as const,
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority || left.ruleCode.localeCompare(right.ruleCode),
    )
}
