import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import {
  fetchThinkTankUnfinishedSessions,
  resumeThinkTankSession,
  safeExitThinkTankSession,
} from '@/lib/advisory/sessions'
import { fetchThinkTankSessionMessages, launchThinkTankWorkflow } from '@/lib/advisory/workflows'
import { streamThinkTankSessionMessage } from '@/lib/advisory/streaming'
import { fetchThinkTankWorkflowOutput } from '@/lib/advisory/outputs'
import { fetchThinkTankSessionHistory } from '@/lib/advisory/history'

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
  safeExitThinkTankSession: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    status: 'paused',
    updatedAt: '2026-05-21T01:08:00.000Z',
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

jest.mock('@/lib/advisory/history', () => ({
  THINKTANK_HISTORY_LOAD_FAILED_MESSAGE: '暂时无法加载 ThinkTank 历史记录，请稍后重试。',
  THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE: '暂时无法搜索 ThinkTank 历史记录，请稍后重试。',
  fetchThinkTankSessionHistory: jest
    .fn()
    .mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } }),
  searchThinkTankHistory: jest
    .fn()
    .mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } }),
}))

const mockFetchUnfinished = fetchThinkTankUnfinishedSessions as jest.Mock
const mockResumeSession = resumeThinkTankSession as jest.Mock
const mockSafeExitSession = safeExitThinkTankSession as jest.Mock
const mockLaunchWorkflow = launchThinkTankWorkflow as jest.Mock
const mockStreamMessage = streamThinkTankSessionMessage as jest.Mock
const mockFetchWorkflowOutput = fetchThinkTankWorkflowOutput as jest.Mock
const mockFetchSessionMessages = fetchThinkTankSessionMessages as jest.Mock
const mockFetchHistory = fetchThinkTankSessionHistory as jest.Mock

async function openSidebarTab(
  user: ReturnType<typeof userEvent.setup>,
  tabName: '工作' | '产物' | '新建'
) {
  const navigation = await screen.findByRole('navigation', { name: '咨询工作流' })
  await user.click(await within(navigation).findByRole('tab', { name: tabName }))
  return navigation
}

async function openAssetsRegion(user: ReturnType<typeof userEvent.setup>) {
  await openSidebarTab(user, '产物')
  return screen.findByRole('region', { name: '历史记录' })
}

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
    mockFetchHistory.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0 },
    })
    mockFetchSessionMessages.mockResolvedValue({
      sessionId: 'session-1',
      currentStep: { index: 2, label: 'Map constraints', sourceRef: 'current-step:2' },
      messages: [],
    })
    mockFetchWorkflowOutput.mockResolvedValue({ output: null })
    mockResumeSession.mockResolvedValue(createResumeResult())
    mockSafeExitSession.mockResolvedValue({
      sessionId: 'session-1',
      status: 'paused',
      updatedAt: '2026-05-21T01:08:00.000Z',
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

  test('[P0][4.2-FE-007][AC1] prioritizes unfinished sessions in the sidebar before workflow catalog', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    const resumeButton = await screen.findByRole('button', { name: /继续 Retention Diagnosis/ })
    expect(resumeButton).toBeInTheDocument()
    expect(screen.getByText('Problem Solving')).toBeInTheDocument()
    expect(screen.getByText('Map constraints')).toBeInTheDocument()
    expect(screen.getByText('未完成 - 可继续')).toBeInTheDocument()
    expect(screen.getByText(/05\/21.*09:06/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /启动 Design Thinking（Improve onboarding）/ })
    ).not.toBeInTheDocument()
    const workflowNavigation = await openSidebarTab(user, '新建')
    expect(
      await within(workflowNavigation).findByRole('button', {
        name: /启动 Design Thinking（Improve onboarding）/,
      })
    ).toBeInTheDocument()
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
    expect(
      within(recoverySummary).getAllByText(/setup guidance is missing/).length
    ).toBeGreaterThan(0)
    expect(screen.getByText('Key conclusion: setup guidance is missing.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '先查看文档' }))
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent(
      'Document drawer open: Retention Diagnosis'
    )

    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(screen.getByRole('textbox', { name: '输入你的回答' })).toHaveFocus()
  })

  test('[P0][4.2-FE-014][AC1] safe-exits the blocking active session before opening another unfinished session', async () => {
    const user = userEvent.setup()
    const activeSession = createUnfinishedSessionCard({
      sessionId: 'session-active',
      title: 'PRD Session',
      workflowKey: 'prd',
      workflowType: 'PRD',
      lastStep: { index: 2, label: 'Product Vision Discovery' },
      status: 'active',
    })
    const pausedSession = createUnfinishedSessionCard({
      sessionId: 'session-paused',
      title: 'Market Research Session',
      workflowKey: 'market-research',
      workflowType: 'Market Research',
      lastStep: { index: 6, label: 'Research Completion' },
      status: 'paused',
      statusSummary: '未完成 - Research Completion',
    })
    mockFetchUnfinished.mockResolvedValueOnce({
      sessions: [activeSession, pausedSession],
    })
    mockResumeSession.mockResolvedValueOnce(
      createResumeResult({
        session: {
          ...pausedSession,
          status: 'active',
          statusSummary: '未完成 - Research Completion',
        },
        messages: [
          {
            id: 'message-market-research',
            role: 'assistant',
            content: 'Market research recovered.',
            sequence: 2,
            workflowKey: 'market-research',
            stepIndex: 6,
            decisionOptions: [
              { key: 'continue', action: 'continue', label: '继续', enabled: true },
            ],
          },
        ],
        recoveryMessage: {
          title: '已恢复未完成会话',
          content: '已恢复到 Research Completion。Market research recovered.',
          lastStep: 'Research Completion',
          keyConclusions: ['Market research recovered.'],
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        },
      })
    )

    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /继续 Market Research Session/ }))

    await waitFor(() => expect(mockSafeExitSession).toHaveBeenCalledWith('session-active'))
    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledWith('session-paused'))
    expect(mockSafeExitSession.mock.invocationCallOrder[0]).toBeLessThan(
      mockResumeSession.mock.invocationCallOrder[0]
    )
    expect((await screen.findAllByText('Market research recovered.')).length).toBeGreaterThan(0)
    expect(screen.queryByText('已有活动 ThinkTank 会话')).not.toBeInTheDocument()
  })

  test('[P0] resumes an unfinished session directly after viewing a completed history session', async () => {
    const user = userEvent.setup()
    const pausedSession = createUnfinishedSessionCard({
      sessionId: 'session-design-thinking',
      title: 'Design Thinking Session',
      workflowKey: 'design-thinking',
      workflowType: 'Design Thinking',
      lastStep: { index: 7, label: 'Plan next iteration' },
      status: 'paused',
      statusSummary: '未完成 - Plan next iteration',
    })
    mockFetchUnfinished.mockResolvedValueOnce({
      sessions: [pausedSession],
    })
    mockFetchHistory.mockResolvedValueOnce({
      items: [
        {
          id: 'session-storytelling-completed',
          resultType: 'session',
          sessionId: 'session-storytelling-completed',
          workflowKey: 'storytelling',
          workflowType: 'Storytelling',
          title: 'Completed Storytelling Session',
          summary: '已完成 - Generate final output',
          status: 'completed',
          lastStep: { index: 10, label: 'Generate final output', isFinal: true },
          timestamp: '2026-05-21T01:10:00.000Z',
          openTarget: 'view-session',
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    })
    mockFetchSessionMessages.mockResolvedValueOnce({
      sessionId: 'session-storytelling-completed',
      currentStep: { index: 10, label: 'Generate final output', isFinal: true },
      messages: [
        {
          id: 'message-completed-story',
          role: 'assistant',
          content: 'Completed storytelling transcript is available.',
          sequence: 2,
          workflowKey: 'storytelling',
          stepIndex: 10,
          decisionOptions: [],
        },
      ],
    })
    mockSafeExitSession.mockRejectedValue(new Error('Not Found'))
    mockResumeSession.mockResolvedValue(
      createResumeResult({
        session: {
          ...pausedSession,
          status: 'active',
        },
        messages: [
          {
            id: 'message-design-thinking',
            role: 'assistant',
            content: 'Design thinking recovered.',
            sequence: 2,
            workflowKey: 'design-thinking',
            stepIndex: 7,
            decisionOptions: [
              { key: 'continue', action: 'continue', label: '继续', enabled: true },
            ],
          },
        ],
        recoveryMessage: {
          title: '已恢复未完成会话',
          content: '已恢复到 Plan next iteration。Design thinking recovered.',
          lastStep: 'Plan next iteration',
          keyConclusions: ['Design thinking recovered.'],
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        },
      })
    )

    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await openAssetsRegion(user)
    await user.click(
      within(historyRegion).getByRole('button', {
        name: /打开会话 Completed Storytelling Session/,
      })
    )
    expect(
      await screen.findByText('Completed storytelling transcript is available.')
    ).toBeInTheDocument()

    await openSidebarTab(user, '工作')
    await user.click(await screen.findByRole('button', { name: /继续 Design Thinking Session/ }))

    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledWith('session-design-thinking'))
    expect(mockSafeExitSession).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Design Thinking' })).toBeInTheDocument()
    expect(screen.getAllByText('Design thinking recovered.').length).toBeGreaterThan(0)
  })

  test('[P0] resumes the selected unfinished session when the locally active session is already gone server-side', async () => {
    const user = userEvent.setup()
    const pausedSession = createUnfinishedSessionCard({
      sessionId: 'session-market',
      title: 'Market Research Session',
      workflowKey: 'market-research',
      workflowType: 'Market Research',
      lastStep: { index: 6, label: 'Research Completion' },
      status: 'paused',
      statusSummary: '未完成 - Research Completion',
    })
    mockFetchUnfinished.mockResolvedValueOnce({
      sessions: [pausedSession],
    })
    mockLaunchWorkflow.mockResolvedValueOnce({
      sessionId: 'session-product-brief',
      workflow: {
        key: 'product-brief',
        displayName: 'Product Brief',
        canonicalName: 'Product Brief',
        scenarioLabel: 'Product opportunity framing',
        sourcePath: 'workflow:product-brief',
      },
      status: 'active',
      sourceRefs: ['workflow:product-brief'],
      firstPrompt: 'Product Brief workflow started.',
      currentStep: { index: 6, label: 'Step 6: Product Brief Completion' },
    })
    mockSafeExitSession.mockRejectedValueOnce(new Error('ThinkTank session not found'))
    mockResumeSession.mockResolvedValueOnce(
      createResumeResult({
        session: {
          ...pausedSession,
          status: 'active',
        },
        messages: [
          {
            id: 'message-market-research',
            role: 'assistant',
            content: 'Market research recovered.',
            sequence: 2,
            workflowKey: 'market-research',
            stepIndex: 6,
            decisionOptions: [
              { key: 'continue', action: 'continue', label: '继续', enabled: true },
            ],
          },
        ],
        recoveryMessage: {
          title: '已恢复未完成会话',
          content: '已恢复到 Research Completion。Market research recovered.',
          lastStep: 'Research Completion',
          keyConclusions: ['Market research recovered.'],
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        },
      })
    )

    render(<AdvisoryWorkspaceShell />)

    const workflowNavigation = await openSidebarTab(user, '新建')
    await user.click(
      await within(workflowNavigation).findByRole('button', { name: /启动 Design Thinking/ })
    )
    expect(await screen.findByRole('heading', { name: 'Product Brief' })).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /继续 Market Research Session/ }))

    await waitFor(() => expect(mockSafeExitSession).toHaveBeenCalledWith('session-product-brief'))
    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledWith('session-market'))
    expect(await screen.findByRole('heading', { name: 'Market Research' })).toBeInTheDocument()
    expect(screen.getAllByText('Market research recovered.').length).toBeGreaterThan(0)
    expect(screen.queryByText('Product Brief workflow started.')).not.toBeInTheDocument()
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
    expect(
      await screen.findByRole('button', { name: /继续 Tenant Two Diagnosis/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /继续 Retention Diagnosis/ })
    ).not.toBeInTheDocument()
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
    expect(
      await screen.findByRole('button', { name: /继续 Tenant Two Diagnosis/ })
    ).toBeInTheDocument()
    expect(screen.queryByText('已恢复未完成会话')).not.toBeInTheDocument()
    expect(screen.queryByText('Key conclusion: setup guidance is missing.')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /继续 Retention Diagnosis/ })
    ).not.toBeInTheDocument()
  })

  test('[P0][4.2-FE-010][AC2] aborts an in-flight stream before resuming a session again', async () => {
    const user = userEvent.setup()
    let streamSignal: AbortSignal | undefined
    const nextSession = createUnfinishedSessionCard({
      sessionId: 'session-2',
      title: 'Pricing Diagnosis',
      workflowKey: 'pricing',
      workflowType: 'Pricing',
      lastStep: { index: 4, label: 'Model tradeoffs' },
      status: 'paused',
      statusSummary: '未完成 - Model tradeoffs',
    })
    mockFetchUnfinished.mockResolvedValueOnce({
      sessions: [createUnfinishedSessionCard(), nextSession],
    })
    mockResumeSession.mockResolvedValueOnce(createResumeResult()).mockResolvedValueOnce(
      createResumeResult({
        session: {
          ...nextSession,
          status: 'active',
        },
        messages: [
          {
            id: 'message-pricing',
            role: 'assistant',
            content: 'Pricing recovered.',
            sequence: 2,
            workflowKey: 'pricing',
            stepIndex: 4,
            decisionOptions: [
              { key: 'continue', action: 'continue', label: '继续', enabled: true },
            ],
          },
        ],
        recoveryMessage: {
          title: '已恢复未完成会话',
          content: '已恢复到 Model tradeoffs。Pricing recovered.',
          lastStep: 'Model tradeoffs',
          keyConclusions: ['Pricing recovered.'],
          actions: [
            { key: 'continue', label: '继续' },
            { key: 'review-document', label: '先查看文档' },
          ],
        },
      })
    )

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

    await user.click(await screen.findByRole('button', { name: /继续 Pricing Diagnosis/ }))

    await waitFor(() => expect(streamSignal?.aborted).toBe(true))
    await waitFor(() => expect(mockResumeSession).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('stale stream delta')).not.toBeInTheDocument()
    expect(screen.getAllByText('Pricing recovered.').length).toBeGreaterThan(0)
  })

  test('[P0][5.3-FE-006][AC2] removes completed Party Mode advisor messages when the same stream fails later', async () => {
    const user = userEvent.setup()
    mockStreamMessage.mockImplementation(async function* () {
      yield { event: 'message.started', data: {} }
      yield {
        event: 'party_mode.current_speaker',
        data: {
          sessionId: 'session-1',
          round: 1,
          speakerIndex: 1,
          advisorId: 'security-architect',
          advisorName: '张岚',
          advisorRole: '安全架构师',
        },
      }
      yield { event: 'message.delta', data: { index: 0, delta: '第一位专家已完成但应回滚' } }
      yield {
        event: 'message.completed',
        data: {
          assistantMessage: {
            id: 'advisor-message-1',
            role: 'assistant',
            content: '第一位专家已完成但应回滚',
            workflowKey: 'problem-solving',
            stepIndex: 2,
            metadata: {
              party_mode_message: true,
              party_mode_round: 1,
              party_mode_speaker_index: 1,
              party_mode_advisor_id: 'security-architect',
              party_mode_advisor_name: '张岚',
              party_mode_advisor_role: '安全架构师',
            },
          },
          decisionOptions: [],
          partyModeTurnComplete: false,
        },
      }
      yield {
        event: 'party_mode.current_speaker',
        data: {
          sessionId: 'session-1',
          round: 1,
          speakerIndex: 2,
          advisorId: 'ops-advisor',
          advisorName: '陈晨',
          advisorRole: '运维负责人',
        },
      }
      yield { event: 'message.delta', data: { index: 0, delta: '第二位专家的半截回复' } }
      yield {
        event: 'message.error',
        data: {
          code: 'THINKTANK_PARTY_MODE_STREAM_FAILED',
          message: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
          retryable: true,
        },
      }
    })

    render(<AdvisoryWorkspaceShell />)
    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    const textbox = await screen.findByRole('textbox', { name: '输入你的回答' })
    await user.type(textbox, 'Continue Party Mode')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(
      (await screen.findAllByText('暂时无法生成 ThinkTank 顾问回复，请稍后重试。')).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText('第一位专家已完成但应回滚')).not.toBeInTheDocument()
    expect(screen.queryByText('第二位专家的半截回复')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '输入你的回答' })).toHaveValue('Continue Party Mode')
  })

  test('[P0][5.4-FE-002][AC3] accepts Party Mode integration and refreshes the live report draft', async () => {
    const user = userEvent.setup()
    mockResumeSession.mockResolvedValueOnce(
      createResumeResult({
        messages: [
          {
            id: 'message-integration-1',
            role: 'assistant',
            content: 'Consensus: onboarding is the primary blocker.',
            sequence: 5,
            workflowKey: 'problem-solving',
            stepIndex: 2,
            metadata: {
              ai_generated: true,
              party_mode_integration: true,
              party_mode_integration_status: 'draft',
              ai_label_visible: '[AI Generated]',
            },
            decisionOptions: [
              {
                key: 'accept-party-mode-conclusion',
                action: 'accept-party-mode-conclusion',
                label: '接受整合结论',
                enabled: true,
              },
            ],
          },
        ],
      })
    )
    mockStreamMessage.mockImplementationOnce(async function* () {
      yield {
        event: 'message.completed',
        data: {
          assistantMessage: {
            id: 'message-returned',
            role: 'assistant',
            content: '已返回原工作流。',
            workflowKey: 'problem-solving',
            stepIndex: 2,
            decisionOptions: [
              { key: 'continue', action: 'continue', label: '继续', enabled: true },
            ],
            metadata: {
              ai_generated: true,
              party_mode_returned: true,
              party_mode_integrated_conclusion_accepted: true,
            },
          },
          decisionOptions: [{ key: 'continue', action: 'continue', label: '继续', enabled: true }],
          currentStep: { index: 2, label: 'Map constraints' },
        },
      }
    })
    mockFetchWorkflowOutput.mockResolvedValueOnce({
      output: {
        id: 'output-1',
        sessionId: 'session-1',
        workflowKey: 'problem-solving',
        status: 'draft',
        title: 'Retention Diagnosis',
        summary: 'Users drop after setup.',
        contentMarkdown:
          '# Retention Diagnosis\n\n## Map constraints - Party Mode 整合结论\n\n[AI Generated]\n\nConsensus: onboarding is the primary blocker.',
        sections: [
          {
            id: 'section-1',
            stepIndex: 2,
            heading: 'Map constraints - Party Mode 整合结论',
            contentMarkdown: '[AI Generated]\n\nConsensus: onboarding is the primary blocker.',
            aiLabel: '[AI Generated]',
            metadata: { ai_generated: true, source_message_id: 'message-integration-1' },
          },
        ],
        aiLabelMetadata: { visible_label: '[AI Generated]' },
        metadata: { section_count: 1 },
      },
    })

    render(<AdvisoryWorkspaceShell />)
    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))
    await user.click(await screen.findByRole('button', { name: /接受整合结论/ }))

    await waitFor(() =>
      expect(mockStreamMessage).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          content: '接受整合结论',
          decisionAction: 'accept-party-mode-conclusion',
          decisionSourceMessageId: 'message-integration-1',
        }),
        expect.any(Object)
      )
    )
    await waitFor(() => expect(mockFetchWorkflowOutput).toHaveBeenCalledWith('session-1'))
    expect(
      screen.getByRole('status', { name: 'ThinkTank step completion status' })
    ).toHaveTextContent('Party Mode 整合结论已写入报告草稿。')
  })

  test('[P0][5.5-FE-002][AC2,AC3] preserves prior Party Mode work and submits retry, continue, and return controls from latest failure message', async () => {
    const user = userEvent.setup()
    mockResumeSession.mockResolvedValueOnce(
      createResumeResult({
        messages: [
          {
            id: 'advisor-message-1',
            role: 'assistant',
            content: '第一位专家已完成，应在后续失败后保留。',
            sequence: 3,
            workflowKey: 'problem-solving',
            stepIndex: 2,
            metadata: {
              party_mode_message: true,
              party_mode_round: 1,
              party_mode_speaker_index: 1,
              party_mode_advisor_id: 'security-architect',
              party_mode_advisor_name: '张岚',
              party_mode_advisor_role: '安全架构师',
            },
          },
          {
            id: 'party-failure-message-1',
            role: 'assistant',
            content: '陈晨本轮超时，已保留前面专家结论。',
            sequence: 4,
            workflowKey: 'problem-solving',
            stepIndex: 2,
            metadata: {
              party_mode_message: true,
              party_mode_failure: true,
              party_mode_round: 1,
              party_mode_failed_advisor_id: 'ops-advisor',
              party_mode_failed_advisor_name: '陈晨',
              party_mode_failed_advisor_role: '运维负责人',
              party_mode_failure_category: 'timeout',
              party_mode_failure_retryable: true,
              party_mode_budget_remaining_tokens: 2400,
              party_mode_budget_max_tokens: 8000,
            },
            decisionOptions: [
              {
                key: 'retry-party-mode-advisor',
                action: 'retry-party-mode-advisor',
                label: '重试陈晨',
                enabled: true,
              },
              {
                key: 'continue-party-mode',
                action: 'continue-party-mode',
                label: '继续讨论',
                enabled: true,
              },
              {
                key: 'return-to-workflow',
                action: 'return-to-workflow',
                label: '返回原工作流',
                enabled: true,
              },
            ],
          },
        ],
      })
    )
    mockStreamMessage.mockImplementation(async function* (
      _sessionId: string,
      payload: { decisionAction?: string }
    ) {
      yield {
        event: 'message.completed',
        data: {
          assistantMessage: {
            id: `response-${payload.decisionAction}`,
            role: 'assistant',
            content: `handled ${payload.decisionAction}`,
            workflowKey: 'problem-solving',
            stepIndex: 2,
            decisionOptions: [],
          },
          decisionOptions: [],
          currentStep: { index: 2, label: 'Map constraints' },
        },
      }
    })

    render(<AdvisoryWorkspaceShell />)
    await user.click(await screen.findByRole('button', { name: /继续 Retention Diagnosis/ }))

    expect(await screen.findByText('第一位专家已完成，应在后续失败后保留。')).toBeInTheDocument()
    expect(screen.getByText('陈晨本轮超时，已保留前面专家结论。')).toBeInTheDocument()
    expect(screen.getByText(/剩余.*2400.*8000/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /重试陈晨/ }))
    await waitFor(() =>
      expect(mockStreamMessage).toHaveBeenLastCalledWith(
        'session-1',
        expect.objectContaining({
          content: '重试陈晨',
          decisionAction: 'retry-party-mode-advisor',
          decisionSourceMessageId: 'party-failure-message-1',
        }),
        expect.any(Object)
      )
    )
    expect(screen.getByText('第一位专家已完成，应在后续失败后保留。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /继续讨论/ }))
    await waitFor(() =>
      expect(mockStreamMessage).toHaveBeenLastCalledWith(
        'session-1',
        expect.objectContaining({
          content: '继续讨论',
          decisionAction: 'continue-party-mode',
          decisionSourceMessageId: 'party-failure-message-1',
        }),
        expect.any(Object)
      )
    )

    await user.click(screen.getByRole('button', { name: /返回原工作流/ }))
    await waitFor(() =>
      expect(mockStreamMessage).toHaveBeenLastCalledWith(
        'session-1',
        expect.objectContaining({
          content: '返回原工作流',
          decisionAction: 'return-to-workflow',
          decisionSourceMessageId: 'party-failure-message-1',
        }),
        expect.any(Object)
      )
    )
  })
})
