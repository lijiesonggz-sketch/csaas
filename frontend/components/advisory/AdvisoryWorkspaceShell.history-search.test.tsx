import type { ReactElement, ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import { fetchThinkTankSessionHistory, searchThinkTankHistory } from '@/lib/advisory/history'
import { resumeThinkTankSession } from '@/lib/advisory/sessions'
import {
  fetchThinkTankSessionMessages,
  type ThinkTankWorkflowLaunchResult,
} from '@/lib/advisory/workflows'
import { fetchThinkTankWorkflowOutput } from '@/lib/advisory/outputs'

let mockSessionData: {
  user: {
    id: string
    email: string
    tenantId: string
    organizationId: string
  }
} | null = null

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: mockSessionData,
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
  },
}))

jest.mock('@/components/advisory/QuickConsultProblemIntake', () => ({
  QuickConsultProblemIntake: () => <div>Quick Consult Ready</div>,
}))

jest.mock('@/components/advisory/AdvisoryDocumentDrawer', () => ({
  AdvisoryDocumentDrawer: ({
    open,
    output,
  }: {
    open: boolean
    output?: { title?: string } | null
  }) => (
    <div aria-label="Mock document drawer">
      {open ? `Document drawer open: ${output?.title ?? 'No output'}` : 'Document drawer closed'}
    </div>
  ),
}))

jest.mock('@/components/ui/select', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const SelectItem = ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  )
  const SelectContent = ({ children }: { children: ReactNode }) => <>{children}</>
  const SelectTrigger = ({ children }: { children: ReactNode; 'aria-label'?: string }) => (
    <>{children}</>
  )
  const SelectValue = () => null
  const collectItems = (children: ReactNode): ReactElement[] => {
    const items: ReactElement[] = []
    React.Children.forEach(children, (child: ReactNode) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem) {
        items.push(child)
        return
      }
      items.push(...collectItems(child.props.children))
    })
    return items
  }
  const findTriggerLabel = (children: ReactNode): string | undefined => {
    let label: string | undefined
    React.Children.forEach(children, (child: ReactNode) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectTrigger) {
        label = child.props['aria-label']
      }
    })
    return label
  }
  const Select = ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <select
      aria-label={findTriggerLabel(children)}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {collectItems(children)}
    </select>
  )

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

jest.mock('@/lib/advisory/organization-context', () => ({
  fetchOrganizationContext: jest.fn().mockResolvedValue({
    id: 'context-1',
    organizationName: 'Tenant 1',
    industry: 'Data security',
    size: null,
    completenessScore: 67,
    completeness: {
      requiredFieldsComplete: true,
      missingFields: ['size'],
      updatedAt: '2026-05-21T00:00:00.000Z',
    },
    appliedToPrompts: false,
  }),
  saveOrganizationContext: jest.fn(),
  readOrganizationContextSkip: jest.fn(() => false),
  writeOrganizationContextSkip: jest.fn(),
  isOrganizationContextUsable: jest.fn(() => true),
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
      {
        key: 'problem-solving',
        displayName: 'Problem Solving',
        canonicalName: 'Problem Solving',
        scenarioLabel: 'Systematic diagnosis',
        sourcePath: 'workflow:problem-solving',
      },
    ],
  }),
  fetchThinkTankSessionMessages: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    currentStep: { index: 2, label: 'Map constraints', sourceRef: 'current-step:2' },
    messages: [
      {
        id: 'message-assistant-1',
        role: 'assistant',
        content: 'Key conclusion: setup guidance is missing.',
        workflowKey: 'problem-solving',
        stepIndex: 2,
        decisionOptions: [],
      },
    ],
  }),
  launchThinkTankWorkflow: jest.fn(),
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
  fetchThinkTankWorkflowOutput: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    output: {
      id: 'output-1',
      sessionId: 'session-1',
      workflowKey: 'problem-solving',
      status: 'completed',
      title: 'Retention Diagnosis',
      summary: 'Users drop after setup.',
      contentMarkdown: '# Retention Diagnosis',
      sections: [],
      aiLabelMetadata: { visible_label: '[AI Generated]' },
      metadata: {},
    },
  }),
}))

jest.mock('@/lib/advisory/sessions', () => ({
  THINKTANK_RESUME_SESSION_FAILED_MESSAGE: '暂时无法恢复该 ThinkTank 会话，请稍后重试。',
  THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE:
    '暂时无法加载未完成的 ThinkTank 会话，请稍后重试。',
  fetchThinkTankUnfinishedSessions: jest.fn().mockResolvedValue({ sessions: [] }),
  resumeThinkTankSession: jest.fn(),
  toWorkflowLaunchFromResume: jest.fn((result) => ({
    sessionId: result.session.sessionId,
    workflow: {
      key: result.session.workflowKey,
      displayName: result.session.workflowType,
      canonicalName: result.session.workflowType,
      scenarioLabel: result.session.statusSummary,
      sourcePath: `workflow:${result.session.workflowKey}`,
    },
    status: 'active',
    sourceRefs: [`workflow:${result.session.workflowKey}`],
    firstPrompt: `已恢复 ${result.session.workflowType} 会话。`,
    currentStep: result.session.lastStep,
  })),
}))

jest.mock('@/lib/advisory/history', () => ({
  THINKTANK_HISTORY_LOAD_FAILED_MESSAGE: '暂时无法加载 ThinkTank 历史记录，请稍后重试。',
  THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE: '暂时无法搜索 ThinkTank 历史记录，请稍后重试。',
  fetchThinkTankSessionHistory: jest.fn(),
  searchThinkTankHistory: jest.fn(),
}))

const mockFetchHistory = fetchThinkTankSessionHistory as jest.Mock
const mockSearchHistory = searchThinkTankHistory as jest.Mock
const mockResumeSession = resumeThinkTankSession as jest.Mock
const mockFetchMessages = fetchThinkTankSessionMessages as jest.Mock
const mockFetchOutput = fetchThinkTankWorkflowOutput as jest.Mock

function createHistoryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'output-1',
    resultType: 'output',
    sessionId: 'session-1',
    outputId: 'output-1',
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    status: 'completed',
    lastStep: { index: 2, label: 'Map constraints' },
    timestamp: '2026-05-21T01:08:00.000Z',
    openTarget: 'view-output',
    ...overrides,
  }
}

function createResumeResult() {
  return {
    session: {
      sessionId: 'session-active',
      workflowKey: 'problem-solving',
      workflowType: 'Problem Solving',
      title: 'Active Diagnosis',
      lastStep: { index: 2, label: 'Map constraints' },
      status: 'active',
      statusSummary: '未完成 - 可继续',
      lastActivityAt: '2026-05-21T01:06:00.000Z',
      checkpointSource: 'hot',
    },
    messages: [
      {
        id: 'message-active',
        role: 'assistant',
        content: 'Active session recovered.',
        decisionOptions: [],
      },
    ],
    output: null,
    checkpointSource: 'hot',
    recoveryMessage: {
      title: '已恢复未完成会话',
      content: '已恢复到 Map constraints。',
      lastStep: 'Map constraints',
      keyConclusions: [],
      actions: [
        { key: 'continue', label: '继续' },
        { key: 'review-document', label: '先查看文档' },
      ],
    },
    recoveredState: {
      lastStep: 'Map constraints',
      messageCount: 1,
      outputSectionCount: 0,
      recoveredFrom: 'checkpoint',
    },
    missingState: [],
  }
}

describe('AdvisoryWorkspaceShell history and search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionData = {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
    }
    mockFetchHistory.mockResolvedValue({
      items: [createHistoryItem()],
      meta: { page: 1, limit: 20, total: 1 },
    })
    mockSearchHistory.mockResolvedValue({
      items: [createHistoryItem()],
      meta: { page: 1, limit: 20, total: 1 },
    })
    mockResumeSession.mockResolvedValue(createResumeResult())
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
  })

  test('[P0][4.3-FE-010][AC1,AC2] renders history filters and searches prior output content', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await screen.findByRole('region', { name: '历史记录' })
    expect(
      within(historyRegion).getByRole('button', { name: /打开报告 Retention Diagnosis/ })
    ).toBeInTheDocument()
    expect(within(historyRegion).getAllByText('Problem Solving').length).toBeGreaterThan(0)
    expect(within(historyRegion).getByText('Users drop after setup.')).toBeInTheDocument()

    await user.selectOptions(within(historyRegion).getByLabelText('历史类型'), 'output')
    await user.selectOptions(within(historyRegion).getByLabelText('历史状态'), 'completed')
    await user.selectOptions(within(historyRegion).getByLabelText('历史工作流'), 'problem-solving')
    await user.type(within(historyRegion).getByRole('searchbox', { name: '搜索历史记录' }), 'setup')
    await user.click(within(historyRegion).getByRole('button', { name: '搜索历史' }))

    await waitFor(() =>
      expect(mockSearchHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: 'setup',
          type: 'output',
          status: 'completed',
          workflowKey: 'problem-solving',
        })
      )
    )
  })

  test('[P0][4.3-FE-011][AC2] opens report results by output id without losing active state', async () => {
    const user = userEvent.setup()
    mockFetchHistory.mockResolvedValueOnce({
      items: [
        createHistoryItem({
          id: 'session-active',
          resultType: 'session',
          sessionId: 'session-active',
          outputId: undefined,
          title: 'Active Diagnosis',
          summary: '未完成 - Map constraints',
          status: 'active',
          timestamp: '2026-05-21T01:09:00.000Z',
          openTarget: 'resume-session',
        }),
        createHistoryItem(),
      ],
      meta: { page: 1, limit: 20, total: 2 },
    })
    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await screen.findByRole('region', { name: '历史记录' })
    await user.click(
      within(historyRegion).getByRole('button', { name: /继续会话 Active Diagnosis/ })
    )
    expect(await screen.findByText('Active session recovered.')).toBeInTheDocument()

    await user.click(
      within(historyRegion).getByRole('button', { name: /打开报告 Retention Diagnosis/ })
    )

    await waitFor(() =>
      expect(mockFetchOutput).toHaveBeenCalledWith('session-1', { outputId: 'output-1' })
    )
    expect(mockFetchMessages).not.toHaveBeenCalledWith('session-1')
    expect(screen.getByText('Active session recovered.')).toBeInTheDocument()
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent(
      'Document drawer open: Retention Diagnosis'
    )
  })

  test('[P0][4.3-FE-012][AC2] uses the existing resume path for active session results', async () => {
    const user = userEvent.setup()
    mockFetchHistory.mockResolvedValueOnce({
      items: [
        createHistoryItem({
          id: 'session-active',
          resultType: 'session',
          sessionId: 'session-active',
          outputId: undefined,
          title: 'Active Diagnosis',
          summary: '未完成 - Map constraints',
          status: 'active',
          timestamp: '2026-05-21T01:06:00.000Z',
          openTarget: 'resume-session',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await screen.findByRole('region', { name: '历史记录' })
    const activeHistoryButton = within(historyRegion).getByRole('button', {
      name: /继续会话 Active Diagnosis/,
    })
    expect(within(activeHistoryButton).getByText('继续')).toBeInTheDocument()
    await user.click(activeHistoryButton)

    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledWith('session-active'))
    expect(await screen.findByText('Active session recovered.')).toBeInTheDocument()
  })

  test('[P0][4.3-FE-013][AC3] renders an accessible empty history state with first consult action', async () => {
    const user = userEvent.setup()
    mockFetchHistory.mockResolvedValueOnce({
      items: [],
      meta: { page: 1, limit: 20, total: 0 },
    })

    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await screen.findByRole('region', { name: '历史记录' })
    expect(within(historyRegion).getByText('暂无历史记录')).toBeInTheDocument()
    const startButton = within(historyRegion).getByRole('button', { name: '开始第一次咨询' })
    startButton.focus()
    expect(startButton).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Quick Consult' })).toHaveFocus()
    expect(screen.getByText('Quick Consult Ready')).toBeInTheDocument()
  })

  test('[P0][4.3-FE-014][AC1] clears stale history when signed-in identity changes', async () => {
    const { rerender } = render(<AdvisoryWorkspaceShell />)
    expect(
      await screen.findByRole('button', { name: /打开报告 Retention Diagnosis/ })
    ).toBeInTheDocument()

    mockFetchHistory.mockResolvedValueOnce({
      items: [
        createHistoryItem({
          id: 'output-tenant-2',
          sessionId: 'session-tenant-2',
          outputId: 'output-tenant-2',
          title: 'Tenant Two Report',
          workflowType: 'Design Thinking',
          workflowKey: 'design-thinking',
        }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
    mockSessionData = {
      user: {
        id: 'user-2',
        email: 'user2@example.com',
        tenantId: 'tenant-2',
        organizationId: 'org-2',
      },
    }

    rerender(<AdvisoryWorkspaceShell />)

    await waitFor(() => expect(mockFetchHistory).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByRole('button', { name: /打开报告 Tenant Two Report/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /打开报告 Retention Diagnosis/ })
    ).not.toBeInTheDocument()
  })
})

const _typeCheckLaunch: ThinkTankWorkflowLaunchResult | null = null
void _typeCheckLaunch
