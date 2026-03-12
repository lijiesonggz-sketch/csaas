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

// Mock MUI Dialog components
jest.mock('@mui/material', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogContentText: ({ children }: any) => <div>{children}</div>,
  DialogActions: ({ children }: any) => <div data-testid="dialog-actions">{children}</div>,
  Button: ({ children, onClick, disabled, color }: any) => (
    <button onClick={onClick} disabled={disabled} data-color={color}>{children}</button>
  ),
}))

// Mock UI components
jest.mock('@/components/ui/gradient-card', () => ({
  GradientCard: ({ children, onClick, ...props }: any) => (
    <div onClick={onClick} {...props}>{children}</div>
  ),
}))

jest.mock('@/components/ui/status-badge', () => ({
  StatusBadge: ({ status, text }: any) => <span data-status={status}>{text}</span>,
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
    expect(screen.getByTestId('dialog')).toBeInTheDocument()
  })

  it('should open delete dialog when delete button is clicked', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByTitle('删除项目')
    fireEvent.click(deleteButton)

    expect(screen.getByTestId('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('删除项目')
  })

  it('should close delete dialog when cancel button is clicked', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    expect(screen.getByTestId('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })

  it('should delete project when confirm button is clicked', async () => {
    mockApiFetch.mockResolvedValue({})

    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    fireEvent.click(screen.getByTitle('删除项目'))
    // Use getByRole to find the confirm button (data-color="error")
    const confirmButton = screen.getByRole('button', { name: /确定/ })
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
    const confirmButton = screen.getByRole('button', { name: /确定/ })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('删除中...')).toBeInTheDocument()
    })
  })

  it('should not render description if empty', () => {
    const projectWithoutDesc = { ...mockProject, description: '' }
    const { container } = render(<ProjectCard project={projectWithoutDesc} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(container.querySelector('.line-clamp-2')).not.toBeInTheDocument()
  })

  it('should not render client name if empty', () => {
    const projectWithoutClient = { ...mockProject, clientName: '' }
    render(<ProjectCard project={projectWithoutClient} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.queryByText('Test Client')).not.toBeInTheDocument()
  })

  it('should not render standard name if empty', () => {
    const projectWithoutStandard = { ...mockProject, standardName: '' }
    render(<ProjectCard project={projectWithoutStandard} onClick={mockOnClick} onDelete={mockOnDelete} />)

    expect(screen.queryByText('ISO 27001')).not.toBeInTheDocument()
  })

  it('should render progress bar with correct width', () => {
    render(<ProjectCard project={mockProject} onClick={mockOnClick} onDelete={mockOnDelete} />)

    const progressBar = document.querySelector('[style*="width: 75%"]')
    expect(progressBar).toBeInTheDocument()
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
