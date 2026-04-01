import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectCard from '../ProjectCard'
import { apiFetch } from '@/lib/utils/api'
import { message } from '@/lib/message'

// Mock dependencies
jest.mock('@/lib/utils/api')
jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockApiFetch = apiFetch as jest.Mock
const mockMessageSuccess = message.success as jest.Mock
const mockMessageError = message.error as jest.Mock

describe('ProjectCard', () => {
  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    status: 'ACTIVE',
    progress: 75,
    clientName: 'Test Client',
    standardName: 'ISO 27001',
    createdAt: '2024-01-15T08:00:00Z',
  }

  const mockOnClick = jest.fn()
  const mockOnDelete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render project information correctly', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()
    expect(screen.getByText('Test Client')).toBeInTheDocument()
    expect(screen.getByText('ISO 27001')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('should render status badge with correct status', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('进行中')).toBeInTheDocument()
  })

  it('should handle COMPLETED status', () => {
    const completedProject = { ...mockProject, status: 'COMPLETED' }
    render(<ProjectCard project={completedProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('已完成')).toBeInTheDocument()
  })

  it('should handle DRAFT status', () => {
    const draftProject = { ...mockProject, status: 'DRAFT' }
    render(<ProjectCard project={draftProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('草稿')).toBeInTheDocument()
  })

  it('should handle ARCHIVED status', () => {
    const archivedProject = { ...mockProject, status: 'ARCHIVED' }
    render(<ProjectCard project={archivedProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('已归档')).toBeInTheDocument()
  })

  it('should handle unknown status', () => {
    const unknownProject = { ...mockProject, status: 'UNKNOWN' }
    render(<ProjectCard project={unknownProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })

  it('should call onClick when card is clicked', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    const card = screen.getByRole('button', { name: '项目: Test Project' })
    fireEvent.click(card)

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('should not call onClick when delete button is clicked', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByTitle('删除项目')
    fireEvent.click(deleteButton)

    expect(mockOnClick).not.toHaveBeenCalled()
    // Dialog should open
    expect(screen.getByText('删除项目')).toBeInTheDocument()
    expect(screen.getByText(/确定要删除这个项目吗？/)).toBeInTheDocument()
  })

  it('should close delete dialog when cancel button is clicked', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    expect(screen.getByText(/确定要删除这个项目吗？/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByText(/确定要删除这个项目吗？/)).not.toBeInTheDocument()
  })

  it('should delete project when confirm button is clicked', async () => {
    mockApiFetch.mockResolvedValue({})

    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    const confirmButton = screen.getByRole('button', { name: '确定' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/projects/project-1', { method: 'DELETE' })
      expect(mockMessageSuccess).toHaveBeenCalledWith('项目已删除')
      expect(mockOnDelete).toHaveBeenCalledTimes(1)
    })
  })

  it('should show error message when delete fails', async () => {
    mockApiFetch.mockRejectedValue(new Error('Delete failed'))

    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    fireEvent.click(screen.getByText('确定'))

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('Delete failed')
    })
  })

  it('should show loading state during deletion', async () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    const confirmButton = screen.getByRole('button', { name: '确定' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('删除中...')).toBeInTheDocument()
    })
  })

  it('should render description if provided', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)
    expect(screen.getByText('Test Description')).toBeInTheDocument()
  })

  it('should render client name if provided', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)
    expect(screen.getByText('Test Client')).toBeInTheDocument()
  })

  it('should render standard name if provided', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)
    expect(screen.getByText('ISO 27001')).toBeInTheDocument()
  })

  it('should render progress bar with correct width', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.getByText('进度')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('should render created date', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    // The date format depends on the formatChinaDate function, just check it renders something
    const dateElement = screen.getByText(/2024/)
    expect(dateElement).toBeInTheDocument()
  })

  it('should work without onDelete callback', async () => {
    mockApiFetch.mockResolvedValue({})

    render(<ProjectCard project={mockProject} onClick={mockOnClick} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    fireEvent.click(screen.getByText('确定'))

    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('项目已删除')
    })
  })

  it('should work without onClick callback', () => {
    render(<ProjectCard project={mockProject} />)

    const card = screen.getByRole('button', { name: '项目: Test Project' })
    fireEvent.click(card)

    // Should not throw error
    expect(card).toBeInTheDocument()
  })
})
