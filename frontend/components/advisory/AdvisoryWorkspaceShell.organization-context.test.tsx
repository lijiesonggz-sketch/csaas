import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import {
  fetchOrganizationContext,
  saveOrganizationContext,
  writeOrganizationContextSkip,
} from '@/lib/advisory/organization-context'
import { launchThinkTankWorkflow } from '@/lib/advisory/workflows'

const mockStartQuickConsultFromShell = jest.fn()
let mockSessionUser = {
  id: 'user-1',
  email: 'user@example.com',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
}

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: mockSessionUser,
    },
  }),
}))

jest.mock('@/components/advisory/QuickConsultProblemIntake', () => ({
  QuickConsultProblemIntake: ({
    onBeforeStartQuickConsult,
  }: {
    onBeforeStartQuickConsult?: () => Promise<boolean> | boolean
  }) => (
    <button
      type="button"
      onClick={() => {
        Promise.resolve(onBeforeStartQuickConsult?.() ?? true).then((allowed) => {
          if (allowed !== false) {
            mockStartQuickConsultFromShell()
          }
        })
      }}
    >
      Quick Consult Ready
    </button>
  ),
}))

jest.mock('@/components/advisory/AdvisoryDocumentDrawer', () => ({
  AdvisoryDocumentDrawer: () => null,
}))

jest.mock('@/lib/advisory/organization-context', () => ({
  fetchOrganizationContext: jest.fn(),
  saveOrganizationContext: jest.fn(),
  readOrganizationContextSkip: jest.fn(() => false),
  writeOrganizationContextSkip: jest.fn(),
  isOrganizationContextUsable: jest.fn((context) => Boolean(context?.organizationName)),
}))

jest.mock('@/lib/advisory/workflows', () => ({
  THINKTANK_EMPTY_MESSAGE_MESSAGE: '请输入你的回答后再提交。',
  THINKTANK_MESSAGE_MAX_LENGTH: 5000,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE:
    '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。',
  fetchThinkTankWorkflows: jest.fn().mockResolvedValue({
    workflows: [
      {
        key: 'design-thinking',
        displayName: 'Design Thinking',
        canonicalName: 'Design Thinking',
        scenarioLabel: 'Improve onboarding',
        sourcePath: 'workflow:design-thinking',
      },
    ],
  }),
  fetchThinkTankSessionMessages: jest.fn().mockResolvedValue({ messages: [] }),
  launchThinkTankWorkflow: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    workflow: {
      key: 'design-thinking',
      displayName: 'Design Thinking',
      canonicalName: 'Design Thinking',
      scenarioLabel: 'Improve onboarding',
      sourcePath: 'workflow:design-thinking',
    },
    status: 'active',
    sourceRefs: ['workflow:design-thinking'],
    firstPrompt: 'Start design thinking.',
    currentStep: {
      index: 1,
      label: '当前步骤',
      sourceRef: 'current-step:1',
    },
  }),
}))

jest.mock('@/lib/advisory/streaming', () => ({
  THINKTANK_STREAM_ERROR_MESSAGE: 'stream failed',
  streamThinkTankSessionMessage: jest.fn(),
}))

jest.mock('@/lib/advisory/outputs', () => ({
  THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE: 'append failed',
  THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE: 'export failed',
  appendThinkTankWorkflowOutputSection: jest.fn(),
  completeThinkTankSessionOutput: jest.fn(),
  downloadThinkTankSessionOutput: jest.fn(),
  fetchThinkTankWorkflowOutput: jest.fn().mockResolvedValue({ output: null }),
}))

const mockFetchOrganizationContext = fetchOrganizationContext as jest.Mock
const mockSaveOrganizationContext = saveOrganizationContext as jest.Mock
const mockWriteOrganizationContextSkip = writeOrganizationContextSkip as jest.Mock
const mockLaunchThinkTankWorkflow = launchThinkTankWorkflow as jest.Mock

describe('AdvisoryWorkspaceShell organization context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionUser = {
      id: 'user-1',
      email: 'user@example.com',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
    }
    window.sessionStorage.clear()
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
    mockFetchOrganizationContext.mockResolvedValue({
      context: null,
      completenessScore: 0,
      completeness: {
        requiredFieldsComplete: false,
        missingFields: ['organizationName', 'industry', 'size'],
        updatedAt: null,
      },
      appliedToPrompts: false,
    })
    mockSaveOrganizationContext.mockResolvedValue({
      id: 'context-1',
      organizationName: '华数安全集团',
      industry: '数据安全合规',
      size: null,
      completenessScore: 67,
      completeness: {
        requiredFieldsComplete: true,
        missingFields: ['size'],
        updatedAt: '2026-05-20T15:33:04.000Z',
      },
      appliedToPrompts: false,
    })
  })

  it('opens the first-use background dialog when no usable context exists', async () => {
    render(<AdvisoryWorkspaceShell />)

    const dialog = await screen.findByRole('dialog', { name: /企业背景/ })
    expect(within(dialog).getByLabelText('企业名称')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('行业')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('规模')).toBeInTheDocument()
  })

  it('saves first-use context and closes the dialog', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    const dialog = await screen.findByRole('dialog', { name: /企业背景/ })
    await user.type(within(dialog).getByLabelText('企业名称'), '华数安全集团')
    await user.type(within(dialog).getByLabelText('行业'), '数据安全合规')
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    await waitFor(() =>
      expect(mockSaveOrganizationContext).toHaveBeenCalledWith({
        organizationName: '华数安全集团',
        industry: '数据安全合规',
        size: undefined,
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /企业背景/ })).not.toBeInTheDocument()
    )
  })

  it('skips first-use context locally without saving and exposes settings edit', async () => {
    const user = userEvent.setup()
    mockFetchOrganizationContext.mockResolvedValueOnce({
      id: 'context-1',
      organizationName: '旧企业',
      industry: '旧行业',
      size: '1-50人',
      completenessScore: 100,
      completeness: {
        requiredFieldsComplete: true,
        missingFields: [],
        updatedAt: '2026-05-20T15:33:04.000Z',
      },
      appliedToPrompts: false,
    })

    render(<AdvisoryWorkspaceShell />)

    expect(await screen.findByText('Quick Consult Ready')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '企业背景设置' }))

    const settingsDialog = await screen.findByRole('dialog', { name: /企业背景设置/ })
    expect(within(settingsDialog).getByLabelText('企业名称')).toHaveValue('旧企业')
  })

  it('skip closes first-use dialog without backend save', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    const dialog = await screen.findByRole('dialog', { name: /企业背景/ })
    await user.click(within(dialog).getByRole('button', { name: '跳过' }))

    expect(mockWriteOrganizationContextSkip).toHaveBeenCalledWith('tenant-1:org-1:user-1')
    expect(mockSaveOrganizationContext).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /企业背景/ })).not.toBeInTheDocument()
    )
  })

  it('holds Quick Consult start behind first-use save and resumes after context is stored', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    fireEvent.click(await screen.findByRole('button', { name: 'Quick Consult Ready' }))
    await Promise.resolve()
    expect(mockStartQuickConsultFromShell).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog', { name: /企业背景/ })
    await user.type(within(dialog).getByLabelText('企业名称'), '华数安全集团')
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))

    await waitFor(() => expect(mockStartQuickConsultFromShell).toHaveBeenCalledTimes(1))
  })

  it('holds Quick Consult start while organization context is loading and resumes after skip', async () => {
    const user = userEvent.setup()
    let resolveFetch: (value: unknown) => void = () => undefined
    mockFetchOrganizationContext.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )

    render(<AdvisoryWorkspaceShell />)

    fireEvent.click(await screen.findByRole('button', { name: 'Quick Consult Ready' }))
    await Promise.resolve()
    expect(mockStartQuickConsultFromShell).not.toHaveBeenCalled()

    resolveFetch({
      context: null,
      completenessScore: 0,
      completeness: {
        requiredFieldsComplete: false,
        missingFields: ['organizationName', 'industry', 'size'],
        updatedAt: null,
      },
      appliedToPrompts: false,
    })
    const dialog = await screen.findByRole('dialog', { name: /企业背景/ })
    await user.click(within(dialog).getByRole('button', { name: '跳过' }))

    await waitFor(() => expect(mockStartQuickConsultFromShell).toHaveBeenCalledTimes(1))
  })

  it('resumes a pending Quick Consult when initial organization context loading fails', async () => {
    let rejectFetch: (reason?: unknown) => void = () => undefined
    mockFetchOrganizationContext.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFetch = reject
      })
    )

    render(<AdvisoryWorkspaceShell />)

    fireEvent.click(await screen.findByRole('button', { name: 'Quick Consult Ready' }))
    await Promise.resolve()
    expect(mockStartQuickConsultFromShell).not.toHaveBeenCalled()

    rejectFetch(new Error('context store unavailable'))

    await waitFor(() => expect(mockStartQuickConsultFromShell).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /企业背景/ })).not.toBeInTheDocument()
    )
  })

  it('does not reuse a previous tenant organization context while the new tenant context is loading', async () => {
    mockFetchOrganizationContext.mockResolvedValueOnce({
      id: 'context-tenant-1',
      organizationName: 'Tenant 1 Security',
      industry: 'Data security',
      size: null,
      completenessScore: 67,
      completeness: {
        requiredFieldsComplete: true,
        missingFields: ['size'],
        updatedAt: '2026-05-20T15:33:04.000Z',
      },
      appliedToPrompts: false,
    })
    const { rerender } = render(<AdvisoryWorkspaceShell />)
    expect(await screen.findByText('Quick Consult Ready')).toBeInTheDocument()
    await waitFor(() => expect(mockFetchOrganizationContext).toHaveBeenCalledTimes(1))

    mockSessionUser = {
      id: 'user-2',
      email: 'user-2@example.com',
      tenantId: 'tenant-2',
      organizationId: 'org-2',
    }
    mockFetchOrganizationContext.mockReturnValueOnce(new Promise(() => undefined))
    rerender(<AdvisoryWorkspaceShell />)

    fireEvent.click(await screen.findByRole('button', { name: 'Quick Consult Ready' }))
    await Promise.resolve()

    expect(mockStartQuickConsultFromShell).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: /企业背景/ })).toBeInTheDocument()
  })

  it('does not bypass first-use gate after organization context save fails', async () => {
    const user = userEvent.setup()
    mockSaveOrganizationContext.mockRejectedValueOnce(new Error('save failed'))
    render(<AdvisoryWorkspaceShell />)

    const dialog = await screen.findByRole('dialog', { name: /企业背景/ })
    await user.type(within(dialog).getByLabelText('企业名称'), '华数安全集团')
    await user.click(within(dialog).getByRole('button', { name: '保存并开始' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('save failed')

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /企业背景/ })).not.toBeInTheDocument()
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Quick Consult Ready' }))
    await Promise.resolve()

    expect(mockStartQuickConsultFromShell).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: /企业背景/ })).toBeInTheDocument()
  })

  it('clears a pending workflow launch when first-use dialog is dismissed without save or skip', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await screen.findByRole('dialog', { name: /企业背景/ })
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /企业背景/ })).not.toBeInTheDocument()
    )

    await user.click(
      await screen.findByRole('button', {
        name: '启动 Design Thinking（Improve onboarding）',
      })
    )
    await screen.findByRole('dialog', { name: /企业背景/ })
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /企业背景/ })).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: '企业背景设置' }))
    const settingsDialog = await screen.findByRole('dialog', { name: /企业背景设置/ })
    await user.type(within(settingsDialog).getByLabelText('企业名称'), '华数安全集团')
    await user.click(within(settingsDialog).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(mockSaveOrganizationContext).toHaveBeenCalled())
    expect(mockLaunchThinkTankWorkflow).not.toHaveBeenCalled()
  })
})
