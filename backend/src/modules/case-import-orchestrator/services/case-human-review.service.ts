import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
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
  constructor(private readonly dataSource: DataSource) {}

  async reviewCase(
    caseId: string,
    reviewerId: string,
    dto: CaseHumanReviewDto,
  ): Promise<CaseHumanReviewResult> {
    return this.dataSource.transaction(async (manager) => {
      const caseRecord = await manager.findOne(ComplianceCase, {
        where: { caseId },
        lock: { mode: 'pessimistic_write' },
      })

      if (!caseRecord) {
        throw new NotFoundException(`compliance_case ${caseId} not found`)
      }

      if (caseRecord.humanReviewed || caseRecord.status === 'reviewed') {
        throw new ConflictException(`compliance_case ${caseId} has already been human-reviewed`)
      }

      if (caseRecord.status !== 'clustered') {
        throw new BadRequestException('Only clustered cases can be human-reviewed')
      }

      const existingMaps = await manager.find(CaseControlMap, {
        where: { caseId },
      })
      const mapById = new Map(existingMaps.map((mapping) => [mapping.id, mapping]))
      const mapByControlId = new Map(existingMaps.map((mapping) => [mapping.controlId, mapping]))
      const approvedIds = new Set(dto.approvedMapIds ?? [])
      const rejectedIds = new Set(dto.rejectedMapIds ?? [])
      const overlappingDecisionIds = [...approvedIds].filter((mapId) => rejectedIds.has(mapId))

      if (overlappingDecisionIds.length > 0) {
        throw new BadRequestException(
          `case_control_map cannot be both approved and rejected: ${overlappingDecisionIds.join(', ')}`,
        )
      }

      for (const mapId of [...approvedIds, ...rejectedIds]) {
        if (!mapById.has(mapId)) {
          throw new BadRequestException(`case_control_map ${mapId} does not belong to case ${caseId}`)
        }
      }

      const selectedControlIds = new Set(
        existingMaps
          .filter((mapping) => approvedIds.has(mapping.id) || rejectedIds.has(mapping.id))
          .map((mapping) => mapping.controlId),
      )
      const seenManualControlIds = new Set<string>()

      for (const manualMapping of dto.manualMappings ?? []) {
        if (seenManualControlIds.has(manualMapping.controlId)) {
          throw new BadRequestException(
            `control_point ${manualMapping.controlId} appears multiple times in manualMappings`,
          )
        }
        seenManualControlIds.add(manualMapping.controlId)

        if (selectedControlIds.has(manualMapping.controlId)) {
          throw new BadRequestException(
            `control_point ${manualMapping.controlId} is already included in approved/rejected mappings`,
          )
        }
      }

      let approvedCount = 0
      let rejectedCount = 0

      for (const mapping of existingMaps) {
        if (approvedIds.has(mapping.id)) {
          mapping.reviewStatus = 'APPROVED'
          await manager.save(mapping)
          approvedCount += 1
        } else if (rejectedIds.has(mapping.id)) {
          mapping.reviewStatus = 'REJECTED'
          await manager.save(mapping)
          rejectedCount += 1
        }
      }

      let manualMappingCount = 0

      for (const manualMapping of dto.manualMappings ?? []) {
        const controlPoint = await manager.findOne(ControlPoint, {
          where: { controlId: manualMapping.controlId },
        })

        if (!controlPoint) {
          throw new BadRequestException(`control_point ${manualMapping.controlId} does not exist`)
        }

        const existing = mapByControlId.get(manualMapping.controlId)

        if (existing) {
          existing.relationType = manualMapping.relationType ?? existing.relationType
          existing.reviewStatus = 'APPROVED'
          existing.confidenceScore =
            manualMapping.confidenceScore === undefined
              ? existing.confidenceScore
              : manualMapping.confidenceScore.toFixed(4)
          await manager.save(existing)
        } else {
          const entity = manager.create(CaseControlMap, {
            caseId,
            controlId: manualMapping.controlId,
            relationType: manualMapping.relationType ?? 'VIOLATES',
            reviewStatus: 'APPROVED',
            confidenceScore: manualMapping.confidenceScore?.toFixed(4) ?? '1.0000',
          })
          await manager.save(entity)
          mapByControlId.set(entity.controlId, entity)
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

      await manager.save(caseRecord)

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
    })
  }
}
