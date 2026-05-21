import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import {
  fetchThinkTankUnfinishedSessions,
  resumeThinkTankSession,
} from '@/lib/advisory/sessions'
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
  downloadThinkTankSessionOutput: jest.fn(),
  fetchThinkTankWorkflowOutput: jest.fn().mockResolvedValue({ output: null }),
}))

jest.mock('@/lib/advisory/sessions', () => ({
  fetchThinkTankUnfinishedSessions: jest.fn().mockResolvedValue({
    sessions: [
      {
        sessionId: 'session-1',
        workflowKey: 'problem-solving',
        workflowType: 'Problem Solving',
        title: 'Retention Diagnosis',
        lastStep: { index: 2, label: 'Map constraints' },
        status: 'active',
        statusSummary: '未完成 - 可继续',
        lastActivityAt: '2026-05-21T01:06:00.000Z',
        checkpointSource: 'hot',
      },
    ],
  }),
  resumeThinkTankSession: jest.fn().mockResolvedValue({
    session: {
      sessionId: 'session-1',
      workflowKey: 'problem-solving',
      workflowType: 'Problem Solving',
      title: 'Retention Diagnosis',
      lastStep: { index: 2, label: 'Map constraints' },
      status: 'active',
      statusSummary: '未完成 - 可继续',
      lastActivityAt: '2026-05-21T01:06:00.000Z',
      checkpointSource: 'hot',
    },
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
  }),
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

const mockFetchUnfinished = fetchThinkTankUnfinishedSessions as jest.Mock
const mockResumeSession = resumeThinkTankSession as jest.Mock
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

function createResumeResult(overrides: Record<string, unknown> = {}) {
  const session =
    (overrides.session as ReturnType<typeof createUnfinishedSessionCard> | undefined) ??
    createUnfinishedSessionCard()

  return {
    session,
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
      sessionId: session.sessionId,
      workflowKey: session.workflowKey,
      status: 'draft',
      title: session.title,
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
    ...overrides,
  }
}

describe('AdvisoryWorkspaceShell resume interrupted sessions', () => {
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
    mockFetchUnfinished.mockResolvedValue({
      sessions: [createUnfinishedSessionCard()],
    })
    mockResumeSession.mockResolvedValue(createResumeResult())
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

  test('[P0][4.2-FE-007][AC1] prioritizes unfinished sessions in the sidebar before workflow catalog', async () => {
    render(<AdvisoryWorkspaceShell />)

    const resumeButton = await screen.findByRole('button', { name: /继续 Retention Diagnosis/ })
    const workflowButton = await screen.findByRole('button', {
      name: /启动 Design Thinking（Improve onboarding）/,
    })
    expect(resumeButton).toBeInTheDocument()
    expect(screen.getByText('Problem Solving')).toBeInTheDocument()
    expect(screen.getByText('Map constraints')).toBeInTheDocument()
    expect(screen.getByText('未完成 - 可继续')).toBeInTheDocument()
    expect(screen.getByText(/05\/21.*09:06/)).toBeInTheDocument()
    expect(
      resumeButton.compareDocumentPosition(workflowButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(mockFetchUnfinished).toHaveBeenCalledTimes(1)
  })

  test('[P0][4.2-FE-008][AC2] resumes a session, shows recovery message, and supports continue or document review', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))

    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledWith('session-1'))
    expect(await screen.findByText('已恢复未完成会话')).toBeInTheDocument()
    const recoverySummary = screen.getByRole('article', { name: 'ThinkTank 会话恢复摘要' })
    expect(within(recoverySummary).getByText(/Map constraints/)).toBeInTheDocument()
    expect(within(recoverySummary).getAllByText(/setup guidance is missing/).length).toBeGreaterThan(0)
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '先查看文档' }))
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent(
      'Document drawer open: Retention Diagnosis'
    )

    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(screen.getByRole('textbox', { name: '输入你的回答' })).toHaveFocus()
  })

  test('[P0][4.2-FE-009][AC1] clears recovered session state and reloads unfinished sessions when identity changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    expect(await screen.findByText('已恢复未完成会话')).toBeInTheDocument()
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()

    mockFetchUnfinished.mockResolvedValueOnce({
      sessions: [
        createUnfinishedSessionCard({
          sessionId: 'session-2',
          title: 'Tenant Two Diagnosis',
          workflowType: 'Innovation Strategy',
          workflowKey: 'innovation-strategy',
          lastStep: { index: 1, label: 'Map opportunity' },
        }),
      ],
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

    await waitFor(() => expect(mockFetchUnfinished).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: /继续 Tenant Two Diagnosis/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /继续 Retention Diagnosis/ })).not.toBeInTheDocument()
    expect(screen.queryByText('已恢复未完成会话')).not.toBeInTheDocument()
    expect(screen.queryByText('Key conclusion: setup guidance is missing.')).not.toBeInTheDocument()
  })

  test('[P0][4.2-FE-013][AC1,AC2] ignores stale resume results after the signed-in identity changes', async () => {
    const user = userEvent.setup()
    let resolveResume: (value: ReturnType<typeof createResumeResult>) => void = () => undefined
    mockResumeSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResume = resolve
        })
    )
    const { rerender } = render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))

    mockFetchUnfinished.mockResolvedValueOnce({
      sessions: [
        createUnfinishedSessionCard({
          sessionId: 'session-2',
          title: 'Tenant Two Diagnosis',
          workflowType: 'Innovation Strategy',
          workflowKey: 'innovation-strategy',
          lastStep: { index: 1, label: 'Map opportunity' },
        }),
      ],
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
    await act(async () => {
      resolveResume(createResumeResult())
    })

    await waitFor(() => expect(mockFetchUnfinished).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: /继续 Tenant Two Diagnosis/ })).toBeInTheDocument()
    expect(screen.queryByText('已恢复未完成会话')).not.toBeInTheDocument()
    expect(screen.queryByText('Key conclusion: setup guidance is missing.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /继续 Retention Diagnosis/ })).not.toBeInTheDocument()
  })

  test('[P0][4.2-FE-010][AC2] aborts an in-flight stream before resuming a session again', async () => {
    const user = userEvent.setup()
    let streamSignal: AbortSignal | undefined

    mockStreamMessage.mockImplementation(async function* (
      _sessionId: string,
      _payload: unknown,
      options?: { signal?: AbortSignal }
    ) {
      streamSignal = options?.signal
      yield { event: 'message.started', data: {} }
      await new Promise<void>((resolve) => {
        streamSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
      yield { event: 'message.delta', data: { delta: 'stale stream delta' } }
    })

    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    const textbox = await screen.findByRole('textbox', { name: '输入你的回答' })
    await user.type(textbox, 'Continue the analysis')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(mockStreamMessage).toHaveBeenCalledTimes(1))
    expect(streamSignal?.aborted).toBe(false)

    await user.click(screen.getByRole('button', { name: /继续 Retention Diagnosis/ }))

    await waitFor(() => expect(streamSignal?.aborted).toBe(true))
    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('stale stream delta')).not.toBeInTheDocument()
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()
  })
})
