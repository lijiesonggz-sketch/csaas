import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { REPORT_PDF_GENERATE_JOB_NAME, REPORT_PDF_QUEUE } from '../constants/report-pdf.constants'
import type { ReportPdfQueueJobData } from '../dto/report-pdf.dto'
import { ReportPdfService } from '../services/report-pdf.service'

@Processor(REPORT_PDF_QUEUE, {
  concurrency: 2,
})
export class ReportPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportPdfProcessor.name)

  constructor(private readonly reportPdfService: ReportPdfService) {
    super()
  }

  async process(job: Job<ReportPdfQueueJobData>): Promise<void> {
    if (job.name !== REPORT_PDF_GENERATE_JOB_NAME) {
      this.logger.warn(`Skipping unsupported job ${job.name}`)
      return
    }

    await this.reportPdfService.renderPdfJob(job.data.pdfJobId)
  }
}
