import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'
import AdvisoryLayout from '../layout'
import AdvisoryPage from '../page'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

jest.mock('@/lib/advisory/access', () => ({
  canAccessThinkTank: jest.fn(() => true),
  fetchThinkTankAccess: jest.fn(),
  THINKTANK_ACCESS_DENIED_MESSAGE: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}))

const mockFetchOrganizationContext = jest.fn()
const mockSaveOrganizationContext = jest.fn()
const mockReadOrganizationContextSkip = jest.fn()
const mockWriteOrganizationContextSkip = jest.fn()

const mockStartQuickConsult = jest.fn()
const mockReadQuickConsultDraft = jest.fn()
const mockSaveQuickConsultDraft = jest.fn()
const mockSubmitQuickConsultRecommendationFeedback = jest.fn()

jest.mock('@/lib/advisory/quick-consult', () => ({
  QUICK_CONSULT_PROBLEM_MAX_LENGTH: 5000,
  QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE: '请先描述你要咨询的问题。',
  QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE: '问题描述过长，请精简到 5000 字以内。',
  QUICK_CONSULT_START_FAILED_MESSAGE: '暂时无法启动 Quick Consult，请稍后重试。',
  QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE: '暂时无法保存推荐反馈，请稍后重试。',
  QUICK_CONSULT_FEEDBACK_MAX_LENGTH: 2000,
  readQuickConsultDraft: (...args: unknown[]) => mockReadQuickConsultDraft(...args),
  saveQuickConsultDraft: (...args: unknown[]) => mockSaveQuickConsultDraft(...args),
  startQuickConsult: (...args: unknown[]) => mockStartQuickConsult(...args),
  submitQuickConsultRecommendationFeedback: (...args: unknown[]) =>
    mockSubmitQuickConsultRecommendationFeedback(...args),
}))

const mockFetchThinkTankWorkflows = jest.fn()
const mockFetchThinkTankManualBrowseCatalog = jest.fn()
const mockFetchThinkTankSessionMessages = jest.fn()
const mockLaunchThinkTankWorkflow = jest.fn()
const mockSendThinkTankSessionMessage = jest.fn()

jest.mock('@/lib/advisory/workflows', () => ({
  THINKTANK_EMPTY_MESSAGE_MESSAGE: '请输入你的回答后再提交。',
  THINKTANK_MESSAGE_MAX_LENGTH: 5000,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
  THINKTANK_MESSAGE_TOO_LONG_MESSAGE: '内容过长，请精简到 5000 字符以内。',
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE:
    '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。',
  fetchThinkTankWorkflows: (...args: unknown[]) => mockFetchThinkTankWorkflows(...args),
  fetchThinkTankManualBrowseCatalog: (...args: unknown[]) =>
    mockFetchThinkTankManualBrowseCatalog(...args),
  fetchThinkTankSessionMessages: (...args: unknown[]) => mockFetchThinkTankSessionMessages(...args),
  launchThinkTankWorkflow: (...args: unknown[]) => mockLaunchThinkTankWorkflow(...args),
  sendThinkTankSessionMessage: (...args: unknown[]) => mockSendThinkTankSessionMessage(...args),
}))

jest.mock('@/lib/advisory/streaming', () => ({
  THINKTANK_STREAM_ERROR_MESSAGE: 'ThinkTank streaming response was malformed. Please retry.',
  streamThinkTankSessionMessage: jest.fn(async function* () {}),
}))

jest.mock('@/lib/advisory/outputs', () => ({
  THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE: '暂时无法更新报告草稿，请稍后重试。',
  THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE: '报告导出失败，请重试。',
  fetchThinkTankWorkflowOutput: jest.fn(async () => ({ output: null })),
  appendThinkTankWorkflowOutputSection: jest.fn(),
  completeThinkTankSessionOutput: jest.fn(),
  downloadThinkTankSessionOutput: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/advisory',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

function installDesktopViewport() {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1440,
  })
}

function renderAdvisoryRoute() {
  return render(
    <AdvisoryLayout>
      <AdvisoryPage />
    </AdvisoryLayout>
  )
}

const workflowCatalog = [
  {
    key: 'brainstorming',
    displayName: 'Brainstorming',
    canonicalName: 'Brainstorming',
    scenarioLabel: 'Generate options',
    description: 'Explore alternatives quickly.',
    sourcePath: 'workflow:brainstorming',
  },
  {
    key: 'problem-solving',
    displayName: 'Problem Solving',
    canonicalName: 'Problem Solving',
    scenarioLabel: 'Diagnose root causes',
    description: 'Structure root-cause analysis.',
    sourcePath: 'workflow:problem-solving',
  },
]

function createSavedOrganizationContext(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-context-a',
    organizationName: '华数安全',
    industry: '数据安全合规',
    size: '51-200人',
    completenessScore: 1,
    completeness: {
      requiredFieldsComplete: true,
      missingFields: [],
      updatedAt: '2026-05-20T15:33:04.000Z',
    },
    appliedToPrompts: true,
    ...overrides,
  }
}

describe('Story 3.6 enterprise background frontend acceptance tests (ATDD RED)', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockUseSession = useSession as jest.Mock
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.MockedFunction<
    typeof useRadarUnreadCount
  >

  beforeEach(() => {
    jest.clearAllMocks()
    cleanup()
    window.localStorage.clear()
    window.sessionStorage.clear()
    installDesktopViewport()

    mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
    mockUseRadarUnreadCount.mockReturnValue({ unreadCount: 0 })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'consultant-primary',
          name: 'ThinkTank Consultant',
          email: 'consultant@example.com',
          role: 'consultant',
          organizationId: 'tenant-a',
        },
      },
      status: 'authenticated',
    })

    mockFetchOrganizationContext.mockResolvedValue({ context: null })
    mockReadOrganizationContextSkip.mockReturnValue(false)
    mockWriteOrganizationContextSkip.mockImplementation(({ userIdentity, tenantId }) => {
      window.sessionStorage.setItem(
        `thinktank:organization-context-skip:${tenantId}:${userIdentity}`,
        'true'
      )
    })
    mockSaveOrganizationContext.mockResolvedValue(createSavedOrganizationContext())
    mockReadQuickConsultDraft.mockReturnValue('')
    mockSaveQuickConsultDraft.mockImplementation(() => undefined)
    mockStartQuickConsult.mockResolvedValue({
      contextId: 'quick-consult-context-36',
      consultId: 'quick-consult-context-36',
      status: 'analysis_started',
      originalProblem: '评估合规咨询产品的企业销售切入点。',
      organizationContextApplied: true,
      organizationContextSnapshot: createSavedOrganizationContext(),
      recommendations: [],
      recommendationConfidence: 'none',
    })
    mockFetchThinkTankWorkflows.mockResolvedValue({ workflows: workflowCatalog })
    mockFetchThinkTankManualBrowseCatalog.mockResolvedValue({
      workflows: [],
      methodChoices: [],
      methodCatalogStatus: 'available',
    })
    mockFetchThinkTankSessionMessages.mockResolvedValue({
      sessionId: 'session-36',
      currentStep: { index: 1, label: 'Start' },
      messages: [],
    })
    mockLaunchThinkTankWorkflow.mockResolvedValue({
      sessionId: 'session-36',
      status: 'active',
      workflow: workflowCatalog[0],
      firstPrompt: '使用已保存的企业背景启动工作流。',
      sourceRefs: ['workflow:brainstorming'],
      currentStep: { index: 1, label: 'Start', sourceRef: 'workflow:brainstorming' },
      organizationContextApplied: true,
      organizationContextSnapshot: createSavedOrganizationContext(),
    })
  })

  test.skip('[P0][3.6-UI-001][AC1] opens an accessible enterprise background dialog on first use when no usable context exists', async () => {
    renderAdvisoryRoute()

    const dialog = await screen.findByRole('dialog', { name: /企业背景|组织背景/ })
    expect(within(dialog).getByRole('heading', { name: /企业背景|组织背景/ })).toBeVisible()
    const organizationName = within(dialog).getByLabelText('企业名称')
    expect(organizationName).toBeRequired()
    expect(organizationName).toHaveFocus()
    expect(within(dialog).getByLabelText('行业')).toBeVisible()
    expect(within(dialog).getByLabelText('规模')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: '保存并开始' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: '跳过' })).toBeEnabled()
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
  })

  test.skip('[P0][3.6-UI-002][AC1] requires enterprise name while allowing industry and size to remain blank for later completion', async () => {
    const user = userEvent.setup()
    renderAdvisoryRoute()

    const dialog = await screen.findByRole('dialog', { name: /企业背景|组织背景/ })
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('企业名称')
    expect(mockSaveOrganizationContext).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('企业名称'), '华数安全')
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    await waitFor(() => {
      expect(mockSaveOrganizationContext).toHaveBeenCalledWith({
        organizationName: '华数安全',
      })
    })
    const savedPayload = mockSaveOrganizationContext.mock.calls[0][0]
    expect(savedPayload).not.toHaveProperty('tenantId')
    expect(savedPayload).not.toHaveProperty('actorId')
    expect(savedPayload).not.toHaveProperty('completenessScore')
  })

  test.skip('[P0][3.6-UI-003][AC2] saves enterprise background and then allows the pending Quick Consult journey to continue with context applied', async () => {
    const user = userEvent.setup()
    renderAdvisoryRoute()

    const dialog = await screen.findByRole('dialog', { name: /企业背景|组织背景/ })
    await user.type(within(dialog).getByLabelText('企业名称'), '华数安全')
    await user.type(within(dialog).getByLabelText('行业'), '数据安全合规')
    await user.type(within(dialog).getByLabelText('规模'), '51-200人')
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    await waitFor(() => {
      expect(mockSaveOrganizationContext).toHaveBeenCalledWith({
        organizationName: '华数安全',
        industry: '数据安全合规',
        size: '51-200人',
      })
    })

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '评估合规咨询产品的企业销售切入点。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    await waitFor(() => {
      expect(mockStartQuickConsult).toHaveBeenCalledWith(
        expect.objectContaining({ problem: '评估合规咨询产品的企业销售切入点。' })
      )
    })
    expect(
      await screen.findByRole('status', { name: /企业背景应用状态|Quick Consult status/ })
    ).toHaveTextContent(/华数安全|5-minute analysis started/)
  })

  test.skip('[P0][3.6-UI-004][AC1][AC2] skips first-use capture without calling the save API and stores only tenant-scoped local session state', async () => {
    const user = userEvent.setup()
    renderAdvisoryRoute()

    const dialog = await screen.findByRole('dialog', { name: /企业背景|组织背景/ })
    await user.click(within(dialog).getByRole('button', { name: '跳过' }))

    expect(mockSaveOrganizationContext).not.toHaveBeenCalled()
    expect(mockWriteOrganizationContextSkip).toHaveBeenCalledWith({
      userIdentity: 'consultant-primary',
      tenantId: 'tenant-a',
    })
    const skipValue =
      window.sessionStorage.getItem(
        'thinktank:organization-context-skip:tenant-a:consultant-primary'
      ) ??
      window.localStorage.getItem('thinktank:organization-context-skip:tenant-a:consultant-primary')
    expect(skipValue).toBe('true')
    expect(JSON.stringify(window.sessionStorage)).not.toContain('华数安全')

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '跳过背景后仍要启动咨询。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    await waitFor(() => expect(mockStartQuickConsult).toHaveBeenCalled())
  })

  test.skip('[P0][3.6-UI-005][AC4] updates enterprise background from settings and uses the updated context in the next consult', async () => {
    const user = userEvent.setup()
    mockFetchOrganizationContext.mockResolvedValueOnce({
      context: createSavedOrganizationContext({
        organizationName: '旧公司',
        industry: '通用咨询',
        size: '1-50人',
      }),
    })
    mockSaveOrganizationContext.mockResolvedValueOnce(
      createSavedOrganizationContext({ organizationName: '华数安全集团', size: '201-500人' })
    )
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-after-settings-36',
      consultId: 'quick-consult-after-settings-36',
      status: 'analysis_started',
      originalProblem: '基于更新后的企业背景评估销售路径。',
      organizationContextApplied: true,
      organizationContextSnapshot: createSavedOrganizationContext({
        organizationName: '华数安全集团',
        size: '201-500人',
      }),
      operationalStatus: '已应用企业背景：华数安全集团。',
    })

    renderAdvisoryRoute()

    await user.click(await screen.findByRole('button', { name: /编辑企业背景|企业背景设置/ }))
    const settingsDialog = await screen.findByRole('dialog', { name: /编辑企业背景|企业背景设置/ })
    await user.clear(within(settingsDialog).getByLabelText('企业名称'))
    await user.type(within(settingsDialog).getByLabelText('企业名称'), '华数安全集团')
    await user.clear(within(settingsDialog).getByLabelText('行业'))
    await user.type(within(settingsDialog).getByLabelText('行业'), '数据安全合规')
    await user.clear(within(settingsDialog).getByLabelText('规模'))
    await user.type(within(settingsDialog).getByLabelText('规模'), '201-500人')
    await user.click(within(settingsDialog).getByRole('button', { name: /保存|保存并开始/ }))

    await waitFor(() => {
      expect(mockSaveOrganizationContext).toHaveBeenCalledWith({
        organizationName: '华数安全集团',
        industry: '数据安全合规',
        size: '201-500人',
      })
    })

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '基于更新后的企业背景评估销售路径。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    expect(
      await screen.findByRole('status', { name: /企业背景应用状态|Quick Consult status/ })
    ).toHaveTextContent(/华数安全集团|已应用企业背景/)
    expect(screen.queryByText('旧公司')).not.toBeInTheDocument()
  })

  test.skip('[P0][3.6-UI-006][AC3][AC4] keeps organization context and completeness metadata isolated when the active tenant changes', async () => {
    const user = userEvent.setup()
    mockFetchOrganizationContext.mockResolvedValueOnce({
      context: createSavedOrganizationContext({
        id: 'org-context-tenant-a',
        organizationName: 'Tenant A 安全',
        completeness: {
          requiredFieldsComplete: true,
          missingFields: [],
          updatedAt: '2026-05-20T15:00:00.000Z',
        },
      }),
    })

    const tenantAView = renderAdvisoryRoute()
    expect(await screen.findByText(/Tenant A 安全/)).toBeVisible()
    tenantAView.unmount()
    cleanup()

    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'consultant-secondary',
          email: 'secondary@example.com',
          role: 'consultant',
          organizationId: 'tenant-b',
        },
      },
      status: 'authenticated',
    })
    mockFetchOrganizationContext.mockResolvedValueOnce({ context: null })
    mockSaveOrganizationContext.mockResolvedValueOnce(
      createSavedOrganizationContext({
        id: 'org-context-tenant-b',
        organizationName: 'Tenant B 咨询',
      })
    )

    renderAdvisoryRoute()

    const tenantBDialog = await screen.findByRole('dialog', { name: /企业背景|组织背景/ })
    expect(screen.queryByText(/Tenant A 安全/)).not.toBeInTheDocument()
    expect(screen.queryByText(/org-context-tenant-a/)).not.toBeInTheDocument()
    expect(within(tenantBDialog).getByLabelText('企业名称')).toHaveValue('')

    await user.type(within(tenantBDialog).getByLabelText('企业名称'), 'Tenant B 咨询')
    await user.click(within(tenantBDialog).getByRole('button', { name: '保存并开始' }))

    await waitFor(() => {
      expect(mockSaveOrganizationContext).toHaveBeenLastCalledWith({
        organizationName: 'Tenant B 咨询',
      })
    })
    const tenantBCalls = JSON.stringify(mockSaveOrganizationContext.mock.calls)
    expect(tenantBCalls).not.toContain('Tenant A 安全')
    expect(tenantBCalls).not.toContain('org-context-tenant-a')
    expect(tenantBCalls).not.toContain('tenant-a')
  })
})
