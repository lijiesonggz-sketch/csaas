import { fireEvent, render, screen } from '@testing-library/react'

import GapAnalysisPage from '../page'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { SurveyAPI } from '@/lib/api/survey'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

jest.mock('@/lib/api/survey', () => ({
  SurveyAPI: {
    uploadAndAnalyze: jest.fn(),
    getQuestionnaireFreshness: jest.fn(),
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
    ;(SurveyAPI.getQuestionnaireFreshness as jest.Mock).mockResolvedValue({
      projectId: 'project-1',
      surveyResponseId: 'survey-1',
      questionnaireTaskId: 'task-1',
      latestPublishedSnapshotTaskId: 'task-1',
      isStale: false,
      staleTargets: [],
      changeTypes: [],
      message: null,
    })
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

  it('shows stale alert when saved analysis is no longer fresh', async () => {
    window.localStorage.setItem(
      'gap-analysis-project-1',
      JSON.stringify({
        surveyResponseId: 'survey-1',
        respondentInfo: { name: '张三', submittedAt: new Date().toISOString() },
        overall: {
          maturityLevel: 3.2,
          calculation: { totalScore: 32, maxScore: 50, formula: '32 / 50 × 5 = 3.2' },
          grade: '充分规范级',
          description: 'test',
        },
        distribution: { level_1: 0, level_2: 0, level_3: 1, level_4: 0, level_5: 0 },
        clusterMaturity: [],
        dimensionMaturity: [],
        conflicts: { intraCluster: [], interCluster: [], hasConflict: false, conflictCount: 0, severity: 'LOW' },
        topShortcomings: [],
        topStrengths: [],
        statistics: {
          totalQuestions: 10,
          answeredQuestions: 10,
          totalClusters: 1,
          shortcomingClusters: 0,
          strengthClusters: 1,
          averageClusterMaturity: 3.2,
          minClusterMaturity: 3.2,
          maxClusterMaturity: 3.2,
          clusterMaturityStdDev: 0,
          maturityRange: 0,
        },
      }),
    )
    ;(SurveyAPI.getQuestionnaireFreshness as jest.Mock).mockResolvedValue({
      projectId: 'project-1',
      surveyResponseId: 'survey-1',
      questionnaireTaskId: 'task-1',
      latestPublishedSnapshotTaskId: 'task-2',
      isStale: true,
      staleTargets: ['gap-analysis'],
      changeTypes: ['question_added'],
      message: '现有差距分析、行动计划和报告需重新生成。',
    })

    render(<GapAnalysisPage />)

    expect(await screen.findByText('当前差距分析结果已失效')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重新上传问卷并分析/ })).toBeInTheDocument()
  })
})
