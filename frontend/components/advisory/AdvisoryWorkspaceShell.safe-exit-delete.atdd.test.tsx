import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import * as sessionsClient from '@/lib/advisory/sessions'
import * as outputsClient from '@/lib/advisory/outputs'
import { streamThinkTankSessionMessage } from '@/lib/advisory/streaming'

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
    error: jest.fn(),
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

jest.mock('@/lib/advisory/organization-context', () => ({
  fetchOrganizationContext: jest.fn().mockResolvedValue(null),
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
    ],
  }),
  fetchThinkTankSessionMessages: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    currentStep: { index: 2, label: 'Map constraints', sourceRef: 'current-step:2' },
    messages: [],
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
  deleteThinkTankSessionOutput: jest.fn(),
  downloadThinkTankSessionOutput: jest.fn(),
  fetchThinkTankWorkflowOutput: jest.fn().mockResolvedValue({ output: null }),
}))

jest.mock('@/lib/advisory/sessions', () => ({
  deleteThinkTankSession: jest.fn(),
  fetchThinkTankUnfinishedSessions: jest.fn(),
  resumeThinkTankSession: jest.fn(),
  safeExitThinkTankSession: jest.fn(),
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
  fetchThinkTankSessionHistory: jest.fn().mockResolvedValue({
    items: [
      {
        id: 'session-1',
        resultType: 'session',
        sessionId: 'session-1',
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        title: 'Retention Diagnosis',
        summary: '未完成 - 可继续',
        status: 'active',
        timestamp: '2026-05-21T01:06:00.000Z',
        openTarget: 'resume-session',
      },
      {
        id: 'output-1',
        resultType: 'output',
        sessionId: 'session-1',
        outputId: 'output-1',
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        title: 'Retention Diagnosis',
        summary: 'Users drop after setup.',
        status: 'draft',
        timestamp: '2026-05-21T01:06:00.000Z',
        openTarget: 'view-output',
      },
    ],
    meta: { page: 1, limit: 20, total: 2 },
  }),
  searchThinkTankHistory: jest.fn(),
}))

const mockFetchUnfinished = sessionsClient.fetchThinkTankUnfinishedSessions as jest.Mock
const mockResumeSession = sessionsClient.resumeThinkTankSession as jest.Mock
const mockSafeExitSession = (sessionsClient as unknown as Record<string, jest.Mock>)
  .safeExitThinkTankSession
const mockDeleteSession = (sessionsClient as unknown as Record<string, jest.Mock>)
  .deleteThinkTankSession
const mockDeleteOutput = (outputsClient as unknown as Record<string, jest.Mock>)
  .deleteThinkTankSessionOutput
const mockStreamMessage = streamThinkTankSessionMessage as jest.Mock

function createUnfinishedSessionCard(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    title: 'Retention Diagnosis',
    lastStep: { index: 2, label: 'Map constraints' },
    status: 'active',
    statusSummary: '未完成 - 可继续',
    lastActivityAt: '2026-05-21T01:06:00.000Z',
    checkpointSource: 'hot',
    ...overrides,
  }
}

function createResumeResult() {
  return {
    session: createUnfinishedSessionCard(),
    messages: [
      {
        id: 'message-assistant-1',
        role: 'assistant',
        content: 'Key conclusion: setup guidance is missing.',
        sequence: 2,
        workflowKey: 'problem-solving',
        stepIndex: 2,
        decisionOptions: [{ key: 'continue', action: 'continue', label: '继续', enabled: true }],
      },
    ],
    output: {
      id: 'output-1',
      sessionId: 'session-1',
      workflowKey: 'problem-solving',
      status: 'draft',
      title: 'Retention Diagnosis',
      summary: 'Users drop after setup.',
      contentMarkdown: '# Retention Diagnosis',
      sections: [],
      aiLabelMetadata: { visible_label: '[AI Generated]' },
      metadata: {},
    },
    checkpointSource: 'hot',
    recoveryMessage: {
      title: '已恢复未完成会话',
      content: '已恢复到 Map constraints。Key conclusion: setup guidance is missing.',
      lastStep: 'Map constraints',
      keyConclusions: ['setup guidance is missing'],
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

describe('Story 4.7 ATDD RED - AdvisoryWorkspaceShell safe exit and destructive actions', () => {
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
    mockFetchUnfinished.mockResolvedValue({ sessions: [createUnfinishedSessionCard()] })
    mockResumeSession.mockResolvedValue(createResumeResult())
    mockSafeExitSession.mockResolvedValue({
      sessionId: 'session-1',
      status: 'paused',
      updatedAt: '2026-05-21T01:10:00.000Z',
    })
    mockDeleteSession.mockResolvedValue({
      sessionId: 'session-1',
      status: 'deleted',
      outputIds: ['output-1'],
      updatedAt: '2026-05-21T01:11:00.000Z',
    })
    mockDeleteOutput.mockResolvedValue({
      sessionId: 'session-1',
      outputId: 'output-1',
      status: 'deleted',
      updatedAt: '2026-05-21T01:12:00.000Z',
    })
    mockStreamMessage.mockImplementation(async function* () {
      yield {
        event: 'message.completed',
        data: {
          assistantMessage: {
            id: 'message-assistant-streamed',
            role: 'assistant',
            content: 'Streamed answer.',
            workflowKey: 'problem-solving',
            stepIndex: 2,
            decisionOptions: [],
          },
          decisionOptions: [],
          currentStep: { index: 3, label: 'Prioritize fixes' },
        },
      }
    })
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
  })

  test('[P0][4.7-FE-006][AC1] safe exit opens an accessible confirmation dialog with safe cancel focused before state changes', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.click(screen.getByRole('button', { name: /退出工作流|安全退出/ }))

    const dialog = await screen.findByRole('alertdialog', { name: /退出 ThinkTank 工作流/ })
    expect(within(dialog).getByText(/当前进度已自动保存/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /取消|继续编辑/ })).toHaveFocus()
    expect(mockSafeExitSession).not.toHaveBeenCalled()
  })

  test('[P0][4.7-FE-007][AC1,AC2] Escape, backdrop dismissal, and cancel preserve active session, draft, output, and list rows', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.click(screen.getByRole('button', { name: /退出工作流|安全退出/ }))
    await user.keyboard('{Escape}')

    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /继续 Retention Diagnosis/ })).toBeInTheDocument()
    expect(screen.getAllByText('Retention Diagnosis').length).toBeGreaterThan(0)
    expect(mockSafeExitSession).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /退出工作流|安全退出/ }))
    let dialog = await screen.findByRole('alertdialog', { name: /退出 ThinkTank 工作流/ })
    await user.click(within(dialog).getByRole('button', { name: /取消|继续编辑/ }))
    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: /退出 ThinkTank 工作流/ })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()
    expect(mockSafeExitSession).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /移除会话 Retention Diagnosis/ }))
    dialog = await screen.findByRole('alertdialog', { name: /删除 ThinkTank 会话/ })
    fireEvent.pointerDown(document.body)
    fireEvent.mouseDown(document.body)
    fireEvent.click(document.body)
    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: /删除 ThinkTank 会话/ })
      ).not.toBeInTheDocument()
    )
    expect(dialog).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /继续 Retention Diagnosis/ })).toBeInTheDocument()
    expect(mockDeleteSession).not.toHaveBeenCalled()
  })

  test('[P0][4.7-FE-008][AC1,AC3] confirming safe exit aborts in-flight stream and prevents stale updates from repopulating the workflow', async () => {
    const user = userEvent.setup()
    let streamSignal: AbortSignal | undefined
    mockStreamMessage.mockImplementation(async function* (
      _sessionId: string,
      _payload: unknown,
      options?: { signal?: AbortSignal }
    ) {
      streamSignal = options?.signal
      yield { event: 'message.started', data: {} }
      await new Promise<void>((resolve) => streamSignal?.addEventListener('abort', () => resolve()))
      yield { event: 'message.delta', data: { delta: 'stale stream delta' } }
    })

    render(<AdvisoryWorkspaceShell />)
    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.type(screen.getByRole('textbox', { name: '输入你的回答' }), 'Continue')
    await user.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(mockStreamMessage).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: /退出工作流|安全退出/ }))
    await user.click(screen.getByRole('button', { name: /确认退出|退出并保存/ }))

    await waitFor(() => expect(streamSignal?.aborted).toBe(true))
    expect(mockSafeExitSession).toHaveBeenCalledWith('session-1')
    expect(screen.queryByText('stale stream delta')).not.toBeInTheDocument()
    expect(screen.getByText('Quick Consult Ready')).toBeInTheDocument()
  })

  test('[P0][4.7-FE-009][AC2,AC3] confirming session delete removes the session and related output from visible workspace state', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.click(screen.getByRole('button', { name: /删除 Retention Diagnosis|移除会话/ }))
    const dialog = await screen.findByRole('alertdialog', { name: /删除 ThinkTank 会话/ })
    await user.click(within(dialog).getByRole('button', { name: /确认删除|删除会话/ }))

    await waitFor(() => expect(mockDeleteSession).toHaveBeenCalledWith('session-1'))
    expect(
      screen.queryByRole('button', { name: /继续 Retention Diagnosis/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Key conclusion: setup guidance is missing.')).not.toBeInTheDocument()
    expect(screen.getByText('Quick Consult Ready')).toBeInTheDocument()
  })

  test('[P0][4.7-FE-009][AC2,AC3] confirming output delete removes only the report row and drawer state', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.click(screen.getByRole('button', { name: /删除报告 Retention Diagnosis/ }))
    const dialog = await screen.findByRole('alertdialog', { name: /删除 ThinkTank 报告/ })
    await user.click(within(dialog).getByRole('button', { name: /删除报告/ }))

    await waitFor(() => expect(mockDeleteOutput).toHaveBeenCalledWith('session-1', 'output-1'))
    expect(
      screen.queryByRole('button', { name: /删除报告 Retention Diagnosis/ })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()
    expect(screen.getByText('Document drawer closed')).toBeInTheDocument()
  })

  test('[P1][4.7-FE-010][AC2,AC3] delete failures preserve all visible state and show recoverable guidance', async () => {
    const user = userEvent.setup()
    mockDeleteSession.mockRejectedValueOnce(new Error('暂时无法删除该会话，请稍后重试。'))
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.click(screen.getByRole('button', { name: /删除 Retention Diagnosis|移除会话/ }))
    await user.click(screen.getByRole('button', { name: /确认删除|删除会话/ }))

    expect(await screen.findByText(/暂时无法删除该会话/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /继续 Retention Diagnosis/, hidden: true })
    ).toBeInTheDocument()
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()
  })
})
