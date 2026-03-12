import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GapAnalysisPage from '../page'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// Mock dependencies
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

jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}))

jest.mock('@/components/ui/unified-button', () => ({
  UnifiedButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

const mockUseParams = useParams as jest.Mock
const mockUseRouter = useRouter as jest.Mock
const mockUseSearchParams = useSearchParams as jest.Mock

describe('GapAnalysisPage', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ push: mockPush })
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('should render page header with correct title', () => {
    render(<GapAnalysisPage />)

    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    expect(screen.getByText('差距分析')).toBeInTheDocument()
    expect(screen.getByText('上传问卷答案JSON文件，自动进行成熟度差距分析')).toBeInTheDocument()
  })

  it('should render upload section initially', () => {
    render(<GapAnalysisPage />)

    expect(screen.getByText('上传问卷答案')).toBeInTheDocument()
    expect(screen.getByText('下载答案模板')).toBeInTheDocument()
  })

  it('should navigate back when back button is clicked', () => {
    render(<GapAnalysisPage />)

    fireEvent.click(screen.getByText('返回'))

    expect(mockPush).toHaveBeenCalledTimes(1)
  })
})
