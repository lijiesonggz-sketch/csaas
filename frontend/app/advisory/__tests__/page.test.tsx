import { render, screen, waitFor } from '@testing-library/react'
import AdvisoryPage from '../page'
import { fetchThinkTankAccess } from '@/lib/advisory/access'

jest.mock('@/lib/advisory/access', () => ({
  fetchThinkTankAccess: jest.fn(),
}))

describe('AdvisoryPage', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders a loading state while access is being verified', () => {
    mockFetchThinkTankAccess.mockReturnValue(new Promise(() => {}))

    render(<AdvisoryPage />)

    expect(screen.getByRole('status')).toHaveTextContent('正在验证 ThinkTank 访问权限')
  })

  it('renders the authorized ThinkTank entry placeholder', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ThinkTank' })).toBeInTheDocument()
    })
    expect(
      screen.getByText('ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '咨询工作台暂未开放' })).toBeDisabled()
  })

  it('renders a friendly authorization denied state', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
    })

    render(<AdvisoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
      )
    })
    expect(
      screen.queryByText('ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。'),
    ).not.toBeInTheDocument()
  })
})
