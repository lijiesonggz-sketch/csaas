import { render, screen, fireEvent } from '@testing-library/react'
import { EditMemberDialog } from '../components/EditMemberDialog'
import { OrganizationMember } from '@/lib/types/organization'

describe('EditMemberDialog', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  const mockMember: OrganizationMember = {
    id: 'member-1',
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'member',
    createdAt: '2024-01-01T00:00:00Z',
    user: {
      id: 'user-1',
      name: '张三',
      email: 'zhangsan@example.com',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render dialog with member info when open', () => {
    render(
      <EditMemberDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    expect(screen.getByText('编辑成员角色')).toBeInTheDocument()
    expect(screen.getByText(/张三/)).toBeInTheDocument()
    expect(screen.getByText(/zhangsan@example.com/)).toBeInTheDocument()
  })

  it('should not render dialog when closed', () => {
    render(
      <EditMemberDialog
        open={false}
        member={mockMember}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    expect(screen.queryByText('编辑成员角色')).not.toBeInTheDocument()
  })

  it('should disable submit when role has not changed', () => {
    render(
      <EditMemberDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    const submitButton = screen.getByText('确认修改')
    expect(submitButton.closest('button')).toBeDisabled()
  })

  it('should call onClose when cancel is clicked', () => {
    render(
      <EditMemberDialog
        open={true}
        member={mockMember}
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
      <EditMemberDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    )

    expect(screen.getByText('更新中...')).toBeInTheDocument()
  })

  it('should handle null member gracefully', () => {
    render(
      <EditMemberDialog
        open={true}
        member={null}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    expect(screen.getByText('编辑成员角色')).toBeInTheDocument()
    // Should show fallback text for null member
    expect(screen.getByText(/-/)).toBeInTheDocument()
  })

  it('should disable inputs when loading', () => {
    render(
      <EditMemberDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={true}
      />,
    )

    expect(screen.getByText('取消').closest('button')).toBeDisabled()
  })

  it('should display member with admin role correctly', () => {
    const adminMember: OrganizationMember = {
      ...mockMember,
      role: 'admin',
    }

    render(
      <EditMemberDialog
        open={true}
        member={adminMember}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    )

    expect(screen.getByText('编辑成员角色')).toBeInTheDocument()
    // Submit should be disabled since role hasn't changed
    const submitButton = screen.getByText('确认修改').closest('button')
    expect(submitButton).toBeDisabled()
  })
})
