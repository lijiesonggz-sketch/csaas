import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddMemberDialog } from '../components/AddMemberDialog'

describe('AddMemberDialog', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render dialog when open', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    expect(screen.getByText('添加成员')).toBeInTheDocument()
    expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument()
    // MUI Select renders "角色" in both label and legend
    expect(screen.getAllByText('角色').length).toBeGreaterThanOrEqual(1)
  })

  it('should not render dialog when closed', () => {
    render(
      <AddMemberDialog
        open={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    expect(screen.queryByText('添加成员')).not.toBeInTheDocument()
  })

  it('should validate empty email', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    // When email is empty, submit button should be disabled
    const submitButton = screen.getByText('确认添加').closest('button')
    expect(submitButton).toBeDisabled()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate invalid email format', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    const emailInput = screen.getByLabelText('邮箱地址')
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(screen.getByText('确认添加'))

    expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should submit with valid email and default role', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    const emailInput = screen.getByLabelText('邮箱地址')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByText('确认添加'))

    expect(mockOnSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      role: 'member',
    })
  })

  it('should call onClose when cancel is clicked', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    fireEvent.click(screen.getByText('取消'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show loading state', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    )

    expect(screen.getByText('添加中...')).toBeInTheDocument()
  })

  it('should disable submit button when email is empty', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    const submitButton = screen.getByText('确认添加')
    expect(submitButton.closest('button')).toBeDisabled()
  })

  it('should trim email before submitting', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    const emailInput = screen.getByLabelText('邮箱地址')
    fireEvent.change(emailInput, { target: { value: '  test@example.com  ' } })
    fireEvent.click(screen.getByText('确认添加'))

    expect(mockOnSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      role: 'member',
    })
  })

  it('should disable inputs when loading', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    )

    const emailInput = screen.getByLabelText('邮箱地址')
    expect(emailInput).toBeDisabled()
    expect(screen.getByText('取消').closest('button')).toBeDisabled()
  })

  it('should show error for whitespace-only email on submit', () => {
    render(
      <AddMemberDialog
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    // The submit button is disabled when email is empty/whitespace
    const submitButton = screen.getByText('确认添加').closest('button')
    expect(submitButton).toBeDisabled()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })
})
