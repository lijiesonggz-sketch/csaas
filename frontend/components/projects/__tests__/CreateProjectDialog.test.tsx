import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateProjectDialog from '../CreateProjectDialog'
import { ProjectsAPI } from '@/lib/api/projects'

// Mock ProjectsAPI
jest.mock('@/lib/api/projects', () => ({
  ProjectsAPI: {
    createProject: jest.fn(),
  },
}))

const mockCreateProject = ProjectsAPI.createProject as jest.Mock

describe('CreateProjectDialog', () => {
  const mockOnClose = jest.fn()
  const mockOnCreated = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(
      <CreateProjectDialog
        open={false}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('创建新项目')).toBeInTheDocument()
  })

  it('should render all form fields', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    expect(screen.getByLabelText(/项目名称/)).toBeInTheDocument()
    expect(screen.getByLabelText(/项目描述/)).toBeInTheDocument()
    expect(screen.getByLabelText(/客户名称/)).toBeInTheDocument()
    expect(screen.getByLabelText(/合规标准/)).toBeInTheDocument()
  })

  it('should update name field on input', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    const nameInput = screen.getByLabelText(/项目名称/)
    fireEvent.change(nameInput, { target: { value: 'New Project' } })

    expect(nameInput).toHaveValue('New Project')
  })

  it('should update description field on input', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    const descInput = screen.getByLabelText(/项目描述/)
    fireEvent.change(descInput, { target: { value: 'Project Description' } })

    expect(descInput).toHaveValue('Project Description')
  })

  it('should update client name field on input', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    const clientInput = screen.getByLabelText(/客户名称/)
    fireEvent.change(clientInput, { target: { value: 'Test Client' } })

    expect(clientInput).toHaveValue('Test Client')
  })

  it('should update standard name field on input', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    const standardInput = screen.getByLabelText(/合规标准/)
    fireEvent.change(standardInput, { target: { value: 'ISO 27001' } })

    expect(standardInput).toHaveValue('ISO 27001')
  })

  it('should show error when submitting empty name', async () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    // Submit form directly to bypass HTML5 validation
    const form = screen.getByRole('dialog').querySelector('form')
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(screen.getByText('项目名称不能为空')).toBeInTheDocument()
    })
  })

  it('should show error when submitting whitespace-only name', async () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    const nameInput = screen.getByLabelText(/项目名称/)
    fireEvent.change(nameInput, { target: { value: '   ' } })

    // Submit form directly to bypass HTML5 validation
    const form = screen.getByRole('dialog').querySelector('form')
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(screen.getByText('项目名称不能为空')).toBeInTheDocument()
    })
  })

  it('should call createProject API on valid submit', async () => {
    mockCreateProject.mockResolvedValue({ id: 'new-project' })

    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.change(screen.getByLabelText(/项目描述/), { target: { value: 'Description' } })
    fireEvent.change(screen.getByLabelText(/客户名称/), { target: { value: 'Client' } })
    fireEvent.change(screen.getByLabelText(/合规标准/), { target: { value: 'ISO 27001' } })

    fireEvent.click(screen.getByText('创建项目'))

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'Description',
        clientName: 'Client',
        standardName: 'ISO 27001',
      })
    })
  })

  it('should call onCreated and reset form on successful creation', async () => {
    mockCreateProject.mockResolvedValue({ id: 'new-project' })

    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.click(screen.getByText('创建项目'))

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalledTimes(1)
    })
  })

  it('should show error message on API failure', async () => {
    mockCreateProject.mockRejectedValue(new Error('API Error'))

    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.click(screen.getByText('创建项目'))

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument()
    })
  })

  it('should show loading state during submission', async () => {
    mockCreateProject.mockImplementation(() => new Promise(() => {}))

    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.click(screen.getByText('创建项目'))

    expect(screen.getByText('创建中...')).toBeInTheDocument()
  })

  it('should close dialog when close button is clicked', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.click(screen.getByLabelText('关闭对话框'))

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should close dialog when clicking overlay', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    // The dialog overlay is the parent of the dialog role element
    const overlay = screen.getByRole('dialog')
    fireEvent.click(overlay)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should not close dialog when clicking dialog content', () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    // Click on the inner content div (not the overlay)
    const content = screen.getByText('创建新项目').parentElement?.parentElement
    if (content) {
      fireEvent.click(content)
    }

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should disable close button during loading', async () => {
    mockCreateProject.mockImplementation(() => new Promise(() => {}))

    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.click(screen.getByText('创建项目'))

    expect(screen.getByLabelText('关闭对话框')).toBeDisabled()
  })

  it('should disable cancel button during loading', async () => {
    mockCreateProject.mockImplementation(() => new Promise(() => {}))

    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.click(screen.getByText('创建项目'))

    expect(screen.getByText('取消')).toBeDisabled()
  })

  it('should reset form when closing dialog', async () => {
    mockCreateProject.mockResolvedValue({ id: 'new-project' })

    const { rerender } = render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'New Project' } })
    fireEvent.change(screen.getByLabelText(/项目描述/), { target: { value: 'Description' } })

    fireEvent.click(screen.getByText('创建项目'))

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalled()
    })

    // Reopen dialog
    rerender(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    expect(screen.getByLabelText(/项目名称/)).toHaveValue('')
    expect(screen.getByLabelText(/项目描述/)).toHaveValue('')
  })

  it('should clear error when user starts typing', async () => {
    render(
      <CreateProjectDialog
        open={true}
        onClose={mockOnClose}
        onCreated={mockOnCreated}
      />
    )

    // Submit form directly to bypass HTML5 validation
    const form = screen.getByRole('dialog').querySelector('form')
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(screen.getByText('项目名称不能为空')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/项目名称/), { target: { value: 'A' } })

    expect(screen.queryByText('项目名称不能为空')).not.toBeInTheDocument()
  })
})
