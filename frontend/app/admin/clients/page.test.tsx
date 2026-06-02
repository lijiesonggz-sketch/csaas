import { render, screen } from '@testing-library/react'
import ClientsPage from './page'
import { getClients, getClientGroups, IndustryType, OrganizationStatus } from '@/lib/api/clients'

jest.mock('@/components/admin/ClientCard', () => ({
  ClientCard: ({ client }: { client: { name: string } }) => <div>{client.name}</div>,
}))

jest.mock('@/components/admin/AddClientDialog', () => ({
  AddClientDialog: () => null,
}))

jest.mock('@/components/admin/BulkConfigDialog', () => ({
  BulkConfigDialog: () => null,
}))

jest.mock('@/components/admin/BulkImportDialog', () => ({
  BulkImportDialog: () => null,
}))

jest.mock('@/components/admin/ClientGroupDialog', () => ({
  ClientGroupDialog: () => null,
}))

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

jest.mock('@/lib/api/clients', () => {
  const actual = jest.requireActual('@/lib/api/clients')
  return {
    ...actual,
    getClients: jest.fn(),
    getClientGroups: jest.fn(),
    createClient: jest.fn(),
    updateClient: jest.fn(),
    deleteClient: jest.fn(),
    bulkImportFromCsv: jest.fn(),
    downloadCsvTemplate: jest.fn(),
    bulkConfigClients: jest.fn(),
    createClientGroup: jest.fn(),
    deleteClientGroup: jest.fn(),
    addClientsToGroup: jest.fn(),
    removeClientFromGroup: jest.fn(),
  }
})

describe('ClientsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getClients as jest.Mock).mockResolvedValue([
      {
        id: 'client-1',
        name: '华数客户',
        industryType: IndustryType.BANKING,
        status: OrganizationStatus.ACTIVE,
        createdAt: '2026-06-02T00:00:00.000Z',
        updatedAt: '2026-06-02T00:00:00.000Z',
      },
    ])
    ;(getClientGroups as jest.Mock).mockResolvedValue([])
  })

  it('renders filter selects without empty SelectItem values', async () => {
    render(<ClientsPage />)

    expect(await screen.findByText('客户管理')).toBeInTheDocument()
    expect(screen.getByTestId('industry-filter')).toBeInTheDocument()
    expect(screen.getByTestId('status-filter')).toBeInTheDocument()
    expect(screen.getByText('华数客户')).toBeInTheDocument()
  })
})
