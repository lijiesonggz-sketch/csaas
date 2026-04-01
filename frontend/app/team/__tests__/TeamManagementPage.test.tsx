import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'

import TeamManagementPage from '../page'

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    getOrganizationMembers: jest.fn(),
    addMemberByEmail: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
  },
}))

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

const { Loader2 } = require('lucide-react')

const membersResponse = {
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

function setSession(overrides?: Partial<Record<'id' | 'organizationId' | 'organizationRole', string>>) {
  mockUseSession.mockReturnValue({
    data: {
      user: {
        id: overrides?.id ?? 'user-1',
        organizationId: overrides?.organizationId ?? 'org-1',
        organizationRole: overrides?.organizationRole ?? 'admin',
      },
    },
    status: 'authenticated',
  })
}

describe('TeamManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    organizationsApi.getOrganizationMembers.mockResolvedValue(membersResponse)
    setSession()
  })

  it('shows the loading spinner before members are loaded', () => {
    organizationsApi.getOrganizationMembers.mockImplementation(() => new Promise(() => {}))

    const { container } = render(<TeamManagementPage />)

    // Loader2 renders as SVG with animate-spin class (no role="progressbar")
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders the current header and member table for admins', async () => {
    render(<TeamManagementPage />)

    expect(await screen.findByText('团队管理')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加成员' })).toBeInTheDocument()
    // shadcn Table does not support name prop; just verify table exists
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    expect(screen.getByText('member@example.com')).toBeInTheDocument()
    expect(screen.getByText('操作')).toBeInTheDocument()
  })

  it('hides admin-only actions for non-admin users', async () => {
    setSession({ id: 'user-2', organizationRole: 'member' })

    render(<TeamManagementPage />)

    expect(await screen.findByText('团队管理')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加成员' })).not.toBeInTheDocument()
    expect(screen.queryByText('操作')).not.toBeInTheDocument()
  })

  it('disables self edit/remove actions and keeps other member actions enabled for admins', async () => {
    render(<TeamManagementPage />)

    await screen.findByText('admin@example.com')

    const selfEdit = screen.getByRole('button', { name: '编辑 管理员' })
    const selfRemove = screen.getByRole('button', { name: '移除 管理员' })
    const otherEdit = screen.getByRole('button', { name: '编辑 普通成员' })
    const otherRemove = screen.getByRole('button', { name: '移除 普通成员' })

    expect(selfEdit).toBeDisabled()
    expect(selfRemove).toBeDisabled()
    expect(otherEdit).not.toBeDisabled()
    expect(otherRemove).not.toBeDisabled()
  })

  it('shows the current empty state when there are no members', async () => {
    organizationsApi.getOrganizationMembers.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })

    render(<TeamManagementPage />)

    expect(await screen.findByText('暂无成员')).toBeInTheDocument()
  })

  it('shows the current error state when member loading fails', async () => {
    organizationsApi.getOrganizationMembers.mockRejectedValue(new Error('Network error'))

    render(<TeamManagementPage />)

    expect(await screen.findByText(/加载成员列表失败/)).toBeInTheDocument()
  })

  it('opens the add dialog and submits through the current handler wiring', async () => {
    organizationsApi.addMemberByEmail.mockResolvedValue({ id: 'new-member' })

    render(<TeamManagementPage />)

    fireEvent.click(await screen.findByRole('button', { name: '添加成员' }))
    expect(screen.getByText('AddMemberDialog')).toBeInTheDocument()

    fireEvent.click(screen.getByText('MockAddSubmit'))

    await waitFor(() => {
      expect(organizationsApi.addMemberByEmail).toHaveBeenCalledWith(
        'org-1',
        'new@example.com',
        'member',
      )
    })
  })

  it('opens edit/remove dialogs for another member and wires submit handlers', async () => {
    organizationsApi.updateMemberRole.mockResolvedValue({ role: 'admin' })
    organizationsApi.removeMember.mockResolvedValue(undefined)

    render(<TeamManagementPage />)

    fireEvent.click(await screen.findByRole('button', { name: '编辑 普通成员' }))
    expect(await screen.findByText('EditMemberDialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText('MockEditSubmit'))

    await waitFor(() => {
      expect(organizationsApi.updateMemberRole).toHaveBeenCalledWith('org-1', 'user-2', 'admin')
    })

    fireEvent.click(screen.getByRole('button', { name: '移除 普通成员' }))
    expect(await screen.findByText('ConfirmRemoveDialog')).toBeInTheDocument()
    fireEvent.click(screen.getByText('MockRemoveConfirm'))
    await waitFor(() => {
      expect(organizationsApi.removeMember).toHaveBeenCalledWith('org-1', 'user-2')
    })
  })

  it('does not request members when organizationId is missing', async () => {
    setSession({ organizationId: '' })

    render(<TeamManagementPage />)

    await waitFor(() => {
      expect(organizationsApi.getOrganizationMembers).not.toHaveBeenCalled()
    })
  })
})
