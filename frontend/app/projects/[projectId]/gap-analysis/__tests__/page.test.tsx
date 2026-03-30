import { fireEvent, render, screen } from '@testing-library/react'

import GapAnalysisPage from '../page'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

jest.mock('@/lib/api/survey', () => ({
  SurveyAPI: {
    uploadAndAnalyze: jest.fn(),
  },
}))

jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}))

jest.mock('@/components/features/MaturityRadarChart', () => ({
  __esModule: true,
  default: () => <div data-testid="radar-chart">Radar Chart</div>,
  mapToRadarData: jest.fn(() => []),
}))

jest.mock('@/components/features/GapAnalysisReport', () => ({
  GapAnalysisReport: () => <div data-testid="gap-report">Gap Analysis Report</div>,
}))

jest.mock('@/lib/utils/pdfExport', () => ({
  generatePDFFilename: jest.fn(() => 'test-report.pdf'),
  formatReportDate: jest.fn(() => '2024-01-01'),
}))

describe('GapAnalysisPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack, push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it('renders the current title and upload section', () => {
    render(<GapAnalysisPage />)

    expect(screen.getByText('差距分析')).toBeInTheDocument()
    expect(screen.getByText('上传问卷答案')).toBeInTheDocument()
    expect(screen.getByText('下载答案模板')).toBeInTheDocument()
  })

  it('renders the current file upload affordance', () => {
    render(<GapAnalysisPage />)

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(screen.getByText(/支持 CSV 或 Excel/)).toBeInTheDocument()
  })

  it('navigates back from the current header action', () => {
    render(<GapAnalysisPage />)

    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
