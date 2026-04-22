import { NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { ComplianceCaseService } from '../../knowledge-graph/services/compliance-case.service'
import { ControlPackLinkService } from '../../knowledge-graph/services/control-pack-link.service'
import { ControlPointService } from '../../knowledge-graph/services/control-point.service'
import { EvidenceService } from '../../knowledge-graph/services/evidence.service'
import { ObligationService } from '../../knowledge-graph/services/obligation.service'
import { QuestionItemService } from '../../knowledge-graph/services/question-item.service'
import { RegulationService } from '../../knowledge-graph/services/regulation.service'
import { RemediationActionService } from '../../knowledge-graph/services/remediation-action.service'
import { QueryControlExplainDto } from '../dto/control-explain.dto'

const ADMIN_APPLICABILITY_REASON =
  '管理端详情不计算机构适用性，请在组织上下文中查看适用性说明'
const ORGANIZATION_APPLICABILITY_CONTEXT_MISSING_REASON =
  '机构适用性上下文缺失，请刷新后重试'

export class ControlExplainService {
  constructor(
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(FailureModeControlMap)
    private readonly failureModeControlMapRepository: Repository<FailureModeControlMap>,
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
    private readonly controlPackLinkService: ControlPackLinkService,
    private readonly controlPointService: ControlPointService,
    private readonly obligationService: ObligationService,
    private readonly regulationService: RegulationService,
    private readonly complianceCaseService: ComplianceCaseService,
    private readonly evidenceService: EvidenceService,
    private readonly questionItemService: QuestionItemService,
    private readonly remediationActionService: RemediationActionService,
  ) {}

  async getControlExplain(controlId: string, query: QueryControlExplainDto) {
    return this.buildControlExplain(controlId, {
      organizationId: query.organizationId,
      mode: 'organization',
    })
  }

  async getAdminControlExplain(controlId: string) {
    return this.buildControlExplain(controlId, {
      mode: 'admin',
    })
  }

  private async buildControlExplain(
    controlId: string,
    options:
      | {
          mode: 'organization'
          organizationId: string
        }
      | {
          mode: 'admin'
        },
  ) {
    const control = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!control) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    const applicabilityContextPromise =
      options.mode === 'organization'
        ? this.controlPackLinkService.buildApplicabilityContext(controlId, {
            organizationId: options.organizationId,
          })
        : Promise.resolve(null)

    const [l1, l2, applicabilityContext, clauses, cases, evidences, questions, remediations, fullChain, regulatoryLinks, failureModeMaps] =
      await Promise.all([
        this.taxonomyL1Repository.findOne({ where: { l1Code: control.l1Code } }),
        this.taxonomyL2Repository.findOne({ where: { l2Code: control.l2Code } }),
        applicabilityContextPromise,
        this.regulationService.findClausesByControlId(controlId),
        this.complianceCaseService.findCasesByControlId(controlId),
        this.evidenceService.findEvidencesByControlId(controlId),
        this.questionItemService.findByControlId(controlId),
        this.remediationActionService.findByControlId(controlId),
        this.controlPointService.findByL2CodeWithFullChain(control.l2Code).catch((error) => {
          if (error instanceof NotFoundException) {
            return null
          }

          throw error
        }),
        this.obligationService.findRegulatoryLinksByControlId(controlId),
        this.failureModeControlMapRepository
          .createQueryBuilder('fmcm')
          .leftJoinAndSelect('fmcm.failureMode', 'fm')
          .where('fmcm.control_id = :controlId', { controlId })
          .andWhere('fm.status = :status', { status: 'ACTIVE' })
          .orderBy(`CASE WHEN fmcm.relevance = 'PRIMARY' THEN 0 ELSE 1 END`, 'ASC')
          .addOrderBy('fm.failure_mode_code', 'ASC')
          .getMany()
          .catch(() => []),
      ])

    const failureModes = this.buildFailureModes(failureModeMaps)
    const reasoningChain = this.buildReasoningChain({
      control,
      l2Name: l2?.l2Name ?? fullChain?.l2Name ?? null,
      cases,
      fullChain,
      controlId,
    })

    return {
      control: {
        controlId: control.controlId,
        controlCode: control.controlCode,
        controlName: control.controlName,
        controlDesc: control.controlDesc,
        l1: {
          code: control.l1Code,
          name: l1?.l1Name ?? null,
        },
        l2: {
          code: control.l2Code,
          name: l2?.l2Name ?? null,
        },
      },
      governance: {
        originType: control.originType,
        maturityLevel: control.maturityLevel,
        authoritativeScore: this.normalizeScore(control.authoritativeScore),
        authorityProfile: control.authorityProfileJson,
        applicableSector: control.applicableSector ?? [],
        sectorRequirements: control.sectorRequirements ?? {},
      },
      applicabilityReason: this.buildApplicabilityReason(applicabilityContext, options.mode),
      failureModes,
      obligations: this.trimObligations(regulatoryLinks.obligations),
      reasoningChain,
      clauses,
      cases,
      evidences: evidences.evidences,
      questions: questions.questions,
      remediations: remediations.remediations,
    }
  }

  private buildApplicabilityReason(
    context:
      | {
          matched?: boolean
          reasons?: string[]
          matchedPacks?: Array<{ packCode: string }>
          matchedRules?: string[]
        }
      | null,
    mode: 'organization' | 'admin',
  ): string {
    if (!context) {
      return mode === 'admin'
        ? ADMIN_APPLICABILITY_REASON
        : ORGANIZATION_APPLICABILITY_CONTEXT_MISSING_REASON
    }

    if (context.matched && context.reasons && context.reasons.length > 0) {
      return context.reasons.join('；')
    }

    if (context.matched && context.matchedPacks && context.matchedPacks.length > 0) {
      return `命中控制包：${context.matchedPacks.map((pack) => pack.packCode).join('、')}`
    }

    if (context.matched && context.matchedRules && context.matchedRules.length > 0) {
      return `命中规则：${context.matchedRules.join('、')}`
    }

    return '当前机构画像下未命中该控制点'
  }

  private buildFailureModes(
    failureModeMaps: FailureModeControlMap[],
  ) {
    if (failureModeMaps.length === 0) {
      return []
    }

    return failureModeMaps.map((item) => ({
      failureModeId: item.failureMode?.failureModeId ?? item.failureModeId,
      failureModeCode: item.failureMode?.failureModeCode ?? '',
      name: item.failureMode?.name ?? '',
      category: item.failureMode?.category ?? '',
      relevance: item.relevance,
    }))
  }

  private buildReasoningChain(input: {
    control: ControlPoint
    l2Name: string | null
    cases: Array<{ caseCode?: string; caseTitle?: string }>
    fullChain: Awaited<ReturnType<ControlPointService['findByL2CodeWithFullChain']>> | null
    controlId: string
  }) {
    const relatedFailureModes = input.fullChain
      ? input.fullChain.failureModes
          .map((failureMode) => {
            const currentControl = failureMode.controlPoints.find((item) => item.controlId === input.controlId)
            if (!currentControl) {
              return null
            }

            return {
              failureModeId: failureMode.failureModeId,
              failureModeCode: failureMode.failureModeCode,
              name: failureMode.name,
              relevance: currentControl.relevance,
              evidenceTypes: currentControl.evidenceTypes,
            }
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : []

    const evidenceTypeMap = new Map<string, {
      evidenceId: string
      evidenceCode: string
      evidenceName: string
      evidenceCategory: string | null
      autoCollectable: boolean
      requiredLevel: string
      frequency: string | null
    }>()

    let dedupIndex = 0
    for (const failureMode of relatedFailureModes) {
      for (const evidenceType of failureMode.evidenceTypes) {
        const key = evidenceType.evidenceId || evidenceType.evidenceCode || `__dedup_${dedupIndex++}`
        if (!evidenceTypeMap.has(key)) {
          evidenceTypeMap.set(key, evidenceType)
        }
      }
    }

    return {
      l2: {
        code: input.control.l2Code,
        name: input.l2Name,
      },
      cases: input.cases.map((item) => ({
        caseCode: item.caseCode ?? null,
        caseTitle: item.caseTitle ?? null,
      })),
      failureModes: relatedFailureModes.map((failureMode) => ({
        failureModeId: failureMode.failureModeId,
        failureModeCode: failureMode.failureModeCode,
        name: failureMode.name,
        relevance: failureMode.relevance,
      })),
      selectedControl: {
        controlId: input.control.controlId,
        controlCode: input.control.controlCode,
        controlName: input.control.controlName,
        maturityLevel: input.control.maturityLevel,
        authoritativeScore: this.normalizeScore(input.control.authoritativeScore),
      },
      evidenceTypes: Array.from(evidenceTypeMap.values()),
    }
  }

  private normalizeScore(value: number | null | undefined) {
    if (value == null) {
      return null
    }

    return Number(value)
  }

  private trimObligations(obligations: Array<Record<string, unknown>>) {
    return obligations.map((item) => ({
      obligationId: item.obligationId ?? '',
      obligationCode: item.obligationCode ?? '',
      obligationText: item.obligationText ?? '',
      obligationType: item.obligationType ?? null,
      coverage: item.coverage ?? null,
      clause: item.clause ?? null,
    }))
  }
}
