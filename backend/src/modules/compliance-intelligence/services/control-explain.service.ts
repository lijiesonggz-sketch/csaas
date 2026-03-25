import { NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { ComplianceCaseService } from '../../knowledge-graph/services/compliance-case.service'
import { ControlPackLinkService } from '../../knowledge-graph/services/control-pack-link.service'
import { EvidenceService } from '../../knowledge-graph/services/evidence.service'
import { QuestionItemService } from '../../knowledge-graph/services/question-item.service'
import { RegulationService } from '../../knowledge-graph/services/regulation.service'
import { RemediationActionService } from '../../knowledge-graph/services/remediation-action.service'
import { QueryControlExplainDto } from '../dto/control-explain.dto'

export class ControlExplainService {
  constructor(
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
    private readonly controlPackLinkService: ControlPackLinkService,
    private readonly regulationService: RegulationService,
    private readonly complianceCaseService: ComplianceCaseService,
    private readonly evidenceService: EvidenceService,
    private readonly questionItemService: QuestionItemService,
    private readonly remediationActionService: RemediationActionService,
  ) {}

  async getControlExplain(controlId: string, query: QueryControlExplainDto) {
    const control = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!control) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    const [l1, l2, applicabilityContext, clauses, cases, evidences, questions, remediations] =
      await Promise.all([
        this.taxonomyL1Repository.findOne({ where: { l1Code: control.l1Code } }),
        this.taxonomyL2Repository.findOne({ where: { l2Code: control.l2Code } }),
        this.controlPackLinkService.buildApplicabilityContext(controlId, query),
        this.regulationService.findClausesByControlId(controlId),
        this.complianceCaseService.findCasesByControlId(controlId),
        this.evidenceService.findEvidencesByControlId(controlId),
        this.questionItemService.findByControlId(controlId),
        this.remediationActionService.findByControlId(controlId),
      ])

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
      applicabilityReason: this.buildApplicabilityReason(applicabilityContext),
      clauses,
      cases,
      evidences: evidences.evidences,
      questions: questions.questions,
      remediations: remediations.remediations,
    }
  }

  private buildApplicabilityReason(context: {
    matched?: boolean
    reasons?: string[]
    matchedPacks?: Array<{ packCode: string }>
    matchedRules?: string[]
  }): string {
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
}
