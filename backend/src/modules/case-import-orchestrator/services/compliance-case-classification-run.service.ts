import { InjectRepository } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'
import {
  ComplianceCaseClassificationRun,
  type ComplianceCaseClassificationRunDecisionSource,
  type ComplianceCaseClassificationRunFallbackReason,
  type ComplianceCaseClassificationRunPathDecision,
  type ComplianceCaseClassificationRunStatus,
} from '../../../database/entities/compliance-case-classification-run.entity'
import type {
  ComplianceCaseClassificationSource,
  ComplianceCaseFallbackReason,
} from '../../../database/entities/compliance-case.entity'

export type AppendClassificationRunArgs = {
  caseId: string
  batchId: string | null
  classifierVersion: string
  mappingVersion: string
  rulebookVersion: string
  inputHash: string
  normalizedInputJson: Record<string, unknown> | null
  matchedSignals: string[]
  decisionTrace: Record<string, unknown> | null
  l1Code: string | null
  l2Code: string | null
  confidenceScore: number | null
  decisionSource: ComplianceCaseClassificationRunDecisionSource
  pathDecision: ComplianceCaseClassificationRunPathDecision
  fallbackReason: ComplianceCaseClassificationRunFallbackReason | null
  classificationStatus: ComplianceCaseClassificationRunStatus
  classificationSource: ComplianceCaseClassificationSource | null
  classificationVersion: string | null
}

export type LatestClassificationSnapshot = {
  l1Code: string | null
  l2Code: string | null
  confidenceScore: string | null
  classificationSource: ComplianceCaseClassificationSource | null
  classificationVersion: string | null
  fallbackReason: ComplianceCaseFallbackReason | null
}

export function buildLatestClassificationSnapshot(
  args: AppendClassificationRunArgs,
): LatestClassificationSnapshot {
  const shouldExposePrimarySnapshot = args.pathDecision === 'PRIMARY_CHAIN'

  return {
    l1Code: shouldExposePrimarySnapshot ? args.l1Code : null,
    l2Code: shouldExposePrimarySnapshot ? args.l2Code : null,
    confidenceScore:
      shouldExposePrimarySnapshot && args.confidenceScore !== null
        ? args.confidenceScore.toFixed(4)
        : null,
    classificationSource: shouldExposePrimarySnapshot
      ? args.classificationSource
      : 'none',
    classificationVersion: args.classificationVersion,
    fallbackReason: args.fallbackReason,
  }
}

@Injectable()
export class ComplianceCaseClassificationRunService {
  constructor(
    @InjectRepository(ComplianceCaseClassificationRun)
    private readonly classificationRunRepository: Repository<ComplianceCaseClassificationRun>,
  ) {}

  async appendRunAndRefreshLatest(
    args: AppendClassificationRunArgs,
  ): Promise<ComplianceCaseClassificationRun> {
    return this.classificationRunRepository.manager.transaction(async (manager) => {
      await manager.update(
        ComplianceCaseClassificationRun,
        { caseId: args.caseId, isLatest: true },
        { isLatest: false },
      )

      const entity = manager.create(ComplianceCaseClassificationRun, {
        caseId: args.caseId,
        batchId: args.batchId,
        classifierVersion: args.classifierVersion,
        mappingVersion: args.mappingVersion,
        rulebookVersion: args.rulebookVersion,
        inputHash: args.inputHash,
        normalizedInputJson: args.normalizedInputJson,
        matchedSignalsJson: args.matchedSignals,
        decisionTraceJson: args.decisionTrace,
        l1Code: args.l1Code,
        l2Code: args.l2Code,
        confidenceScore:
          args.confidenceScore === null ? null : args.confidenceScore.toFixed(4),
        decisionSource: args.decisionSource,
        pathDecision: args.pathDecision,
        fallbackReason: args.fallbackReason,
        classificationStatus: args.classificationStatus,
        isLatest: true,
      })

      return manager.save(ComplianceCaseClassificationRun, entity)
    })
  }
}
