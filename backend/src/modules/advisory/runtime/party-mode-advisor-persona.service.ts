import { Injectable } from '@nestjs/common'
import * as Papa from 'papaparse'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import {
  ThinkTankPartyModeAdvisorOmission,
  ThinkTankPartyModeAdvisorPersona,
  ThinkTankPartyModeAdvisorSelection,
  ThinkTankPartyModeAdvisorSelectionRequest,
} from './runtime.types'

type AdvisorCsvRow = Record<string, string>

interface AdvisorCandidate {
  id: string
  displayName: string
  role: string
  identity: string
  communicationStyle: string
  principles: string
  capabilities: string[]
  module: string
  sourcePath: string
  approvedByTeam: boolean
}

interface ApprovedAdvisorCandidates {
  candidates: AdvisorCandidate[]
  omittedAdvisors: ThinkTankPartyModeAdvisorOmission[]
}

const PARTY_MODE_AGENT_MANIFEST_PATH = '_bmad/_config/agent-manifest.csv'
const PARTY_MODE_TEAM_PATHS = [
  '_bmad/cis/teams/default-party.csv',
  '_bmad/bmm/teams/default-party.csv',
  '_bmad/tea/teams/default-party.csv',
]
const DEFAULT_TARGET_ADVISOR_COUNT = 3
const DEFAULT_MINIMUM_ADVISOR_COUNT = 3

const WORKFLOW_ADVISOR_PREFERENCES: Record<string, string[]> = {
  'problem-solving': ['creative-problem-solver', 'architect', 'pm', 'analyst'],
  'design-thinking': ['design-thinking-coach', 'ux-designer', 'pm', 'architect'],
  storytelling: ['storyteller', 'presentation-master', 'pm', 'analyst'],
  prd: ['analyst', 'pm', 'architect', 'ux-designer'],
  'product-brief': ['analyst', 'pm', 'architect', 'innovation-strategist'],
  'market-research': ['analyst', 'pm', 'architect', 'innovation-strategist'],
  'domain-research': ['analyst', 'pm', 'architect', 'creative-problem-solver'],
  brainstorming: ['brainstorming-coach', 'innovation-strategist', 'pm', 'ux-designer'],
}

@Injectable()
export class ThinkTankPartyModeAdvisorPersonaService {
  constructor(
    private readonly fileProvider: ThinkTankRuntimeFileProviderService,
    private readonly brandMapper: ThinkTankBrandMapperService,
  ) {}

  async selectAdvisors(
    request: ThinkTankPartyModeAdvisorSelectionRequest,
  ): Promise<ThinkTankPartyModeAdvisorSelection> {
    const targetCount = request.targetCount ?? DEFAULT_TARGET_ADVISOR_COUNT
    const minimumCount = request.minimumCount ?? DEFAULT_MINIMUM_ADVISOR_COUNT
    this.assertValidAdvisorCounts(targetCount, minimumCount)

    const approvedCandidates = await this.loadApprovedCandidates()
    const candidates = approvedCandidates.candidates
    const orderedCandidates = this.orderCandidatesForWorkflow(candidates, request)
    const selected: ThinkTankPartyModeAdvisorPersona[] = []
    const omitted: ThinkTankPartyModeAdvisorOmission[] = [
      ...approvedCandidates.omittedAdvisors,
    ]
    const selectedRoleFamilies = new Set<string>()
    const attempted = new Set<string>()

    for (const candidate of orderedCandidates) {
      if (selected.length >= targetCount) break
      if (attempted.has(candidate.id)) continue

      const roleFamily = this.toRoleFamily(candidate)
      if (
        selectedRoleFamilies.has(roleFamily) &&
        this.hasUnusedRoleFamilies(orderedCandidates, selectedRoleFamilies, attempted, candidate.id)
      ) {
        continue
      }

      attempted.add(candidate.id)
      const persona = await this.tryLoadPersona(candidate, request, roleFamily, omitted)
      if (!persona) continue

      selected.push(persona)
      selectedRoleFamilies.add(persona.roleFamily)
    }

    if (selected.length < targetCount) {
      for (const candidate of orderedCandidates) {
        if (selected.length >= targetCount) break
        if (attempted.has(candidate.id)) continue
        attempted.add(candidate.id)

        const persona = await this.tryLoadPersona(
          candidate,
          request,
          this.toRoleFamily(candidate),
          omitted,
        )
        if (persona) {
          selected.push(persona)
        }
      }
    }

    if (selected.length < minimumCount) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.PartyModeAdvisorSetUnavailable,
        'Party Mode requires at least three approved ThinkTank advisors',
        {
          details: {
            viableAdvisorCount: selected.length,
            minimumAdvisorCount: minimumCount,
            omittedAdvisorCount: omitted.length,
          },
        },
      )
    }

    return {
      advisors: selected,
      omittedAdvisors: omitted,
      visibleSummary: this.buildVisibleSummary(selected, omitted),
      metadata: this.toSelectionMetadata(selected, omitted),
    }
  }

  private async loadApprovedCandidates(): Promise<ApprovedAdvisorCandidates> {
    const manifestRows = await this.loadCsvRows(PARTY_MODE_AGENT_MANIFEST_PATH, [
      'name',
      'displayName',
      'path',
    ])
    const manifestByName = new Map(
      manifestRows
        .map((row) => this.toCandidate(row, false))
        .filter((candidate): candidate is AdvisorCandidate => Boolean(candidate))
        .map((candidate) => [candidate.id, candidate]),
    )
    const teamCandidates: AdvisorCandidate[] = []
    const omittedAdvisors: ThinkTankPartyModeAdvisorOmission[] = []
    let teamRowsSeen = 0

    for (const teamPath of PARTY_MODE_TEAM_PATHS) {
      const rows = await this.loadOptionalCsvRows(teamPath)
      teamRowsSeen += rows.length

      for (const row of rows) {
        const teamCandidate = this.toTeamCandidate(row, manifestByName)
        if (!teamCandidate) {
          const displayName = this.asVisibleText(row.displayName || row.name || 'Unknown Advisor')
          omittedAdvisors.push({
            id: this.asVisibleText(row.name).toLowerCase() || 'unknown-advisor',
            displayName,
            reason: '顾问来源缺少批准的 agent 定义，已从本次候选集中略过。',
          })
          continue
        }

        teamCandidates.push(teamCandidate)
      }
    }

    const approvedByName = new Map<string, AdvisorCandidate>()
    for (const candidate of teamCandidates) {
      approvedByName.set(candidate.id, candidate)
    }

    if (approvedByName.size === 0 && teamRowsSeen === 0) {
      for (const candidate of manifestByName.values()) {
        approvedByName.set(candidate.id, candidate)
      }
    }

    return {
      candidates: [...approvedByName.values()].filter((candidate) => Boolean(candidate.sourcePath)),
      omittedAdvisors,
    }
  }

  private async loadOptionalCsvRows(sourcePath: string): Promise<AdvisorCsvRow[]> {
    try {
      return await this.loadCsvRows(sourcePath, ['name', 'displayName'])
    } catch (error) {
      if (
        error instanceof ThinkTankRuntimeError &&
        error.code === ThinkTankRuntimeErrorCode.FileNotFound
      ) {
        return []
      }

      throw error
    }
  }

  private async loadCsvRows(
    sourcePath: string,
    requiredFields: string[],
  ): Promise<AdvisorCsvRow[]> {
    const descriptor = await this.fileProvider.load(sourcePath)
    const parsed = Papa.parse<AdvisorCsvRow>(descriptor.content, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Party Mode advisor CSV is malformed',
        { sourcePath, details: { errors: parsed.errors.map((error) => error.message) } },
      )
    }

    const fields = parsed.meta.fields ?? []
    for (const requiredField of requiredFields) {
      if (!fields.includes(requiredField)) {
        throw new ThinkTankRuntimeError(
          ThinkTankRuntimeErrorCode.WorkflowMalformed,
          'Party Mode advisor CSV is missing required fields',
          { sourcePath, details: { requiredField, fields } },
        )
      }
    }

    return parsed.data
  }

  private toTeamCandidate(
    row: AdvisorCsvRow,
    manifestByName: Map<string, AdvisorCandidate>,
  ): AdvisorCandidate | null {
    const id = this.asVisibleText(row.name).toLowerCase()
    if (!id) return null

    const rowCandidate = this.toCandidate(row, true)
    const manifestCandidate = manifestByName.get(id)
    const baseCandidate = rowCandidate ?? manifestCandidate
    const sourcePath = manifestCandidate?.sourcePath ?? rowCandidate?.sourcePath
    if (!baseCandidate || !sourcePath) return null

    return {
      ...baseCandidate,
      ...(manifestCandidate ?? {}),
      sourcePath,
      approvedByTeam: true,
    }
  }

  private toCandidate(row: AdvisorCsvRow, approvedByTeam: boolean): AdvisorCandidate | null {
    const id = this.asVisibleText(row.name).toLowerCase()
    const sourcePath = this.normalizeSourcePath(this.asText(row.path))

    if (!id || !sourcePath) return null

    return {
      id,
      displayName: this.asVisibleText(row.displayName || row.name),
      role: this.asVisibleText(row.role || row.title || 'ThinkTank Advisor'),
      identity: this.asVisibleText(row.identity),
      communicationStyle: this.asVisibleText(row.communicationStyle),
      principles: this.asVisibleText(row.principles),
      capabilities: this.splitCapabilities(row.capabilities),
      module: this.asVisibleText(row.module),
      sourcePath,
      approvedByTeam,
    }
  }

  private orderCandidatesForWorkflow(
    candidates: AdvisorCandidate[],
    request: ThinkTankPartyModeAdvisorSelectionRequest,
  ) {
    const normalizedWorkflowKey = request.workflowKey.trim().toLowerCase()
    const preferences =
      WORKFLOW_ADVISOR_PREFERENCES[normalizedWorkflowKey] ??
      WORKFLOW_ADVISOR_PREFERENCES['problem-solving']
    const preferenceRank = new Map(preferences.map((id, index) => [id, preferences.length - index]))

    return [...candidates].sort((left, right) => {
      const leftScore =
        (preferenceRank.get(left.id) ?? 0) * 10 + this.toContextRelevanceScore(left, request)
      const rightScore =
        (preferenceRank.get(right.id) ?? 0) * 10 + this.toContextRelevanceScore(right, request)
      const scoreDelta = rightScore - leftScore
      if (scoreDelta !== 0) return scoreDelta

      const preferenceDelta =
        (preferenceRank.get(right.id) ?? 0) - (preferenceRank.get(left.id) ?? 0)
      if (preferenceDelta !== 0) return preferenceDelta

      if (left.approvedByTeam !== right.approvedByTeam) return left.approvedByTeam ? -1 : 1
      return left.id.localeCompare(right.id)
    })
  }

  private toContextRelevanceScore(
    candidate: AdvisorCandidate,
    request: ThinkTankPartyModeAdvisorSelectionRequest,
  ) {
    const context = this.toRequestContext(request)
    if (!context) return 0

    let score = 0
    for (const capability of candidate.capabilities) {
      const normalizedCapability = capability.trim().toLowerCase()
      if (!normalizedCapability) continue
      if (context.includes(normalizedCapability)) {
        score += 50
        continue
      }

      score += this.toSearchTokens(normalizedCapability).filter((token) =>
        context.includes(token),
      ).length * 8
    }

    const descriptorTokens = this.toSearchTokens(
      `${candidate.id} ${candidate.role} ${candidate.identity} ${candidate.principles}`,
    )
    score += descriptorTokens.filter((token) => context.includes(token)).length * 2

    return score
  }

  private toRequestContext(request: ThinkTankPartyModeAdvisorSelectionRequest) {
    return this.toSearchTokens(
      [request.workflowKey, request.currentStepLabel, request.currentStepSourceRef, request.latestUserMessage]
        .filter(Boolean)
        .join(' '),
    ).join(' ')
  }

  private toSearchTokens(value: string) {
    return value
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fff]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  }

  private async tryLoadPersona(
    candidate: AdvisorCandidate,
    request: ThinkTankPartyModeAdvisorSelectionRequest,
    roleFamily: string,
    omitted: ThinkTankPartyModeAdvisorOmission[],
  ): Promise<ThinkTankPartyModeAdvisorPersona | null> {
    try {
      const source = await this.fileProvider.load(candidate.sourcePath)
      this.assertApprovedAgentSourcePath(source.relativePath)

      return {
        id: candidate.id,
        displayName: candidate.displayName,
        role: candidate.role,
        identity: candidate.identity,
        communicationStyle: candidate.communicationStyle,
        principles: candidate.principles,
        capabilities: candidate.capabilities,
        module: candidate.module,
        sourcePath: source.relativePath,
        sourceHash: source.contentHash,
        roleFamily,
        perspective: this.toPerspective(candidate, roleFamily),
        selectionReason: this.toSelectionReason(candidate, request, roleFamily),
      }
    } catch (error) {
      if (!this.isRecoverablePersonaLoadError(error)) {
        throw error
      }

      omitted.push({
        id: candidate.id,
        displayName: candidate.displayName,
        sourcePath: candidate.sourcePath,
        reason: '顾问源文件不可用，本次先由其余 ThinkTank 顾问继续。',
      })
      return null
    }
  }

  private assertValidAdvisorCounts(targetCount: number, minimumCount: number) {
    if (
      !Number.isInteger(targetCount) ||
      !Number.isInteger(minimumCount) ||
      targetCount < 1 ||
      minimumCount < 1 ||
      minimumCount > targetCount
    ) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.PartyModeAdvisorSetUnavailable,
        'Party Mode advisor selection counts are invalid',
        { details: { targetCount, minimumCount } },
      )
    }
  }

  private assertApprovedAgentSourcePath(sourcePath: string) {
    if (/^_bmad\/(?:cis|bmm|tea)\/agents\/.+\.(?:md|ya?ml)$/.test(sourcePath)) {
      return
    }

    throw new ThinkTankRuntimeError(
      ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
      'Party Mode advisor source must be an approved agent definition',
      { sourcePath },
    )
  }

  private isRecoverablePersonaLoadError(error: unknown) {
    if (!(error instanceof ThinkTankRuntimeError)) return false

    return [
      ThinkTankRuntimeErrorCode.FileNotFound,
      ThinkTankRuntimeErrorCode.FileUnreadable,
      ThinkTankRuntimeErrorCode.EmptyFile,
    ].includes(error.code as ThinkTankRuntimeErrorCode)
  }

  private hasUnusedRoleFamilies(
    candidates: AdvisorCandidate[],
    selectedRoleFamilies: Set<string>,
    attempted: Set<string>,
    currentCandidateId?: string,
  ) {
    return candidates.some((candidate) => {
      if (candidate.id === currentCandidateId) return false
      if (attempted.has(candidate.id)) return false
      return !selectedRoleFamilies.has(this.toRoleFamily(candidate))
    })
  }

  private toRoleFamily(candidate: AdvisorCandidate) {
    const haystack =
      `${candidate.id} ${candidate.role} ${candidate.capabilities.join(' ')}`.toLowerCase()

    if (/problem|root cause|triz|systems thinking|solution/.test(haystack)) {
      return 'problem-solving'
    }
    if (/architect|technical|api|cloud|system|infrastructure|distributed/.test(haystack)) {
      return 'technical'
    }
    if (/market|research|analysis|competitive|domain/.test(haystack)) {
      return 'research'
    }
    if (/product|pm|prd|stakeholder|user value|requirements/.test(haystack)) {
      return 'product'
    }
    if (/design|ux|empathy|interaction|prototype/.test(haystack)) {
      return 'design'
    }
    if (/story|presentation|narrative|communication/.test(haystack)) {
      return 'narrative'
    }
    if (/test|quality|qa|risk/.test(haystack)) {
      return 'quality'
    }

    return 'advisory'
  }

  private toPerspective(candidate: AdvisorCandidate, roleFamily: string) {
    const explicit: Record<string, string> = {
      technical: '技术架构可行性',
      product: '产品价值与优先级',
      'problem-solving': '系统性问题诊断',
      design: '用户体验与验证',
      narrative: '叙事表达与影响力',
      research: '业务证据与市场判断',
      quality: '质量风险与验证',
    }

    return explicit[roleFamily] ?? `${candidate.role} 视角`
  }

  private toSelectionReason(
    candidate: AdvisorCandidate,
    request: ThinkTankPartyModeAdvisorSelectionRequest,
    roleFamily: string,
  ) {
    const context = [
      request.currentStepLabel,
      request.currentStepSourceRef,
      request.latestUserMessage,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const capabilityHit = candidate.capabilities.find((capability) =>
      context.includes(capability.toLowerCase()),
    )

    if (capabilityHit) {
      return `${this.toPerspective(candidate, roleFamily)}匹配当前上下文：${capabilityHit}`
    }

    return `${this.toPerspective(candidate, roleFamily)}补足讨论差异化`
  }

  private buildVisibleSummary(
    advisors: ThinkTankPartyModeAdvisorPersona[],
    omitted: ThinkTankPartyModeAdvisorOmission[],
  ) {
    const advisorLines = advisors.map(
      (advisor) => `- ${advisor.displayName}：${advisor.perspective}。${advisor.selectionReason}。`,
    )
    const omissionLines = omitted.map(
      (advisor) => `- 已略过 ${advisor.displayName}：${advisor.reason}`,
    )
    const sections = [
      'Party Mode 上下文已创建。以下 ThinkTank 顾问将先从不同视角进入讨论：',
      ...advisorLines,
    ]

    if (omissionLines.length > 0) {
      sections.push('部分候选顾问未加入：', ...omissionLines)
    }

    sections.push('多角色顾问讨论将在后续步骤基于当前工作流继续，完成后可返回原工作流。')

    return this.brandMapper.mapVisibleText(sections.join('\n'))
  }

  private toSelectionMetadata(
    advisors: ThinkTankPartyModeAdvisorPersona[],
    omitted: ThinkTankPartyModeAdvisorOmission[],
  ): Record<string, string | number | boolean | null> {
    return {
      party_mode_advisor_count: advisors.length,
      party_mode_selected_advisor_ids: this.joinOrNull(advisors.map((advisor) => advisor.id)),
      party_mode_selected_advisor_names: this.joinOrNull(
        advisors.map((advisor) => advisor.displayName),
      ),
      party_mode_selected_advisor_roles: this.joinOrNull(advisors.map((advisor) => advisor.role)),
      party_mode_selected_advisor_perspectives: this.joinOrNull(
        advisors.map((advisor) => advisor.perspective),
      ),
      party_mode_selected_advisor_source_paths: this.joinOrNull(
        advisors.map((advisor) => advisor.sourcePath),
      ),
      party_mode_selected_advisor_source_hashes: this.joinOrNull(
        advisors.map((advisor) => advisor.sourceHash),
      ),
      party_mode_selected_advisor_reasons: this.joinOrNull(
        advisors.map((advisor) => advisor.selectionReason),
      ),
      party_mode_selected_advisor_role_families: this.joinOrNull(
        advisors.map((advisor) => advisor.roleFamily),
      ),
      party_mode_omitted_advisor_count: omitted.length,
      party_mode_omitted_advisors: this.joinOrNull(omitted.map((advisor) => advisor.displayName)),
      party_mode_omission_reasons: this.joinOrNull(omitted.map((advisor) => advisor.reason)),
    }
  }

  private splitCapabilities(value: unknown) {
    return this.asVisibleText(value)
      .split(',')
      .map((capability) => capability.trim())
      .filter(Boolean)
  }

  private normalizeSourcePath(value: string) {
    return value
      .replace(/\\/g, '/')
      .replace(/^bmad\//, '_bmad/')
      .replace(/^([^_])/, '_bmad/$1')
  }

  private joinOrNull(values: string[]) {
    const filtered = values.map((value) => value.trim()).filter(Boolean)
    return filtered.length > 0 ? filtered.join('|') : null
  }

  private asVisibleText(value: unknown) {
    return this.brandMapper.mapVisibleText(this.decodeHtmlEntities(this.asText(value))).trim()
  }

  private asText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }
}
