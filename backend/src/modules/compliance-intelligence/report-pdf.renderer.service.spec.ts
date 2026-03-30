import puppeteer from 'puppeteer'
import { ReportPdfRendererService } from './services/report-pdf-renderer.service'

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}))

describe('ReportPdfRendererService', () => {
  const mockPdf = jest.fn()
  const mockSetContent = jest.fn()
  const mockClose = jest.fn()
  const mockNewPage = jest.fn()
  let service: ReportPdfRendererService

  beforeEach(() => {
    jest.clearAllMocks()
    mockPdf.mockResolvedValue(Uint8Array.from([1, 2, 3, 4]))
    mockSetContent.mockResolvedValue(undefined)
    mockClose.mockResolvedValue(undefined)
    mockNewPage.mockResolvedValue({
      setContent: mockSetContent,
      pdf: mockPdf,
    })
    ;(puppeteer.launch as jest.Mock).mockResolvedValue({
      newPage: mockNewPage,
      close: mockClose,
    })

    service = new ReportPdfRendererService()
  })

  it('should render report html to a non-empty pdf buffer', async () => {
    const result = await service.render({
      reportId: '11111111-1111-4111-8111-111111111111',
      projectName: '项目一',
      generatedAt: '2026-03-30T08:00:00.000Z',
      projectSummary: {
        clientName: '客户A',
        standardName: 'ISO27001',
        projectStatus: 'active',
      },
      gapSummary: {
        overallMaturity: 3.8,
        overallGrade: '充分规范级',
        topShortcomings: [
          {
            clusterId: 'cluster-1',
            clusterName: '访问控制',
            gap: 1.2,
          },
        ],
      },
      riskSummary: {
        conflictSeverity: 'MEDIUM',
        conflictCount: 2,
        topRiskClusters: ['访问控制'],
      },
      sections: [],
    })

    expect(result.contentType).toBe('application/pdf')
    expect(result.buffer.length).toBeGreaterThan(0)
    expect(result.fileName).toMatch(/control-report-11111111-/)
    expect(mockSetContent).toHaveBeenCalled()
    expect(mockPdf).toHaveBeenCalled()
    expect(mockClose).toHaveBeenCalled()
  })
})
