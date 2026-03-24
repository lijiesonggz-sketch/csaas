import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ApplicabilityRule } from '../../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { OrganizationProfile } from '../../../database/entities/organization-profile.entity'
import {
  AppliedEffect,
  MatchedRuleSnapshot,
  NormalizedResolverRule,
  OrgProfileSeedRecord,
  PackResolutionDebugEntry,
  ResolvedControl,
  ResolvedControlSet,
  ResolutionPriority,
  ResolverControlCatalogRecord,
  RulePredicate,
  RuleResult,
} from '../types/applicability.types'
import {
  loadResolverRuntimeData,
  normalizeFixtureResolverRules,
  ResolverRuntimeData,
} from '../seeds/kg-seed-data'
import { RuleEvaluatorService } from './rule-evaluator.service'

type ResolveContext = {
  organizationId?: string
  profileCode?: string
}

type ResolveCoreOptions = ResolveContext & {
  runtimeData?: ResolverRuntimeData
  packRules?: NormalizedResolverRule[]
  controlRules?: NormalizedResolverRule[]
  matchedPackCodes?: string[]
  skipProfileValidation?: boolean
  currentDate?: Date
  timeZone?: string
}

type PackRuleEvaluation = {
  rule: NormalizedResolverRule
  evaluation: ReturnType<RuleEvaluatorService['evaluatePredicate']>
}

const CONFIGURATION_ERROR_MESSAGE =
  'Resolver configuration error: matched pack is missing family mapping or mapped controls'

const PRIORITY_RANK: Record<ResolutionPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
}

@Injectable()
export class PackResolverService {
  constructor(
    @InjectRepository(OrganizationProfile)
    private readonly profileRepository: Repository<OrganizationProfile>,
    @InjectRepository(ApplicabilityRule)
    private readonly applicabilityRuleRepository: Repository<ApplicabilityRule>,
    @InjectRepository(ControlPack)
    private readonly controlPackRepository: Repository<ControlPack>,
    private readonly ruleEvaluatorService: RuleEvaluatorService,
  ) {}

  async resolveByOrganizationId(organizationId: string): Promise<ResolvedControlSet> {
    const profile = await this.profileRepository.findOne({
      where: { orgId: organizationId },
    })

    if (!profile) {
      throw new NotFoundException(
        `Organization profile not found for organization ${organizationId}`,
      )
    }

    return this.resolveCore(this.toProfileRecord(profile), { organizationId })
  }

  async resolveFromProfile(
    profile: OrgProfileSeedRecord | OrganizationProfile,
    context: ResolveContext = {},
  ): Promise<ResolvedControlSet> {
    if (!profile || typeof profile !== 'object') {
      throw new BadRequestException('Profile payload is required for resolver execution')
    }

    return this.resolveCore(profile as unknown as Record<string, unknown>, context)
  }

  private async resolveCore(
    profile: Record<string, unknown>,
    options: ResolveCoreOptions = {},
  ): Promise<ResolvedControlSet> {
    const runtimeData = options.runtimeData ?? loadResolverRuntimeData()
    const packRules =
      options.packRules ??
      (await this.loadActivePackRules(options.currentDate, options.timeZone))
    const controlRules = options.controlRules ?? normalizeFixtureResolverRules(runtimeData)
    const normalizedRules = [...packRules, ...controlRules].sort(
      (left, right) =>
        left.priority - right.priority || left.ruleCode.localeCompare(right.ruleCode),
    )

    if (normalizedRules.length === 0) {
      return this.buildNoActiveRulesResult()
    }

    if (!options.skipProfileValidation) {
      this.assertProfileHasRequiredFields(profile, normalizedRules)
    }

    const activePackCodes = new Set(options.matchedPackCodes ?? [])
    const matchedRuleCodes: string[] = []
    const debugLog: PackResolutionDebugEntry[] = new Array(normalizedRules.length)
    const matchedPackRuleSnapshots = new Map<string, MatchedRuleSnapshot[]>()
    const deferredControlRules: Array<PackRuleEvaluation & { index: number }> = []

    normalizedRules.forEach((rule, index) => {
      const evaluation = this.ruleEvaluatorService.evaluatePredicate(rule.predicate, profile)

      if (evaluation.matched) {
        matchedRuleCodes.push(rule.ruleCode)
      }

      if (rule.targetType === 'pack') {
        debugLog[index] = this.applyPackRule(
          rule,
          evaluation,
          activePackCodes,
          runtimeData,
          matchedPackRuleSnapshots,
        )
        return
      }

      deferredControlRules.push({ index, rule, evaluation })
    })

    const resolvedControls = this.buildResolvedControls(
      activePackCodes,
      runtimeData,
      matchedPackRuleSnapshots,
    )

    deferredControlRules.forEach(({ index, rule, evaluation }) => {
      debugLog[index] = this.applyControlRule(rule, evaluation, resolvedControls)
    })

    const controls = Array.from(resolvedControls.values())
      .map((control) => this.finalizeControl(control))
      .sort((left, right) => left.controlCode.localeCompare(right.controlCode))

    const matchedPacks = this.uniquePackCodes(Array.from(activePackCodes))
    const excludedControls = new Set(
      debugLog.flatMap((entry) => entry.appliedEffect.excludedControlCodes),
    )

    return {
      matchedPacks,
      matchedRules: matchedRuleCodes,
      controls,
      summary: {
        totalControls: controls.length,
        mandatoryCount: controls.filter((control) => control.mandatory).length,
        matchedPacks: matchedPacks.length,
        matchedRules: matchedRuleCodes.length,
        excludedControls: excludedControls.size,
      },
      debugLog,
    }
  }

  private async loadActivePackRules(
    currentDate: Date = new Date(),
    timeZone: string = process.env.APP_TIME_ZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  ): Promise<NormalizedResolverRule[]> {
    const [packs, rules] = await Promise.all([
      this.controlPackRepository.find(),
      this.applicabilityRuleRepository.find(),
    ])

    const packCodeById = new Map(packs.map((pack) => [pack.packId, pack.packCode] as const))
    const today = this.formatDateForTimeZone(currentDate, timeZone)

    return rules
      .filter((rule) => this.isRuleActive(rule.status, rule.effectiveFrom, rule.effectiveTo, today))
      .map((rule) => {
        const targetCode = packCodeById.get(rule.targetId)

        if (!targetCode) {
          throw new Error(
            `Resolver configuration error: pack rule target could not be resolved for ${rule.ruleCode}`,
          )
        }

        return {
          ruleCode: rule.ruleCode,
          targetType: rule.targetType,
          targetCode,
          ruleType: rule.ruleType,
          priority: rule.priority,
          predicate: rule.predicateJson as RulePredicate,
          result: (rule.resultJson as RuleResult | null) ?? undefined,
          effectiveFrom: rule.effectiveFrom ?? null,
          effectiveTo: rule.effectiveTo ?? null,
          status: rule.status,
          source: 'db' as const,
        }
      })
      .sort(
        (left, right) =>
          left.priority - right.priority || left.ruleCode.localeCompare(right.ruleCode),
      )
  }

  private isRuleActive(
    status: string | undefined,
    effectiveFrom: string | null | undefined,
    effectiveTo: string | null | undefined,
    today: string,
  ): boolean {
    if ((status ?? 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      return false
    }

    if (effectiveFrom && effectiveFrom > today) {
      return false
    }

    if (effectiveTo && effectiveTo < today) {
      return false
    }

    return true
  }

  private formatDateForTimeZone(currentDate: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(currentDate)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value

    if (!year || !month || !day) {
      throw new Error(`Resolver configuration error: failed to format current date for ${timeZone}`)
    }

    return `${year}-${month}-${day}`
  }

  private applyPackRule(
    rule: NormalizedResolverRule,
    evaluation: ReturnType<RuleEvaluatorService['evaluatePredicate']>,
    activePackCodes: Set<string>,
    runtimeData: ResolverRuntimeData,
    matchedPackRuleSnapshots: Map<string, MatchedRuleSnapshot[]>,
  ): PackResolutionDebugEntry {
    const appliedEffect = this.createAppliedEffect()

    if (!evaluation.matched) {
      appliedEffect.noOpReason = 'Predicate did not match'

      return this.buildDebugEntry(rule, evaluation, appliedEffect)
    }

    if (rule.ruleType === 'exclude') {
      if (!activePackCodes.has(rule.targetCode)) {
        appliedEffect.noOpReason = 'matched but no active target controls removed'
        return this.buildDebugEntry(rule, evaluation, appliedEffect)
      }

      const controlCodes = this.getControlCodesForPack(rule.targetCode, runtimeData)
      activePackCodes.delete(rule.targetCode)
      appliedEffect.excludedControlCodes = controlCodes

      return this.buildDebugEntry(rule, evaluation, appliedEffect)
    }

    const controlCodes = this.getControlCodesForPack(rule.targetCode, runtimeData)
    const wasAdded = !activePackCodes.has(rule.targetCode)

    activePackCodes.add(rule.targetCode)
    this.pushMatchedPackRuleSnapshot(matchedPackRuleSnapshots, rule.targetCode, rule)

    if (wasAdded) {
      appliedEffect.addedPackCodes = [rule.targetCode]
      appliedEffect.addedControlCodes = controlCodes
    } else {
      appliedEffect.noOpReason = 'matched pack already active'
    }

    return this.buildDebugEntry(rule, evaluation, appliedEffect)
  }

  private buildResolvedControls(
    activePackCodes: Set<string>,
    runtimeData: ResolverRuntimeData,
    matchedPackRuleSnapshots: Map<string, MatchedRuleSnapshot[]>,
  ): Map<string, ResolvedControl> {
    const controlsByCode = new Map<string, ResolvedControl>()

    Array.from(activePackCodes).forEach((packCode) => {
      const families = this.getFamiliesForPack(packCode, runtimeData)

      families.forEach((family) => {
        const familyControls = runtimeData.controlCatalog.filter(
          (control) => control.controlFamily === family,
        )

        if (familyControls.length === 0) {
          throw new Error(CONFIGURATION_ERROR_MESSAGE)
        }

        familyControls.forEach((catalogControl) => {
          const existing =
            controlsByCode.get(catalogControl.controlCode) ??
            this.createResolvedControl(catalogControl)

          existing.matchedPacks.push(packCode)

          const contributingRules = matchedPackRuleSnapshots.get(packCode) ?? []

          contributingRules.forEach((snapshot) => {
            existing.matchedRules.push(snapshot.ruleCode)
            if (snapshot.result?.reasonTemplate) {
              existing.reasons.push(snapshot.result.reasonTemplate)
            }

            this.applyRuleResultToControl(existing, snapshot.result)
          })

          controlsByCode.set(existing.controlCode, existing)
        })
      })
    })

    return controlsByCode
  }

  private applyControlRule(
    rule: NormalizedResolverRule,
    evaluation: ReturnType<RuleEvaluatorService['evaluatePredicate']>,
    controlsByCode: Map<string, ResolvedControl>,
  ): PackResolutionDebugEntry {
    const appliedEffect = this.createAppliedEffect()

    if (!evaluation.matched) {
      appliedEffect.noOpReason = 'Predicate did not match'
      return this.buildDebugEntry(rule, evaluation, appliedEffect)
    }

    if (rule.ruleType === 'exclude') {
      const removed = controlsByCode.get(rule.targetCode)

      if (!removed) {
        appliedEffect.noOpReason = 'matched but no active target controls removed'
        return this.buildDebugEntry(rule, evaluation, appliedEffect)
      }

      controlsByCode.delete(rule.targetCode)
      appliedEffect.excludedControlCodes = [rule.targetCode]

      return this.buildDebugEntry(rule, evaluation, appliedEffect)
    }

    const targetControl = controlsByCode.get(rule.targetCode)

    if (!targetControl) {
      appliedEffect.noOpReason = 'matched but target control is not active'
      return this.buildDebugEntry(rule, evaluation, appliedEffect)
    }

    targetControl.matchedRules.push(rule.ruleCode)
    if (rule.result?.reasonTemplate) {
      targetControl.reasons.push(rule.result.reasonTemplate)
    }
    this.applyRuleResultToControl(targetControl, rule.result)

    if (rule.ruleType === 'strengthen') {
      appliedEffect.strengthenedControlCodes = [rule.targetCode]
    } else {
      appliedEffect.addedControlCodes = [rule.targetCode]
    }

    return this.buildDebugEntry(rule, evaluation, appliedEffect)
  }

  private createResolvedControl(control: ResolverControlCatalogRecord): ResolvedControl {
    return {
      controlId: control.controlId,
      controlCode: control.controlCode,
      controlName: control.controlName,
      controlFamily: control.controlFamily,
      mandatory: control.mandatoryDefault,
      priority: control.priorityDefault,
      matchedPacks: [],
      matchedRules: [],
      reasons: [],
      questionPackCodes: [...control.questionPackCodes],
      evidencePackCodes: [...control.evidencePackCodes],
      remediationPackCodes: [...control.remediationPackCodes],
    }
  }

  private applyRuleResultToControl(control: ResolvedControl, result?: RuleResult): void {
    if (!result) {
      return
    }

    if (result.mandatory === true) {
      control.mandatory = true
    }

    if (result.priority) {
      control.priority = this.maxPriority(control.priority, result.priority)
    }

    control.questionPackCodes = this.uniqueSorted([
      ...control.questionPackCodes,
      ...(result.questionPackCodes ?? []),
    ])
    control.evidencePackCodes = this.uniqueSorted([
      ...control.evidencePackCodes,
      ...(result.evidencePackCodes ?? []),
    ])
    control.remediationPackCodes = this.uniqueSorted([
      ...control.remediationPackCodes,
      ...(result.remediationPackCodes ?? []),
    ])
  }

  private maxPriority(left: ResolutionPriority, right: ResolutionPriority): ResolutionPriority {
    return PRIORITY_RANK[left] >= PRIORITY_RANK[right] ? left : right
  }

  private pushMatchedPackRuleSnapshot(
    matchedPackRuleSnapshots: Map<string, MatchedRuleSnapshot[]>,
    packCode: string,
    rule: NormalizedResolverRule,
  ): void {
    const snapshots = matchedPackRuleSnapshots.get(packCode) ?? []

    snapshots.push({
      ruleCode: rule.ruleCode,
      targetType: rule.targetType,
      targetCode: rule.targetCode,
      ruleType: rule.ruleType,
      priority: rule.priority,
      result: rule.result,
    })

    matchedPackRuleSnapshots.set(packCode, snapshots)
  }

  private getFamiliesForPack(packCode: string, runtimeData: ResolverRuntimeData): string[] {
    const mapping = runtimeData.packFamilyMappings.find(
      (candidate) => candidate.packCode === packCode,
    )

    if (!mapping || mapping.controlFamilies.length === 0) {
      throw new Error(CONFIGURATION_ERROR_MESSAGE)
    }

    return mapping.controlFamilies
  }

  private getControlCodesForPack(packCode: string, runtimeData: ResolverRuntimeData): string[] {
    const families = this.getFamiliesForPack(packCode, runtimeData)
    const controlCodes = families.flatMap((family) => {
      const controls = runtimeData.controlCatalog.filter(
        (control) => control.controlFamily === family,
      )

      if (controls.length === 0) {
        throw new Error(CONFIGURATION_ERROR_MESSAGE)
      }

      return controls.map((control) => control.controlCode)
    })

    return this.uniqueSorted(controlCodes)
  }

  private finalizeControl(control: ResolvedControl): ResolvedControl {
    return {
      ...control,
      matchedPacks: this.uniquePackCodes(control.matchedPacks),
      matchedRules: this.uniqueInOrder(control.matchedRules),
      reasons: this.uniqueInOrder(control.reasons),
      questionPackCodes: this.uniquePackCodes(control.questionPackCodes),
      evidencePackCodes: this.uniquePackCodes(control.evidencePackCodes),
      remediationPackCodes: this.uniquePackCodes(control.remediationPackCodes),
    }
  }

  private buildNoActiveRulesResult(): ResolvedControlSet {
    return {
      matchedPacks: [],
      matchedRules: [],
      controls: [],
      summary: {
        totalControls: 0,
        mandatoryCount: 0,
        matchedPacks: 0,
        matchedRules: 0,
        excludedControls: 0,
      },
      debugLog: [
        {
          ruleCode: 'NO_ACTIVE_RULES',
          targetType: 'pack',
          targetCode: 'NO_ACTIVE_RULES',
          ruleType: 'recommend',
          matched: false,
          traceEntries: [],
          appliedEffect: {
            addedPackCodes: [],
            addedControlCodes: [],
            strengthenedControlCodes: [],
            excludedControlCodes: [],
            noOpReason: 'No active rules available for resolver execution',
          },
        },
      ],
    }
  }

  private buildDebugEntry(
    rule: NormalizedResolverRule,
    evaluation: ReturnType<RuleEvaluatorService['evaluatePredicate']>,
    appliedEffect: AppliedEffect,
  ): PackResolutionDebugEntry {
    return {
      ruleCode: rule.ruleCode,
      targetType: rule.targetType,
      targetCode: rule.targetCode,
      ruleType: rule.ruleType,
      matched: evaluation.matched,
      traceEntries: evaluation.traceEntries,
      appliedEffect,
    }
  }

  private createAppliedEffect(): AppliedEffect {
    return {
      addedPackCodes: [],
      addedControlCodes: [],
      strengthenedControlCodes: [],
      excludedControlCodes: [],
    }
  }

  private assertProfileHasRequiredFields(
    profile: Record<string, unknown>,
    rules: NormalizedResolverRule[],
  ): void {
    const requiredFields = new Set<string>()
    rules.forEach((rule) => this.collectPredicateFields(rule.predicate, requiredFields))

    const missingFields = Array.from(requiredFields).filter((field) => {
      const value = profile[field]
      return value === undefined || value === null || value === ''
    })

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Profile is missing required fields for resolver execution: ${missingFields.join(', ')}`,
      )
    }
  }

  private collectPredicateFields(predicate: RulePredicate, fields: Set<string>): void {
    const children = Object.values(predicate)[0] as Array<Record<string, unknown>>

    children.forEach((node) => {
      if (node && typeof node === 'object' && 'field' in node) {
        fields.add(node.field as string)
        return
      }

      this.collectPredicateFields(node as RulePredicate, fields)
    })
  }

  private toProfileRecord(profile: OrganizationProfile): Record<string, unknown> {
    const { organization, orgId, updatedAt, extendedProfile, ...profileRecord } = profile

    void organization
    void orgId
    void updatedAt
    void extendedProfile

    return profileRecord
  }

  private uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
  }

  private uniqueInOrder(values: string[]): string[] {
    return Array.from(new Set(values))
  }

  private uniquePackCodes(values: string[]): string[] {
    return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
  }
}
