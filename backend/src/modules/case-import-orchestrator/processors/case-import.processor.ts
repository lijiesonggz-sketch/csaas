import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { ComplianceCaseImportResult } from '../dto/import-compliance-cases.dto'
import {
  KG_CASE_IMPORT_EXTRACT_JOB_NAME,
  KG_CASE_IMPORT_PARSE_JOB_NAME,
  KG_CASE_IMPORT_QUEUE,
} from '../constants/case-import.constants'
import {
  CaseExtractionBatchResult,
  CaseExtractionService,
} from '../services/case-extraction.service'
import { CaseImportService } from '../services/case-import.service'
import {
  CaseImportExtractJobData,
  CaseImportParseJobData,
  CaseImportQueueService,
} from '../services/case-import-queue.service'

@Processor(KG_CASE_IMPORT_QUEUE, {
  concurrency: 2,
})
export class CaseImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CaseImportProcessor.name)

  constructor(
    private readonly caseImportService: CaseImportService,
    private readonly caseExtractionService: CaseExtractionService,
    private readonly caseImportQueueService: CaseImportQueueService,
  ) {
    super()
  }

  async process(
    job: Job<CaseImportParseJobData | CaseImportExtractJobData>,
  ): Promise<ComplianceCaseImportResult | CaseExtractionBatchResult> {
    try {
      if (job.name === KG_CASE_IMPORT_PARSE_JOB_NAME) {
        const data = job.data as CaseImportParseJobData
        this.logger.log(
          `Processing case import job ${job.id} for ${data.regulatorCode}: ${data.filePath}`,
        )

        const result = await this.caseImportService.importCases(data)

        if (result.importedCount > 0) {
          await this.caseImportQueueService.enqueueExtraction(result.batchId)
        }

        return result
      }

      if (job.name === KG_CASE_IMPORT_EXTRACT_JOB_NAME) {
        const data = job.data as CaseImportExtractJobData
        this.logger.log(`Processing case extraction job ${job.id} for batch ${data.batchId}`)

        return this.caseExtractionService.extractBatch(data.batchId)
      }

      throw new Error(`Unsupported case import job: ${job.name}`)
    } catch (error) {
      this.logger.error(
        `Case import job ${job.id} failed on attempt ${job.attemptsMade + 1}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }
}
