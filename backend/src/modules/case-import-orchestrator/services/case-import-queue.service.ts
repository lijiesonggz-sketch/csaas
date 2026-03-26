import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'
import {
  ComplianceCaseImportEnqueueResult,
  ImportComplianceCasesDto,
} from '../dto/import-compliance-cases.dto'
import {
  KG_CASE_IMPORT_CLUSTER_JOB_NAME,
  KG_CASE_IMPORT_EXTRACT_JOB_NAME,
  KG_CASE_IMPORT_PARSE_JOB_NAME,
  KG_CASE_IMPORT_QUEUE,
} from '../constants/case-import.constants'

export type CaseImportParseJobData = {
  filePath: string
  regulatorCode: string
  batchId: string
}

export type CaseImportExtractJobData = {
  batchId: string
}

export type CaseImportClusterJobData = {
  batchId: string
}

export type CaseImportJobData =
  | CaseImportParseJobData
  | CaseImportExtractJobData
  | CaseImportClusterJobData

@Injectable()
export class CaseImportQueueService {
  constructor(
    @InjectQueue(KG_CASE_IMPORT_QUEUE)
    private readonly caseImportQueue: Queue<CaseImportJobData>,
  ) {}

  async enqueueImport(dto: ImportComplianceCasesDto): Promise<ComplianceCaseImportEnqueueResult> {
    const regulatorCode = dto.regulatorCode.trim().toUpperCase()
    const batchId = dto.batchId ?? `${regulatorCode}-${Date.now()}`
    const jobId = `case-import-${batchId}`

    const job = await this.caseImportQueue.add(
      KG_CASE_IMPORT_PARSE_JOB_NAME,
      {
        filePath: dto.filePath,
        regulatorCode,
        batchId,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    )

    return {
      jobId: String(job.id ?? jobId),
      batchId,
      filePath: dto.filePath,
      regulatorCode,
      status: 'queued',
    }
  }

  async enqueueExtraction(batchId: string): Promise<void> {
    await this.caseImportQueue.add(
      KG_CASE_IMPORT_EXTRACT_JOB_NAME,
      {
        batchId,
      },
      {
        jobId: `case-extract-${batchId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    )
  }

  async enqueueClustering(batchId: string): Promise<void> {
    await this.caseImportQueue.add(
      KG_CASE_IMPORT_CLUSTER_JOB_NAME,
      {
        batchId,
      },
      {
        jobId: `case-cluster-${batchId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    )
  }
}
