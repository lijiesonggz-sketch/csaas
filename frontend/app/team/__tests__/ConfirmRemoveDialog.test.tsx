import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmRemoveDialog } from '../components/ConfirmRemoveDialog'
import { OrganizationMember } from '@/lib/types/organization'

describe('ConfirmRemoveDialog', () => {
  const mockOnClose = jest.fn()
  const mockOnConfirm = jest.fn()

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

  it('should render dialog with member name when open', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    expect(screen.getByText('确认移除成员')).toBeInTheDocument()
    expect(screen.getByText('张三')).toBeInTheDocument()
  })

  it('should not render dialog when closed', () => {
    render(
      <ConfirmRemoveDialog
        open={false}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    expect(screen.queryByText('确认移除成员')).not.toBeInTheDocument()
  })

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    fireEvent.click(screen.getByText('确认移除'))
    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when cancel button is clicked', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    fireEvent.click(screen.getByText('取消'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should show loading state', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={true}
      />,
    )

    expect(screen.getByText('移除中...')).toBeInTheDocument()
  })

  it('should show warning text about consequences', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    expect(
      screen.getByText(/移除后，该成员将无法访问组织的项目和资源/),
    ).toBeInTheDocument()
  })

  it('should handle null member with fallback text', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={null}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    expect(screen.getByText('确认移除成员')).toBeInTheDocument()
    expect(screen.getByText('该成员')).toBeInTheDocument()
  })

  it('should disable buttons when loading', () => {
    render(
      <ConfirmRemoveDialog
        open={true}
        member={mockMember}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={true}
      />,
    )

    expect(screen.getByText('取消').closest('button')).toBeDisabled()
    expect(screen.getByText('移除中...').closest('button')).toBeDisabled()
  })

  it('should display member email when name is not available', () => {
    const memberWithoutName: OrganizationMember = {
      ...mockMember,
      user: {
        id: 'user-1',
        name: '',
        email: 'noname@example.com',
      },
    }

    render(
      <ConfirmRemoveDialog
        open={true}
        member={memberWithoutName}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isLoading={false}
      />,
    )

    expect(screen.getByText('noname@example.com')).toBeInTheDocument()
  })
})
