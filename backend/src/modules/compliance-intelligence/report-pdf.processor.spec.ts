import { Job } from 'bullmq'
import { REPORT_PDF_QUEUE, REPORT_PDF_GENERATE_JOB_NAME } from './constants/report-pdf.constants'
import { ReportPdfProcessor } from './processors/report-pdf.processor'
import { ReportPdfService } from './services/report-pdf.service'

describe('ReportPdfProcessor', () => {
  const reportPdfService = {
    renderPdfJob: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delegate supported queue jobs to report pdf service', async () => {
    const processor = new ReportPdfProcessor(reportPdfService as unknown as ReportPdfService)

    await processor.process({
      name: REPORT_PDF_GENERATE_JOB_NAME,
      data: {
        pdfJobId: 'pdf-job-1',
      },
    } as Job)

    expect(reportPdfService.renderPdfJob).toHaveBeenCalledWith('pdf-job-1')
  })

  it('should ignore unsupported queue jobs', async () => {
    const processor = new ReportPdfProcessor(reportPdfService as unknown as ReportPdfService)

    await processor.process({
      name: `${REPORT_PDF_QUEUE}-unknown`,
      data: {
        pdfJobId: 'pdf-job-1',
      },
    } as Job)

    expect(reportPdfService.renderPdfJob).not.toHaveBeenCalled()
  })
})
