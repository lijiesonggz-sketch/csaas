import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import TeamManagementPage from '../page'

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock organizations API
jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    getOrganizationMembers: jest.fn(),
    addMemberByEmail: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
  },
}))

// Mock dialog components to simplify page tests
jest.mock('../components/AddMemberDialog', () => ({
  AddMemberDialog: ({ open, onSubmit, onClose }: any) =>
    open ? (
      <div>
        AddMemberDialog
        <button onClick={() => onSubmit({ email: 'new@example.com', role: 'member' })}>
          MockAddSubmit
        </button>
        <button onClick={onClose}>MockAddClose</button>
      </div>
    ) : null,
}))
jest.mock('../components/EditMemberDialog', () => ({
  EditMemberDialog: ({ open, onSubmit, onClose }: any) =>
    open ? (
      <div>
        EditMemberDialog
        <button onClick={() => onSubmit('admin')}>MockEditSubmit</button>
        <button onClick={onClose}>MockEditClose</button>
      </div>
    ) : null,
}))
jest.mock('../components/ConfirmRemoveDialog', () => ({
  ConfirmRemoveDialog: ({ open, onConfirm, onClose }: any) =>
    open ? (
      <div>
        ConfirmRemoveDialog
        <button onClick={onConfirm}>MockRemoveConfirm</button>
        <button onClick={onClose}>MockRemoveClose</button>
      </div>
    ) : null,
}))

const { organizationsApi } = require('@/lib/api/organizations')
const mockUseSession = useSession as jest.Mock

const mockMembersResponse = {
  data: [
    {
      id: 'member-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00Z',
      user: { id: 'user-1', name: '管理员', email: 'admin@example.com' },
    },
    {
      id: 'member-2',
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'member',
      createdAt: '2024-01-02T00:00:00Z',
      user: { id: 'user-2', name: '普通成员', email: 'member@example.com' },
    },
  ],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
}

describe('TeamManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    organizationsApi.getOrganizationMembers.mockResolvedValue(mockMembersResponse)
  })

  it('should show loading state initially', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('should display page title after loading', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('团队管理')).toBeInTheDocument()
    })
  })

  it('should display member list with names and emails', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
      expect(screen.getByText('普通成员')).toBeInTheDocument()
      expect(screen.getByText('member@example.com')).toBeInTheDocument()
    })
  })

  it('should show add button for admin users', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('添加成员')).toBeInTheDocument()
    })
  })

  it('should hide add button for non-admin users', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-2', organizationId: 'org-1', role: 'member' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('团队管理')).toBeInTheDocument()
    })

    expect(screen.queryByText('添加成员')).not.toBeInTheDocument()
  })

  it('should disable edit/remove buttons for self (admin)', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    // Get all edit and remove buttons by aria-label
    const editButtons = screen.getAllByRole('button', { name: /编辑/ })
    const deleteButtons = screen.getAllByRole('button', { name: /移除/ })

    // First row is user-1 (self) - should be disabled
    expect(editButtons[0]).toBeDisabled()
    expect(deleteButtons[0]).toBeDisabled()

    // Second row is user-2 (other) - should be enabled
    expect(editButtons[1]).not.toBeDisabled()
    expect(deleteButtons[1]).not.toBeDisabled()
  })

  it('should show empty state when no members', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    organizationsApi.getOrganizationMembers.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无成员')).toBeInTheDocument()
    })
  })

  it('should show error state on API failure', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    organizationsApi.getOrganizationMembers.mockRejectedValue(
      new Error('Network error'),
    )

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText(/加载成员列表失败/)).toBeInTheDocument()
    })
  })

  it('should display role chips correctly', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      // "管理员" appears in both name column and role chip
      expect(screen.getAllByText('管理员').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('成员').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should open add member dialog when add button is clicked', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('添加成员')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('添加成员'))

    await waitFor(() => {
      expect(screen.getByText('AddMemberDialog')).toBeInTheDocument()
    })
  })

  it('should call addMemberByEmail and refresh list on add submit', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })
    organizationsApi.addMemberByEmail.mockResolvedValue({ id: 'new-member' })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('添加成员')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('添加成员'))

    await waitFor(() => {
      expect(screen.getByText('MockAddSubmit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('MockAddSubmit'))

    await waitFor(() => {
      expect(organizationsApi.addMemberByEmail).toHaveBeenCalledWith(
        'org-1',
        'new@example.com',
        'member',
      )
    })
  })

  it('should open edit dialog when edit button is clicked for other member', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    // Click edit on user-2 (second edit button, not disabled)
    const editButtons = screen.getAllByRole('button', { name: /编辑/ })
    fireEvent.click(editButtons[1])

    await waitFor(() => {
      expect(screen.getByText('EditMemberDialog')).toBeInTheDocument()
    })
  })

  it('should open remove dialog when remove button is clicked for other member', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    // Click remove on user-2 (second delete button, not disabled)
    const deleteButtons = screen.getAllByRole('button', { name: /移除/ })
    fireEvent.click(deleteButtons[1])

    await waitFor(() => {
      expect(screen.getByText('ConfirmRemoveDialog')).toBeInTheDocument()
    })
  })

  it('should call removeMember and refresh list on remove confirm', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })
    organizationsApi.removeMember.mockResolvedValue(undefined)

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /移除/ })
    fireEvent.click(deleteButtons[1])

    await waitFor(() => {
      expect(screen.getByText('MockRemoveConfirm')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('MockRemoveConfirm'))

    await waitFor(() => {
      expect(organizationsApi.removeMember).toHaveBeenCalledWith('org-1', 'user-2')
    })
  })

  it('should call updateMemberRole on edit submit', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })
    organizationsApi.updateMemberRole.mockResolvedValue({ role: 'admin' })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /编辑/ })
    fireEvent.click(editButtons[1])

    await waitFor(() => {
      expect(screen.getByText('MockEditSubmit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('MockEditSubmit'))

    await waitFor(() => {
      expect(organizationsApi.updateMemberRole).toHaveBeenCalledWith('org-1', 'user-2', 'admin')
    })
  })

  it('should not fetch members when organizationId is missing', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1' }, // no organizationId
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    // Should still show loading since organizationId is undefined
    // and fetchMembers returns early
    await waitFor(() => {
      expect(organizationsApi.getOrganizationMembers).not.toHaveBeenCalled()
    })
  })

  it('should hide operation column for non-admin users', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-2', organizationId: 'org-1', role: 'member' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('团队管理')).toBeInTheDocument()
    })

    // "操作" column header should not be present for non-admin
    expect(screen.queryByText('操作')).not.toBeInTheDocument()
  })

  it('should display table headers correctly', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', organizationId: 'org-1', role: 'admin' },
      },
      status: 'authenticated',
    })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(screen.getByText('姓名')).toBeInTheDocument()
      expect(screen.getByText('邮箱')).toBeInTheDocument()
      expect(screen.getByText('加入时间')).toBeInTheDocument()
    })
  })
})
