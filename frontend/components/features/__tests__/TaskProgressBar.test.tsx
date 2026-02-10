import { render, screen } from '@testing-library/react'
import TaskProgressBar from '../TaskProgressBar'

// Mock the useTaskProgress hook
jest.mock('@/lib/hooks/useTaskProgress', () => ({
  useTaskProgress: jest.fn(),
}))

const { useTaskProgress } = require('@/lib/hooks/useTaskProgress')

describe('TaskProgressBar', () => {
  const mockOnCompleted = jest.fn()
  const mockOnFailed = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('[P0] renders nothing when taskId is null', () => {
    useTaskProgress.mockReturnValue({
      progress: 0,
      message: '',
      currentStep: '',
      isCompleted: false,
      isFailed: false,
      error: null,
    })

    const { container } = render(
      <TaskProgressBar taskId={null} onCompleted={mockOnCompleted} onFailed={mockOnFailed} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('[P0] displays loading state when task is in progress', () => {
    useTaskProgress.mockReturnValue({
      progress: 33,
      message: '正在处理中...',
      currentStep: '调用GPT-4模型',
      isCompleted: false,
      isFailed: false,
      error: null,
    })

    render(<TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />)

    expect(screen.getByText('🔄 正在生成...')).toBeInTheDocument()
    expect(screen.getByText('正在处理中...')).toBeInTheDocument()
    expect(screen.getByText(/当前步骤/)).toBeInTheDocument()
    expect(screen.getByText('调用GPT-4模型')).toBeInTheDocument()
  })

  it('[P0] displays completed state', () => {
    useTaskProgress.mockReturnValue({
      progress: 100,
      message: '生成完成',
      currentStep: '',
      isCompleted: true,
      isFailed: false,
      error: null,
    })

    render(<TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />)

    expect(screen.getByText('✅ 生成完成')).toBeInTheDocument()
    expect(screen.getByText('综述生成成功')).toBeInTheDocument()
  })

  it('[P0] displays failed state', () => {
    useTaskProgress.mockReturnValue({
      progress: 50,
      message: '生成失败',
      currentStep: '',
      isCompleted: false,
      isFailed: true,
      error: 'API调用超时',
    })

    render(<TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />)

    expect(screen.getByText('❌ 生成失败')).toBeInTheDocument()
    expect(screen.getByText('API调用超时')).toBeInTheDocument()
  })

  it('[P1] displays model progress indicators', () => {
    useTaskProgress.mockReturnValue({
      progress: 50,
      message: '正在处理中...',
      currentStep: '调用Claude模型',
      isCompleted: false,
      isFailed: false,
      error: null,
    })

    render(<TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />)

    // Check for all three model indicators
    expect(screen.getByText('GPT-4')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('通义千问')).toBeInTheDocument()

    // At progress 50: GPT-4 completed (>=33), Claude in progress (>33), 通义千问 waiting
    const completedElements = screen.getAllByText('已完成')
    expect(completedElements.length).toBeGreaterThanOrEqual(1)

    // Check for waiting status of 通义千问
    expect(screen.getByText('等待中')).toBeInTheDocument()
  })

  it('[P1] calls onCompleted when task is completed', () => {
    useTaskProgress.mockReturnValue({
      progress: 100,
      message: '生成完成',
      currentStep: '',
      isCompleted: true,
      isFailed: false,
      error: null,
    })

    render(<TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />)

    expect(mockOnCompleted).toHaveBeenCalled()
    expect(mockOnFailed).not.toHaveBeenCalled()
  })

  it('[P1] calls onFailed when task fails', () => {
    useTaskProgress.mockReturnValue({
      progress: 50,
      message: '生成失败',
      currentStep: '',
      isCompleted: false,
      isFailed: true,
      error: 'API调用超时',
    })

    render(<TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />)

    expect(mockOnFailed).toHaveBeenCalledWith('API调用超时')
    expect(mockOnCompleted).not.toHaveBeenCalled()
  })

  it('[P2] renders with MUI components', () => {
    useTaskProgress.mockReturnValue({
      progress: 50,
      message: '正在处理中...',
      currentStep: '处理中',
      isCompleted: false,
      isFailed: false,
      error: null,
    })

    const { container } = render(
      <TaskProgressBar taskId="test-task-id" onCompleted={mockOnCompleted} onFailed={mockOnFailed} />
    )

    // Check for MUI LinearProgress (role="progressbar")
    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar).toBeInTheDocument()
  })
})
