import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { CaseHumanReviewDto } from '../dto/case-human-review.dto'

export type CaseHumanReviewResult = {
  caseId: string
  status: 'reviewed'
  humanReviewed: true
  reviewedBy: string
  reviewedAt: Date
  approvedCount: number
  rejectedCount: number
  manualMappingCount: number
}

@Injectable()
export class CaseHumanReviewService {
  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(CaseControlMap)
    private readonly caseControlMapRepository: Repository<CaseControlMap>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
  ) {}

  async reviewCase(
    caseId: string,
    reviewerId: string,
    dto: CaseHumanReviewDto,
  ): Promise<CaseHumanReviewResult> {
    const caseRecord = await this.complianceCaseRepository.findOne({
      where: { caseId },
    })

    if (!caseRecord) {
      throw new NotFoundException(`compliance_case ${caseId} not found`)
    }

    if (!['clustered', 'reviewed'].includes(caseRecord.status)) {
      throw new BadRequestException('Only clustered or reviewed cases can be human-reviewed')
    }

    const existingMaps = await this.caseControlMapRepository.find({
      where: { caseId },
    })
    const mapById = new Map(existingMaps.map((mapping) => [mapping.id, mapping]))
    const approvedIds = new Set(dto.approvedMapIds ?? [])
    const rejectedIds = new Set(dto.rejectedMapIds ?? [])

    for (const mapId of [...approvedIds, ...rejectedIds]) {
      if (!mapById.has(mapId)) {
        throw new BadRequestException(`case_control_map ${mapId} does not belong to case ${caseId}`)
      }
    }

    let approvedCount = 0
    let rejectedCount = 0

    for (const mapping of existingMaps) {
      if (approvedIds.has(mapping.id)) {
        mapping.reviewStatus = 'APPROVED'
        await this.caseControlMapRepository.save(mapping)
        approvedCount += 1
      } else if (rejectedIds.has(mapping.id)) {
        mapping.reviewStatus = 'REJECTED'
        await this.caseControlMapRepository.save(mapping)
        rejectedCount += 1
      }
    }

    let manualMappingCount = 0

    for (const manualMapping of dto.manualMappings ?? []) {
      const controlPoint = await this.controlPointRepository.findOne({
        where: { controlId: manualMapping.controlId },
      })

      if (!controlPoint) {
        throw new BadRequestException(`control_point ${manualMapping.controlId} does not exist`)
      }

      const existing = await this.caseControlMapRepository.findOne({
        where: {
          caseId,
          controlId: manualMapping.controlId,
        },
      })

      if (existing) {
        existing.relationType = manualMapping.relationType ?? existing.relationType
        existing.reviewStatus = 'APPROVED'
        existing.confidenceScore =
          manualMapping.confidenceScore === undefined
            ? existing.confidenceScore
            : manualMapping.confidenceScore.toFixed(4)
        await this.caseControlMapRepository.save(existing)
      } else {
        const entity = this.caseControlMapRepository.create({
          caseId,
          controlId: manualMapping.controlId,
          relationType: manualMapping.relationType ?? 'VIOLATES',
          reviewStatus: 'APPROVED',
          confidenceScore: manualMapping.confidenceScore?.toFixed(4) ?? '1.0000',
        })
        await this.caseControlMapRepository.save(entity)
      }

      manualMappingCount += 1
      approvedCount += 1
    }

    caseRecord.candidateControlPoints =
      dto.candidateControlPoints ?? caseRecord.candidateControlPoints
    caseRecord.humanReviewed = true
    caseRecord.reviewedBy = reviewerId
    caseRecord.reviewedAt = new Date()
    caseRecord.status = 'reviewed'

    await this.complianceCaseRepository.save(caseRecord)

    return {
      caseId: caseRecord.caseId,
      status: 'reviewed',
      humanReviewed: true,
      reviewedBy: reviewerId,
      reviewedAt: caseRecord.reviewedAt,
      approvedCount,
      rejectedCount,
      manualMappingCount,
    }
  }
}
