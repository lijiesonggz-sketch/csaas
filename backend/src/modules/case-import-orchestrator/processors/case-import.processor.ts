import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { ComplianceCaseImportResult } from '../dto/import-compliance-cases.dto'
import { KG_CASE_IMPORT_QUEUE } from '../constants/case-import.constants'
import { CaseImportService } from '../services/case-import.service'
import { CaseImportJobData } from '../services/case-import-queue.service'

@Processor(KG_CASE_IMPORT_QUEUE, {
  concurrency: 2,
})
export class CaseImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CaseImportProcessor.name)

  constructor(private readonly caseImportService: CaseImportService) {
    super()
  }

  async process(job: Job<CaseImportJobData>): Promise<ComplianceCaseImportResult> {
    this.logger.log(
      `Processing case import job ${job.id} for ${job.data.regulatorCode}: ${job.data.filePath}`,
    )

    try {
      return await this.caseImportService.importCases(job.data)
    } catch (error) {
      this.logger.error(
        `Case import job ${job.id} failed on attempt ${job.attemptsMade + 1}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }
}
