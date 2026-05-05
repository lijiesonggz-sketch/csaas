import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { CaseControlMapSource } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { CaseClusteringService } from './case-clustering.service'
import { CaseExtractionService } from './case-extraction.service'

export type ComplianceCaseBackfillReport = {
  requestedCount: number
  resetCount: number
  skippedReviewedCount: number
  skippedMissingBatchCount: number
  extractedCount: number
  clusteredCount: number
  autoMappedCaseCount: number
  unmappedCaseCount: number
  ruleMappedCaseCount: number
  llmTriggeredCaseCount: number
  llmAssistedRuleCaseCount: number
  llmFallbackCaseCount: number
  llmUnmappedCaseCount: number
  mapCountBySource: Record<CaseControlMapSource, number>
  mappedCaseCountBySource: Record<CaseControlMapSource, number>
  batchIds: string[]
  affectedDomains: string[]
  rollbackCompatible: boolean
  requiresLegacyCodeRestore: boolean
}

@Injectable()
export class ComplianceCaseBackfillService {
  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(CaseControlMap)
    private readonly caseControlMapRepository: Repository<CaseControlMap>,
    private readonly caseExtractionService: CaseExtractionService,
    private readonly caseClusteringService: CaseClusteringService,
  ) {}

  async backfill(params: {
    batchId?: string
    caseIds?: string[]
    l1Code?: string
    includeRetirementReadiness?: boolean
    dryRun?: boolean
  }): Promise<ComplianceCaseBackfillReport> {
    const where = params.caseIds?.length
      ? {
          caseId: In(params.caseIds),
          ...(params.batchId ? { importBatchId: params.batchId } : {}),
          ...(params.l1Code ? { l1Code: params.l1Code } : {}),
        }
      : params.batchId
        ? params.l1Code
          ? { importBatchId: params.batchId, l1Code: params.l1Code }
          : { importBatchId: params.batchId }
        : params.l1Code
          ? { l1Code: params.l1Code }
          : null
    const includeRetirementReadiness = params.includeRetirementReadiness !== false

    if (!where) {
      throw new BadRequestException('batchId or caseIds is required for compliance case backfill')
    }

    const cases = await this.complianceCaseRepository.find({
      where,
      order: {
        createdAt: 'ASC',
      },
    })

    if (cases.length === 0) {
      throw new BadRequestException('No compliance cases matched the requested backfill scope')
    }

    const scopedCases = cases

    if (scopedCases.length === 0) {
      throw new BadRequestException('No compliance cases matched the requested backfill scope')
    }

    const affectedDomains = Array.from(
      new Set(
        scopedCases
          .map((caseRecord) => caseRecord.l1Code)
          .filter((l1Code): l1Code is string => Boolean(l1Code)),
      ),
    ).sort()
    const resettableCases = scopedCases.filter(
      (caseRecord) => !caseRecord.humanReviewed && caseRecord.status !== 'reviewed',
    )
    const skippedReviewedCount = scopedCases.length - resettableCases.length
    const casesWithBatchId = resettableCases.filter((caseRecord) =>
      Boolean(caseRecord.importBatchId),
    )
    const skippedMissingBatchCount = resettableCases.length - casesWithBatchId.length
    const rollbackCompatible =
      includeRetirementReadiness && casesWithBatchId.length > 0 && skippedMissingBatchCount === 0
    const requiresLegacyCodeRestore = includeRetirementReadiness && !rollbackCompatible
    const batchIds = Array.from(
      new Set(
        casesWithBatchId
          .map((caseRecord) => caseRecord.importBatchId)
          .filter((batchId): batchId is string => Boolean(batchId)),
      ),
    )

    if (params.dryRun) {
      return {
        requestedCount: scopedCases.length,
        resetCount: casesWithBatchId.length,
        skippedReviewedCount,
        skippedMissingBatchCount,
        extractedCount: 0,
        clusteredCount: 0,
        autoMappedCaseCount: 0,
        unmappedCaseCount: 0,
        ruleMappedCaseCount: 0,
        llmTriggeredCaseCount: 0,
        llmAssistedRuleCaseCount: 0,
        llmFallbackCaseCount: 0,
        llmUnmappedCaseCount: 0,
        mapCountBySource: {
          RULE: 0,
          LLM_ASSISTED_RULE: 0,
          LLM_FALLBACK: 0,
          MANUAL: 0,
          FAILURE_MODE_CHAIN: 0,
        },
        mappedCaseCountBySource: {
          RULE: 0,
          LLM_ASSISTED_RULE: 0,
          LLM_FALLBACK: 0,
          MANUAL: 0,
          FAILURE_MODE_CHAIN: 0,
        },
        batchIds,
        affectedDomains,
        rollbackCompatible,
        requiresLegacyCodeRestore,
      }
    }

    if (params.caseIds?.length || (params.l1Code && !params.batchId)) {
      throw new BadRequestException(
        'case/domain-scoped backfill currently supports dry-run readiness only; use reclassify for granular execution',
      )
    }

    if (casesWithBatchId.length > 0) {
      await this.caseControlMapRepository.delete({
        caseId: In(casesWithBatchId.map((caseRecord) => caseRecord.caseId)),
        reviewStatus: 'PENDING',
      })

      await this.complianceCaseRepository.save(
        casesWithBatchId.map((caseRecord) => ({
          ...caseRecord,
          violationThemes: null,
          clauseCandidates: null,
          extractedAt: null,
          l1Code: null,
          l2Code: null,
          confidenceScore: null,
          normalizedThemes: null,
          candidateControlPoints: null,
          clusteredAt: null,
          status: 'pending' as const,
        })),
      )
    }

    let extractedCount = 0
    let clusteredCount = 0
    let ruleMappedCaseCount = 0
    let llmTriggeredCaseCount = 0
    let llmAssistedRuleCaseCount = 0
    let llmFallbackCaseCount = 0
    let llmUnmappedCaseCount = 0

    for (const batchId of batchIds) {
      const extractionResult = await this.caseExtractionService.extractBatch(batchId)
      extractedCount += extractionResult.processedCount

      const clusteringResult = await this.caseClusteringService.clusterBatch(batchId)
      clusteredCount += clusteringResult.processedCount
      ruleMappedCaseCount += clusteringResult.ruleMappedCaseCount
      llmTriggeredCaseCount += clusteringResult.llmTriggeredCaseCount
      llmAssistedRuleCaseCount += clusteringResult.llmAssistedRuleCaseCount
      llmFallbackCaseCount += clusteringResult.llmFallbackCaseCount
      llmUnmappedCaseCount += clusteringResult.llmUnmappedCaseCount
    }

    const refreshedCases = await this.complianceCaseRepository.find({
      where: {
        caseId: In(casesWithBatchId.map((caseRecord) => caseRecord.caseId)),
      },
    })
    const refreshedCaseIds = refreshedCases.map((caseRecord) => caseRecord.caseId)
    const caseControlMaps = refreshedCaseIds.length
      ? await this.caseControlMapRepository.find({
          where: {
            caseId: In(refreshedCaseIds),
          },
        })
      : []
    const mappedCaseIds = new Set(caseControlMaps.map((map) => map.caseId))
    const sourceKeys: CaseControlMapSource[] = [
      'RULE',
      'LLM_ASSISTED_RULE',
      'LLM_FALLBACK',
      'MANUAL',
      'FAILURE_MODE_CHAIN',
    ]
    const mapCountBySource = sourceKeys.reduce(
      (acc, source) => ({
        ...acc,
        [source]: caseControlMaps.filter((map) => map.source === source).length,
      }),
      {} as Record<CaseControlMapSource, number>,
    )
    const mappedCaseCountBySource = sourceKeys.reduce(
      (acc, source) => {
        const caseIds = new Set(
          caseControlMaps.filter((map) => map.source === source).map((map) => map.caseId),
        )

        return {
          ...acc,
          [source]: caseIds.size,
        }
      },
      {} as Record<CaseControlMapSource, number>,
    )

    return {
      requestedCount: scopedCases.length,
      resetCount: casesWithBatchId.length,
      skippedReviewedCount,
      skippedMissingBatchCount,
      extractedCount,
      clusteredCount,
      autoMappedCaseCount: refreshedCases.filter((caseRecord) =>
        mappedCaseIds.has(caseRecord.caseId),
      ).length,
      unmappedCaseCount: refreshedCases.filter(
        (caseRecord) => !mappedCaseIds.has(caseRecord.caseId),
      ).length,
      ruleMappedCaseCount,
      llmTriggeredCaseCount,
      llmAssistedRuleCaseCount,
      llmFallbackCaseCount,
      llmUnmappedCaseCount,
      mapCountBySource,
      mappedCaseCountBySource,
      batchIds,
      affectedDomains,
      rollbackCompatible,
      requiresLegacyCodeRestore,
    }
  }
}
