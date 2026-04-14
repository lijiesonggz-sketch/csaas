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
  APPLICABLE_SECTORS,
  ApplicableSector,
  AuthorityProfile,
  CONTROL_POINT_RISK_LEVELS,
  CONTROL_POINT_STATUSES,
  CONTROL_POINT_TYPES,
  CONTROL_POINT_MATURITY_LEVELS,
  CONTROL_POINT_ORIGIN_TYPES,
  ControlPointMaturityLevel,
  ControlPointOriginType,
  ControlPointRiskLevel,
  ControlPointStatus,
  ControlPointType,
  SectorRequirements,
} from '../../../database/entities/control-point.entity'
import {
  CLAUSE_CONTROL_MAPPING_TYPES,
  ClauseControlMappingType,
  MAP_REVIEW_STATUSES,
  MapReviewStatus,
} from '../../../database/entities/clause-control-map.entity'
import {
  OBLIGATION_COVERAGES,
  ObligationCoverage,
} from '../../../database/entities/obligation-control-map.entity'
import {
  FAILURE_MODE_CONTROL_RELEVANCES,
  FailureModeControlRelevance,
} from '../../../database/entities/failure-mode-control-map.entity'
import {
  CONTROL_EVIDENCE_REQUIRED_LEVELS,
  ControlEvidenceRequiredLevel,
  EVIDENCE_FREQUENCIES,
  EVIDENCE_SAMPLING_REQUIREMENTS,
  EvidenceFrequency,
  EvidenceSamplingRequirement,
} from '../../../database/entities/control-evidence-map.entity'
import {
  EVIDENCE_CATEGORIES,
  EVIDENCE_TYPE_STATUSES,
  EvidenceCategory,
  EvidenceTypeStatus,
} from '../../../database/entities/evidence-type.entity'
import {
  QUESTION_ITEM_STATUSES,
  QUESTION_ITEM_TYPES,
  QuestionItemStatus,
  QuestionItemType,
} from '../../../database/entities/question-item.entity'
import {
  REGULATION_CLAUSE_MANDATORY_LEVELS,
  RegulationClauseMandatoryLevel,
} from '../../../database/entities/regulation-clause.entity'
import {
  OBLIGATION_STATUSES,
  OBLIGATION_TYPES,
  ObligationStatus,
  ObligationType,
} from '../../../database/entities/regulation-obligation.entity'
import {
  REGULATION_SOURCE_LEVELS,
  REGULATION_SOURCE_STATUSES,
  RegulationSourceLevel,
  RegulationSourceStatus,
} from '../../../database/entities/regulation-source.entity'
import {
  REMEDIATION_ACTION_BENEFIT_LEVELS,
  REMEDIATION_ACTION_EFFORT_LEVELS,
  REMEDIATION_ACTION_PRIORITIES,
  REMEDIATION_ACTION_STATUSES,
  RemediationActionBenefitLevel,
  RemediationActionEffortLevel,
  RemediationActionPriority,
  RemediationActionStatus,
} from '../../../database/entities/remediation-action.entity'
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
  aliases?: string[] | null
  keywords?: string[] | null
  canonicalTheme?: string | null
  l1Code: string
  l2Code: string
  controlFamily: string
  controlType: ControlPointType
  mandatoryDefault: boolean
  priorityDefault: ResolutionPriority
  riskLevelDefault: ControlPointRiskLevel
  ownerRoleHint?: string[] | null
  status: ControlPointStatus
  originType?: ControlPointOriginType
  maturityLevel?: ControlPointMaturityLevel
  objectiveSummary?: string | null
  sourceBasis?: Record<string, unknown> | null
  authorityProfileJson?: AuthorityProfile | null
  supersededBy?: string | null
  retiredReason?: string | null
  applicableSector?: ApplicableSector[]
  sectorRequirements?: SectorRequirements | null
}

export interface RegulationSourceSeedRecord {
  sourceCode: string
  sourceName: string
  sourceLevel: RegulationSourceLevel
  authorityName?: string | null
  industryScope?: string[] | null
  applicableOrgTypes?: string[] | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  versionNo?: string | null
  sourceStatus?: RegulationSourceStatus
  rawTextPath?: string | null
  metadataJson?: Record<string, unknown> | null
}

export interface RegulationClauseSeedRecord {
  sourceCode: string
  clauseCode: string
  articleNo?: string | null
  sectionPath?: string | null
  clauseText: string
  clauseSummary?: string | null
  mandatoryLevel?: RegulationClauseMandatoryLevel | null
  keywords?: string[] | null
  versionNo?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
}

export interface RegulationObligationSeedRecord {
  sourceCode: string
  clauseCode: string
  obligationCode: string
  obligationText: string
  obligationType: ObligationType
  applicableSector?: ApplicableSector[]
  status?: ObligationStatus
}

export interface ObligationControlMapSeedRecord {
  obligationCode: string
  controlCode: string
  coverage: ObligationCoverage
  notes?: string | null
}

export interface FailureModeControlMapSeedRecord {
  failureModeCode: string
  controlCode: string
  relevance: FailureModeControlRelevance
  notes?: string | null
}

export interface EvidenceTypeSeedRecord {
  evidenceCode: string
  evidenceName: string
  evidenceDesc?: string | null
  evidenceCategory?: EvidenceCategory | null
  autoCollectable?: boolean
  status?: EvidenceTypeStatus
}

export interface ControlEvidenceMapSeedRecord {
  controlCode: string
  evidenceCode: string
  requiredLevel?: ControlEvidenceRequiredLevel
  frequency?: EvidenceFrequency | null
  ownerRole?: string | null
  samplingRequirement?: EvidenceSamplingRequirement | null
  notes?: string | null
}

export interface ClauseControlMapSeedRecord {
  clauseCode: string
  controlCode: string
  mappingType: ClauseControlMappingType
  confidenceScore?: string | null
  reviewStatus?: MapReviewStatus
  notes?: string | null
}

export interface QuestionItemSeedRecord {
  controlCode: string
  questionCode: string
  questionText: string
  questionType: QuestionItemType
  roleHint?: string[] | null
  answerSchema?: Record<string, unknown> | null
  scoringRule?: Record<string, unknown> | null
  applicableTags?: string[] | null
  required: boolean
  status?: QuestionItemStatus
}

export interface RemediationActionSeedRecord {
  controlCode: string
  actionCode: string
  actionTitle: string
  actionDesc?: string | null
  priorityDefault: RemediationActionPriority
  effortLevel?: RemediationActionEffortLevel | null
  expectedBenefit?: RemediationActionBenefitLevel | null
  ownerRoleHint?: string[] | null
  outputTemplate?: Record<string, unknown> | null
  status?: RemediationActionStatus
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
  regulationSources: RegulationSourceSeedRecord[]
  regulationClauses: RegulationClauseSeedRecord[]
  regulationObligations: RegulationObligationSeedRecord[]
  obligationControlMaps: ObligationControlMapSeedRecord[]
  failureModeControlMaps: FailureModeControlMapSeedRecord[]
  evidenceTypes: EvidenceTypeSeedRecord[]
  controlEvidenceMaps: ControlEvidenceMapSeedRecord[]
  clauseControlMaps: ClauseControlMapSeedRecord[]
  questionItems: QuestionItemSeedRecord[]
  remediationActions: RemediationActionSeedRecord[]
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
  assertUnique(
    seedData.regulationSources.map((source) => source.sourceCode),
    'regulation source code',
  )
  assertUnique(
    seedData.regulationClauses.map((clause) => clause.clauseCode),
    'regulation clause code',
  )
  assertUnique(
    seedData.regulationObligations.map((obligation) => obligation.obligationCode),
    'regulation obligation code',
  )
  assertUnique(
    seedData.evidenceTypes.map((evidence) => evidence.evidenceCode),
    'evidence type code',
  )
  assertUnique(
    seedData.questionItems.map((question) => question.questionCode),
    'question item code',
  )
  assertUnique(
    seedData.remediationActions.map((action) => action.actionCode),
    'remediation action code',
  )

  const packTypeSet = new Set(seedData.controlPacks.map((pack) => pack.packType))
  const maturityLevelSet = new Set(seedData.controlPacks.map((pack) => pack.maturityLevel))
  const taxonomyStatusSet = new Set(TAXONOMY_STATUSES)
  const controlPointTypeSet = new Set(CONTROL_POINT_TYPES)
  const controlPointRiskSet = new Set(CONTROL_POINT_RISK_LEVELS)
  const controlPointStatusSet = new Set(CONTROL_POINT_STATUSES)
  const controlPointOriginSet = new Set(CONTROL_POINT_ORIGIN_TYPES)
  const controlPointMaturitySet = new Set(CONTROL_POINT_MATURITY_LEVELS)
  const applicableSectorSet = new Set(APPLICABLE_SECTORS)
  const regulationSourceLevelSet = new Set(REGULATION_SOURCE_LEVELS)
  const regulationSourceStatusSet = new Set(REGULATION_SOURCE_STATUSES)
  const regulationClauseMandatoryLevelSet = new Set(REGULATION_CLAUSE_MANDATORY_LEVELS)
  const obligationTypeSet = new Set(OBLIGATION_TYPES)
  const obligationStatusSet = new Set(OBLIGATION_STATUSES)
  const obligationCoverageSet = new Set(OBLIGATION_COVERAGES)
  const questionTypeSet = new Set(QUESTION_ITEM_TYPES)
  const questionStatusSet = new Set(QUESTION_ITEM_STATUSES)
  const remediationPrioritySet = new Set(REMEDIATION_ACTION_PRIORITIES)
  const remediationEffortSet = new Set(REMEDIATION_ACTION_EFFORT_LEVELS)
  const remediationBenefitSet = new Set(REMEDIATION_ACTION_BENEFIT_LEVELS)
  const remediationStatusSet = new Set(REMEDIATION_ACTION_STATUSES)
  const evidenceCategorySet = new Set(EVIDENCE_CATEGORIES)
  const evidenceStatusSet = new Set(EVIDENCE_TYPE_STATUSES)
  const evidenceRequiredLevelSet = new Set(CONTROL_EVIDENCE_REQUIRED_LEVELS)
  const evidenceFrequencySet = new Set(EVIDENCE_FREQUENCIES)
  const evidenceSamplingSet = new Set(EVIDENCE_SAMPLING_REQUIREMENTS)
  const clauseControlMappingTypeSet = new Set(CLAUSE_CONTROL_MAPPING_TYPES)
  const mapReviewStatusSet = new Set(MAP_REVIEW_STATUSES)
  const failureModeControlRelevanceSet = new Set(FAILURE_MODE_CONTROL_RELEVANCES)

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
  const evidenceCodeSet = new Set(seedData.evidenceTypes.map((evidence) => evidence.evidenceCode))
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

  const controlCodeSet = new Set(seedData.controlPoints.map((control) => control.controlCode))
  const sourceCodeSet = new Set(seedData.regulationSources.map((source) => source.sourceCode))
  const clauseCodeSet = new Set(seedData.regulationClauses.map((clause) => clause.clauseCode))
  const mappedFamilySet = new Set(
    seedData.packFamilyMappings.flatMap((mapping) => mapping.controlFamilies),
  )
  const knownFailureModeCodes = new Set(
    readSeedFile<Array<{ failureModeCode: string }>>('failure-mode.seed.json').map(
      (failureMode) => failureMode.failureModeCode,
    ),
  )

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

    if (control.aliases && !Array.isArray(control.aliases)) {
      throw new Error(`Control point ${control.controlCode} aliases must be an array`)
    }

    if (control.keywords && !Array.isArray(control.keywords)) {
      throw new Error(`Control point ${control.controlCode} keywords must be an array`)
    }

    if (control.originType && !controlPointOriginSet.has(control.originType)) {
      throw new Error(`Control point ${control.controlCode} has invalid originType ${control.originType}`)
    }

    if (control.maturityLevel && !controlPointMaturitySet.has(control.maturityLevel)) {
      throw new Error(
        `Control point ${control.controlCode} has invalid maturityLevel ${control.maturityLevel}`,
      )
    }

    if (control.applicableSector) {
      for (const sector of control.applicableSector) {
        if (!applicableSectorSet.has(sector)) {
          throw new Error(`Control point ${control.controlCode} has invalid applicableSector ${sector}`)
        }
      }
    }

    if (
      control.maturityLevel === 'hard' &&
      control.originType === 'case_derived' &&
      !mappedFamilySet.has(control.controlFamily)
    ) {
      throw new Error(
        `Hard control point ${control.controlCode} must map to at least one pack family`,
      )
    }
  }

  for (const source of seedData.regulationSources) {
    if (!source.sourceCode || !source.sourceName) {
      throw new Error(`Regulation source ${source.sourceCode || '<missing>'} has incomplete metadata`)
    }

    if (!regulationSourceLevelSet.has(source.sourceLevel)) {
      throw new Error(`Regulation source ${source.sourceCode} has invalid sourceLevel ${source.sourceLevel}`)
    }

    const status = source.sourceStatus ?? 'ACTIVE'
    if (!regulationSourceStatusSet.has(status)) {
      throw new Error(`Regulation source ${source.sourceCode} has invalid sourceStatus ${status}`)
    }
  }

  for (const clause of seedData.regulationClauses) {
    if (!sourceCodeSet.has(clause.sourceCode)) {
      throw new Error(`Regulation clause ${clause.clauseCode} references unknown source ${clause.sourceCode}`)
    }

    if (!clause.clauseCode || !clause.clauseText) {
      throw new Error(`Regulation clause ${clause.clauseCode || '<missing>'} has incomplete metadata`)
    }

    if (
      clause.mandatoryLevel &&
      !regulationClauseMandatoryLevelSet.has(clause.mandatoryLevel)
    ) {
      throw new Error(
        `Regulation clause ${clause.clauseCode} has invalid mandatoryLevel ${clause.mandatoryLevel}`,
      )
    }
  }

  for (const obligation of seedData.regulationObligations) {
    if (!sourceCodeSet.has(obligation.sourceCode)) {
      throw new Error(
        `Regulation obligation ${obligation.obligationCode} references unknown source ${obligation.sourceCode}`,
      )
    }

    if (!clauseCodeSet.has(obligation.clauseCode)) {
      throw new Error(
        `Regulation obligation ${obligation.obligationCode} references unknown clause ${obligation.clauseCode}`,
      )
    }

    if (!obligation.obligationCode || !obligation.obligationText) {
      throw new Error(
        `Regulation obligation ${obligation.obligationCode || '<missing>'} has incomplete metadata`,
      )
    }

    if (!obligationTypeSet.has(obligation.obligationType)) {
      throw new Error(
        `Regulation obligation ${obligation.obligationCode} has invalid obligationType ${obligation.obligationType}`,
      )
    }

    const status = obligation.status ?? 'ACTIVE'
    if (!obligationStatusSet.has(status)) {
      throw new Error(
        `Regulation obligation ${obligation.obligationCode} has invalid status ${status}`,
      )
    }

    for (const sector of obligation.applicableSector ?? []) {
      if (!applicableSectorSet.has(sector)) {
        throw new Error(
          `Regulation obligation ${obligation.obligationCode} has invalid applicableSector ${sector}`,
        )
      }
    }
  }

  for (const mapping of seedData.failureModeControlMaps) {
    if (!knownFailureModeCodes.has(mapping.failureModeCode)) {
      throw new Error(
        `Failure mode control map references unknown failure mode ${mapping.failureModeCode}`,
      )
    }
    if (!controlCodeSet.has(mapping.controlCode)) {
      throw new Error(`Failure mode control map references unknown control ${mapping.controlCode}`)
    }
    if (!failureModeControlRelevanceSet.has(mapping.relevance)) {
      throw new Error(
        `Failure mode control map ${mapping.failureModeCode}/${mapping.controlCode} has invalid relevance ${mapping.relevance}`,
      )
    }
  }

  for (const evidence of seedData.evidenceTypes) {
    if (!evidence.evidenceCode || !evidence.evidenceName) {
      throw new Error(`Evidence type ${evidence.evidenceCode || '<missing>'} has incomplete metadata`)
    }

    if (evidence.evidenceCategory && !evidenceCategorySet.has(evidence.evidenceCategory)) {
      throw new Error(
        `Evidence type ${evidence.evidenceCode} has invalid evidenceCategory ${evidence.evidenceCategory}`,
      )
    }

    const status = evidence.status ?? 'ACTIVE'
    if (!evidenceStatusSet.has(status)) {
      throw new Error(`Evidence type ${evidence.evidenceCode} has invalid status ${status}`)
    }
  }

  const seenControlEvidencePairs = new Set<string>()
  for (const mapping of seedData.controlEvidenceMaps) {
    if (!controlCodeSet.has(mapping.controlCode)) {
      throw new Error(`Control evidence map references unknown control ${mapping.controlCode}`)
    }
    if (!evidenceCodeSet.has(mapping.evidenceCode)) {
      throw new Error(`Control evidence map references unknown evidence ${mapping.evidenceCode}`)
    }

    const pairKey = `${mapping.controlCode}::${mapping.evidenceCode}`
    if (seenControlEvidencePairs.has(pairKey)) {
      throw new Error(`Duplicate control evidence map ${pairKey}`)
    }
    seenControlEvidencePairs.add(pairKey)

    const requiredLevel = mapping.requiredLevel ?? 'RECOMMENDED'
    if (!evidenceRequiredLevelSet.has(requiredLevel)) {
      throw new Error(`Control evidence map ${pairKey} has invalid requiredLevel ${requiredLevel}`)
    }

    if (mapping.frequency && !evidenceFrequencySet.has(mapping.frequency)) {
      throw new Error(`Control evidence map ${pairKey} has invalid frequency ${mapping.frequency}`)
    }

    if (
      mapping.samplingRequirement &&
      !evidenceSamplingSet.has(mapping.samplingRequirement)
    ) {
      throw new Error(
        `Control evidence map ${pairKey} has invalid samplingRequirement ${mapping.samplingRequirement}`,
      )
    }
  }

  for (const mapping of seedData.clauseControlMaps) {
    if (!clauseCodeSet.has(mapping.clauseCode)) {
      throw new Error(`Clause control map references unknown clause ${mapping.clauseCode}`)
    }
    if (!controlCodeSet.has(mapping.controlCode)) {
      throw new Error(`Clause control map references unknown control ${mapping.controlCode}`)
    }
    if (!clauseControlMappingTypeSet.has(mapping.mappingType)) {
      throw new Error(
        `Clause control map ${mapping.clauseCode}/${mapping.controlCode} has invalid mappingType ${mapping.mappingType}`,
      )
    }
    if (
      mapping.reviewStatus &&
      !mapReviewStatusSet.has(mapping.reviewStatus)
    ) {
      throw new Error(
        `Clause control map ${mapping.clauseCode}/${mapping.controlCode} has invalid reviewStatus ${mapping.reviewStatus}`,
      )
    }
  }

  const obligationCodeSet = new Set(
    seedData.regulationObligations.map((obligation) => obligation.obligationCode),
  )
  for (const mapping of seedData.obligationControlMaps) {
    if (!obligationCodeSet.has(mapping.obligationCode)) {
      throw new Error(
        `Obligation control map references unknown obligation ${mapping.obligationCode}`,
      )
    }
    if (!controlCodeSet.has(mapping.controlCode)) {
      throw new Error(
        `Obligation control map references unknown control ${mapping.controlCode}`,
      )
    }
    if (!obligationCoverageSet.has(mapping.coverage)) {
      throw new Error(
        `Obligation control map ${mapping.obligationCode}/${mapping.controlCode} has invalid coverage ${mapping.coverage}`,
      )
    }
  }

  const mappedObligationCodes = new Set(
    seedData.obligationControlMaps.map((mapping) => mapping.obligationCode),
  )
  if (
    !seedData.regulationObligations.some(
      (obligation) => !mappedObligationCodes.has(obligation.obligationCode),
    )
  ) {
    throw new Error(
      'Regulation obligation seed must preserve at least one unmapped blind-spot obligation',
    )
  }

  for (const question of seedData.questionItems) {
    if (!controlCodeSet.has(question.controlCode)) {
      throw new Error(`Question item ${question.questionCode} references unknown control ${question.controlCode}`)
    }
    if (!questionTypeSet.has(question.questionType)) {
      throw new Error(`Question item ${question.questionCode} has invalid questionType ${question.questionType}`)
    }
    const status = question.status ?? 'ACTIVE'
    if (!questionStatusSet.has(status)) {
      throw new Error(`Question item ${question.questionCode} has invalid status ${status}`)
    }
  }

  for (const action of seedData.remediationActions) {
    if (!controlCodeSet.has(action.controlCode)) {
      throw new Error(`Remediation action ${action.actionCode} references unknown control ${action.controlCode}`)
    }
    if (!remediationPrioritySet.has(action.priorityDefault)) {
      throw new Error(
        `Remediation action ${action.actionCode} has invalid priorityDefault ${action.priorityDefault}`,
      )
    }
    if (action.effortLevel && !remediationEffortSet.has(action.effortLevel)) {
      throw new Error(
        `Remediation action ${action.actionCode} has invalid effortLevel ${action.effortLevel}`,
      )
    }
    if (
      action.expectedBenefit &&
      !remediationBenefitSet.has(action.expectedBenefit)
    ) {
      throw new Error(
        `Remediation action ${action.actionCode} has invalid expectedBenefit ${action.expectedBenefit}`,
      )
    }
    const status = action.status ?? 'ACTIVE'
    if (!remediationStatusSet.has(status)) {
      throw new Error(`Remediation action ${action.actionCode} has invalid status ${status}`)
    }
  }

  const questionControlCodes = new Set(seedData.questionItems.map((question) => question.controlCode))
  const remediationControlCodes = new Set(seedData.remediationActions.map((action) => action.controlCode))
  const controlEvidenceControlCodes = new Set(
    seedData.controlEvidenceMaps.map((mapping) => mapping.controlCode),
  )

  for (const control of seedData.controlPoints) {
    if (control.maturityLevel === 'hard' && control.originType === 'case_derived') {
      if (!questionControlCodes.has(control.controlCode)) {
        throw new Error(`Hard control point ${control.controlCode} is missing a question item`)
      }
      if (!remediationControlCodes.has(control.controlCode)) {
        throw new Error(`Hard control point ${control.controlCode} is missing a remediation action`)
      }
      if (!controlEvidenceControlCodes.has(control.controlCode)) {
        throw new Error(`Hard control point ${control.controlCode} is missing a control evidence map`)
      }
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
    regulationSources: readSeedFile<RegulationSourceSeedRecord[]>('regulation-source.seed.json'),
    regulationClauses: readSeedFile<RegulationClauseSeedRecord[]>('regulation-clause.seed.json'),
    regulationObligations: readSeedFile<RegulationObligationSeedRecord[]>(
      'regulation-obligation.seed.json',
    ),
    obligationControlMaps: readSeedFile<ObligationControlMapSeedRecord[]>(
      'obligation-control-map.seed.json',
    ),
    failureModeControlMaps: readSeedFile<FailureModeControlMapSeedRecord[]>(
      'failure-mode-control-map.seed.json',
    ),
    evidenceTypes: readSeedFile<EvidenceTypeSeedRecord[]>('evidence-type.seed.json'),
    controlEvidenceMaps: readSeedFile<ControlEvidenceMapSeedRecord[]>(
      'control-evidence-map.seed.json',
    ),
    clauseControlMaps: readSeedFile<ClauseControlMapSeedRecord[]>('clause-control-map.seed.json'),
    questionItems: readSeedFile<QuestionItemSeedRecord[]>('question-item.seed.json'),
    remediationActions: readSeedFile<RemediationActionSeedRecord[]>(
      'remediation-action.seed.json',
    ),
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
  const rawCatalog = readSeedFile<ResolverControlCatalogRecord[]>(
    'resolver-control-catalog.fixture.json',
  )

  // Story 2.1: seed fixture controls without maturityLevel default to 'hard'
  const controlCatalog = rawCatalog.map((entry) => ({
    ...entry,
    maturityLevel: entry.maturityLevel ?? 'hard',
  }))

  const runtimeData: ResolverRuntimeData = {
    packFamilyMappings: seedData.packFamilyMappings,
    controlCatalog,
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
