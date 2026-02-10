import { render, screen, fireEvent } from '@testing-library/react'
import QuestionnaireResultDisplay from '../QuestionnaireResultDisplay'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}))

const mockResult = {
  taskId: 'questionnaire-task-123',
  selectedModel: 'GPT4',
  confidenceLevel: 'HIGH',
  selectedResult: {
    questionnaire: [
      {
        question_id: 'Q1',
        cluster_id: 'cluster-1',
        cluster_name: '测试聚类',
        question_text: '测试问题文本',
        question_type: 'SINGLE_CHOICE',
        options: [
          { option_id: 'A', text: '选项A', score: 1, level: 'Level 1' },
          { option_id: 'B', text: '选项B', score: 2, level: 'Level 2' },
        ],
        required: true,
        guidance: '填写引导',
        dimension: '测试维度',
      },
      {
        question_id: 'Q2',
        cluster_id: 'cluster-1',
        cluster_name: '测试聚类',
        question_text: '判断题测试',
        question_type: 'BINARY',
        options: [
          { option_id: 'A', text: '有', score: 1 },
          { option_id: 'B', text: '没有', score: 0 },
        ],
        required: false,
        guidance: '判断题引导',
      },
    ],
    questionnaire_metadata: {
      total_questions: 2,
      estimated_time_minutes: 5,
      coverage_map: {
        'cluster-1': 2,
      },
    },
  },
  qualityScores: {
    structural: 0.9,
    semantic: 0.88,
    detail: 0.92,
  },
}

describe('QuestionnaireResultDisplay', () => {
  it('renders questionnaire result correctly', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    // Check basic info is displayed
    expect(screen.getByText('问卷生成完成！')).toBeInTheDocument()
    // Task ID appears multiple times, so use getAllByText
    expect(screen.getAllByText('questionnaire-task-123').length).toBeGreaterThan(0)
  })

  it('displays metadata information', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    expect(screen.getByText('任务ID')).toBeInTheDocument()
    expect(screen.getByText('选中模型')).toBeInTheDocument()
    expect(screen.getByText('置信度')).toBeInTheDocument()
    expect(screen.getByText('总题数')).toBeInTheDocument()
    // These appear multiple times
    expect(screen.getAllByText('2 题').length).toBeGreaterThan(0)
    expect(screen.getByText('预估时间')).toBeInTheDocument()
    expect(screen.getAllByText('5 分钟').length).toBeGreaterThan(0)
  })

  it('displays question type statistics', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    expect(screen.getByText('题型统计')).toBeInTheDocument()
    // These appear in multiple places
    expect(screen.getAllByText('单选题').length).toBeGreaterThan(0)
    expect(screen.getAllByText('判断题').length).toBeGreaterThan(0)
  })

  it('displays quality scores', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    expect(screen.getByText('质量评分')).toBeInTheDocument()
    expect(screen.getByText('结构质量')).toBeInTheDocument()
    expect(screen.getByText('语义质量')).toBeInTheDocument()
    expect(screen.getByText('细节质量')).toBeInTheDocument()
  })

  it('displays questions grouped by cluster', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    expect(screen.getByText('调研问卷 (2 题)')).toBeInTheDocument()
    expect(screen.getByText('测试聚类')).toBeInTheDocument()
  })

  it('displays question content', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    expect(screen.getByText('测试问题文本')).toBeInTheDocument()
    // '单选题' appears in multiple places
    expect(screen.getAllByText('单选题').length).toBeGreaterThan(0)
    expect(screen.getByText('必答')).toBeInTheDocument()
    expect(screen.getByText('填写引导')).toBeInTheDocument()
  })

  it('displays question options', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    expect(screen.getByText('选项A')).toBeInTheDocument()
    expect(screen.getByText('选项B')).toBeInTheDocument()
  })

  it('handles copy task ID button click', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    render(<QuestionnaireResultDisplay result={mockResult} />)

    const copyButton = screen.getByRole('button', { name: /复制ID/i })
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('questionnaire-task-123')
  })

  it('opens coverage modal when clicking view coverage button', () => {
    render(<QuestionnaireResultDisplay result={mockResult} />)

    const viewCoverageButton = screen.getByRole('button', { name: /查看覆盖率/i })
    fireEvent.click(viewCoverageButton)

    expect(screen.getByText('覆盖率统计')).toBeInTheDocument()
  })
})
