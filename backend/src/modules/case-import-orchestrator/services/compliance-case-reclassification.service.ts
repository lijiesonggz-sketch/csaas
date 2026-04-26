import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import {
  CaseExtractionService,
  type ComplianceCaseReclassificationResult,
} from './case-extraction.service'

export type ComplianceCaseReclassificationParams = {
  batchId?: string
  caseIds?: string[]
  l1Code?: string
  classifierVersion?: string | null
  shadowOnly?: boolean
  forceLatestPointer?: boolean
  dryRun?: boolean
  limit?: number
  offset?: number
}

export type ComplianceCaseReclassificationReport = {
  dryRun: boolean
  reranClustering: false
  latestPointerUpdated: boolean
  caseCount: number
  affectedDomains: string[]
  classifierVersion: string | null
  scope: {
    batchId: string | null
    caseIds: string[]
    l1Code: string | null
    shadowOnly: boolean
    forceLatestPointer: boolean
  }
}

@Injectable()
export class ComplianceCaseReclassificationService {
  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    private readonly caseExtractionService: CaseExtractionService,
  ) {}

  async reclassify(
    params: ComplianceCaseReclassificationParams,
  ): Promise<ComplianceCaseReclassificationReport> {
    if (!params.batchId && !params.caseIds?.length && !params.l1Code) {
      throw new BadRequestException('batchId, caseIds, or l1Code is required for reclassification')
    }

    const where = params.caseIds?.length
      ? params.l1Code
        ? { caseId: In(params.caseIds), l1Code: params.l1Code }
        : { caseId: In(params.caseIds) }
      : params.batchId
        ? params.l1Code
          ? { importBatchId: params.batchId, l1Code: params.l1Code }
          : { importBatchId: params.batchId }
        : params.l1Code
          ? { l1Code: params.l1Code }
          : undefined

    const cases = await this.complianceCaseRepository.find({
      where,
      order: {
        createdAt: 'ASC',
      },
      ...(params.limit !== undefined ? { take: params.limit } : {}),
      ...(params.offset !== undefined ? { skip: params.offset } : {}),
    })

    const scopedCases = cases

    if (scopedCases.length === 0) {
      throw new BadRequestException('No compliance cases matched the requested reclassification scope')
    }

    const affectedDomains = Array.from(
      new Set(
        scopedCases
          .map((caseRecord) => caseRecord.l1Code)
          .filter((l1Code): l1Code is string => Boolean(l1Code)),
      ),
    ).sort()

    const latestPointerUpdated =
      !params.shadowOnly || params.forceLatestPointer === true
    const scope = {
      batchId: params.batchId ?? null,
      caseIds: scopedCases.map((caseRecord) => caseRecord.caseId),
      l1Code: params.l1Code ?? null,
      shadowOnly: params.shadowOnly === true,
      forceLatestPointer: params.forceLatestPointer === true,
    }

    if (params.dryRun) {
      return {
        dryRun: true,
        reranClustering: false,
        latestPointerUpdated,
        caseCount: scopedCases.length,
        affectedDomains,
        classifierVersion: params.classifierVersion ?? null,
        scope,
      }
    }

    const result: ComplianceCaseReclassificationResult =
      await this.caseExtractionService.reclassifyCases({
        caseIds: scope.caseIds,
        shadowOnly: scope.shadowOnly,
        forceLatestPointer: scope.forceLatestPointer,
        classifierVersion: params.classifierVersion ?? null,
      })

    return {
      dryRun: false,
      reranClustering: false,
      latestPointerUpdated: result.latestPointerUpdated,
      caseCount: result.processedCount,
      affectedDomains:
        result.affectedDomains.length > 0
          ? result.affectedDomains
          : affectedDomains,
      classifierVersion: result.classifierVersion,
      scope,
    }
  }
}
