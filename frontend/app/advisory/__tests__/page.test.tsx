import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useSession } from 'next-auth/react'
import AdvisoryLayout from '../layout'
import AdvisoryPage from '../page'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import {
  fetchThinkTankManualBrowseCatalog,
  fetchThinkTankWorkflows,
  fetchThinkTankSessionMessages,
  launchThinkTankWorkflow,
  sendThinkTankSessionMessage,
} from '@/lib/advisory/workflows'
import {
  readQuickConsultDraft,
  saveQuickConsultDraft,
  startQuickConsult,
  submitQuickConsultRecommendationFeedback,
} from '@/lib/advisory/quick-consult'
import { streamThinkTankSessionMessage } from '@/lib/advisory/streaming'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

expect.extend(toHaveNoViolations)

jest.mock('@/lib/advisory/access', () => ({
  canAccessThinkTank: jest.fn(() => true),
  fetchThinkTankAccess: jest.fn(),
  THINKTANK_ACCESS_DENIED_MESSAGE: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}))

jest.mock('@/lib/advisory/workflows', () => ({
  THINKTANK_EMPTY_MESSAGE_MESSAGE: '请输入你的回答后再提交。',
  THINKTANK_MESSAGE_MAX_LENGTH: 5000,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
  THINKTANK_MESSAGE_TOO_LONG_MESSAGE: '内容过长，请精简到 5000 字符以内。',
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE:
    '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。',
  fetchThinkTankWorkflows: jest.fn(),
  fetchThinkTankManualBrowseCatalog: jest.fn(),
  fetchThinkTankSessionMessages: jest.fn(),
  launchThinkTankWorkflow: jest.fn(),
  sendThinkTankSessionMessage: jest.fn(),
}))

jest.mock('@/lib/advisory/streaming', () => ({
  THINKTANK_STREAM_ERROR_MESSAGE: 'ThinkTank streaming response was malformed. Please retry.',
  streamThinkTankSessionMessage: jest.fn(),
}))

jest.mock('@/lib/advisory/quick-consult', () => ({
  QUICK_CONSULT_PROBLEM_MAX_LENGTH: 5000,
  QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE: '请先描述你要咨询的问题。',
  QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE: '问题描述过长，请精简到 5000 字以内。',
  QUICK_CONSULT_START_FAILED_MESSAGE: '暂时无法启动 Quick Consult，请稍后重试。',
  readQuickConsultDraft: jest.fn(),
  saveQuickConsultDraft: jest.fn(),
  startQuickConsult: jest.fn(),
  submitQuickConsultRecommendationFeedback: jest.fn(),
}))

const mockToastSuccess = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

/*
 * Story 2.8 ATDD RED additions for frontend/app/advisory/__tests__/page.test.tsx.
 * Place the mock block with the other top-level advisory mocks, then place the
 * describe block inside the existing describe('AdvisoryPage', () => { ... }) so it can
 * reuse renderAdvisoryRoute(), workflowCatalog, createControlledStream(), and the
 * existing mocked workflow/access variables.
 */

const mockFetchThinkTankWorkflowOutput = jest.fn()
const mockAppendThinkTankWorkflowOutputSection = jest.fn()
const mockCompleteThinkTankSessionOutput = jest.fn()
const mockDownloadThinkTankSessionOutput = jest.fn()
const mockRateThinkTankSessionOutput = jest.fn()
const mockUpdateThinkTankOutputFavorite = jest.fn()
const mockAssociateThinkTankOutputWithKnowledgeBase = jest.fn()

jest.mock(
  '@/lib/advisory/outputs',
  () => ({
    THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE: '暂时无法更新报告草稿，请稍后重试。',
    THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE:
      '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。',
    fetchThinkTankWorkflowOutput: (...args: unknown[]) => mockFetchThinkTankWorkflowOutput(...args),
    appendThinkTankWorkflowOutputSection: (...args: unknown[]) =>
      mockAppendThinkTankWorkflowOutputSection(...args),
    completeThinkTankSessionOutput: (...args: unknown[]) =>
      mockCompleteThinkTankSessionOutput(...args),
    downloadThinkTankSessionOutput: (...args: unknown[]) =>
      mockDownloadThinkTankSessionOutput(...args),
    rateThinkTankSessionOutput: (...args: unknown[]) => mockRateThinkTankSessionOutput(...args),
    updateThinkTankOutputFavorite: (...args: unknown[]) =>
      mockUpdateThinkTankOutputFavorite(...args),
    associateThinkTankOutputWithKnowledgeBase: (...args: unknown[]) =>
      mockAssociateThinkTankOutputWithKnowledgeBase(...args),
  }),
  { virtual: true }
)

jest.mock('@/lib/advisory/history', () => ({
  THINKTANK_HISTORY_LOAD_FAILED_MESSAGE: '暂时无法加载 ThinkTank 历史记录，请稍后重试。',
  THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE: '暂时无法搜索 ThinkTank 历史记录，请稍后重试。',
  fetchThinkTankSessionHistory: jest.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 20, total: 0 },
  }),
  searchThinkTankHistory: jest.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 20, total: 0 },
  }),
}))

jest.mock('@/lib/advisory/sessions', () => ({
  THINKTANK_RESUME_SESSION_FAILED_MESSAGE: '暂时无法恢复该 ThinkTank 会话，请稍后重试。',
  THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE:
    '暂时无法加载未完成的 ThinkTank 会话，请稍后重试。',
  fetchThinkTankUnfinishedSessions: jest.fn().mockResolvedValue({ sessions: [] }),
  resumeThinkTankSession: jest.fn(),
  toWorkflowLaunchFromResume: jest.fn(),
}))

jest.mock('@/lib/advisory/organization-context', () => ({
  ORGANIZATION_CONTEXT_LOAD_FAILED_MESSAGE: '暂时无法加载企业背景，请稍后重试。',
  ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE: '暂时无法保存企业背景，请稍后重试。',
  fetchOrganizationContext: jest.fn().mockResolvedValue(null),
  saveOrganizationContext: jest.fn(),
  readOrganizationContextSkip: jest.fn(() => true),
  writeOrganizationContextSkip: jest.fn(),
  isOrganizationContextUsable: jest.fn(() => false),
}))

type Story28PageOutputSection = {
  id: string
  stepIndex: number
  heading: string
  contentMarkdown: string
  aiLabel: '[AI Generated]'
  metadata: {
    workflowKey: string
    stepLabel: string
    provider: string
    model: string
    generatedAt: string
  }
  createdAt: string
}

function createStory28PageSection(
  overrides: Partial<Story28PageOutputSection> = {}
): Story28PageOutputSection {
  return {
    id: 'section-opportunity',
    stepIndex: 1,
    heading: '1. 机会梳理',
    contentMarkdown: '企业客户预算触发点来自合规整改窗口。',
    aiLabel: '[AI Generated]',
    metadata: {
      workflowKey: 'brainstorming',
      stepLabel: '机会梳理',
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: '2026-05-20T07:44:42+08:00',
    },
    createdAt: '2026-05-20T07:44:42+08:00',
    ...overrides,
  }
}

function createStory28PageOutput(sections: Story28PageOutputSection[] = []) {
  const lastSection = sections[sections.length - 1] ?? createStory28PageSection()

  return {
    id: 'output-brainstorming',
    sessionId: 'session-brainstorming',
    workflowKey: 'brainstorming',
    status: 'draft',
    title: 'Brainstorming 决策报告草稿',
    summary: '已生成阶段性决策草稿。',
    contentMarkdown: sections.map((section) => section.contentMarkdown).join('\n\n'),
    sections,
    aiLabelMetadata: {
      label: 'AI Generated',
      visibleLabel: '[AI Generated]',
      generator: 'ThinkTank',
      provider: lastSection.metadata.provider,
      model: lastSection.metadata.model,
      generatedAt: lastSection.metadata.generatedAt,
      workflowKey: lastSection.metadata.workflowKey,
      sessionId: 'session-brainstorming',
    },
    metadata: {
      sectionCount: sections.length,
      lastStepIndex: lastSection.stepIndex,
    },
  }
}

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/advisory',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/hooks/useRadarUnreadCount', () => ({
  useRadarUnreadCount: jest.fn(),
}))

function renderAdvisoryRoute() {
  return render(
    <AdvisoryLayout>
      <AdvisoryPage />
    </AdvisoryLayout>
  )
}

function createControlledStream() {
  const queue: Array<
    | {
        done: false
        value: Awaited<ReturnType<typeof streamThinkTankSessionMessage>> extends AsyncIterable<
          infer T
        >
          ? T
          : never
      }
    | { done: true }
  > = []
  const waiters: Array<() => void> = []

  const notify = () => {
    waiters.shift()?.()
  }

  return {
    async *iterator() {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => waiters.push(resolve))
        }
        const item = queue.shift()
        if (!item) continue
        if (item.done) return
        yield item.value
      }
    },
    push(
      value: Awaited<ReturnType<typeof streamThinkTankSessionMessage>> extends AsyncIterable<
        infer T
      >
        ? T
        : never
    ) {
      queue.push({ done: false, value })
      notify()
    },
    close() {
      queue.push({ done: true })
      notify()
    },
  }
}

describe('AdvisoryPage', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockFetchThinkTankWorkflows = fetchThinkTankWorkflows as jest.MockedFunction<
    typeof fetchThinkTankWorkflows
  >
  const mockFetchThinkTankManualBrowseCatalog =
    fetchThinkTankManualBrowseCatalog as jest.MockedFunction<
      typeof fetchThinkTankManualBrowseCatalog
    >
  const mockFetchThinkTankSessionMessages = fetchThinkTankSessionMessages as jest.MockedFunction<
    typeof fetchThinkTankSessionMessages
  >
  const mockLaunchThinkTankWorkflow = launchThinkTankWorkflow as jest.MockedFunction<
    typeof launchThinkTankWorkflow
  >
  const mockSendThinkTankSessionMessage = sendThinkTankSessionMessage as jest.MockedFunction<
    typeof sendThinkTankSessionMessage
  >
  const mockStreamThinkTankSessionMessage = streamThinkTankSessionMessage as jest.MockedFunction<
    typeof streamThinkTankSessionMessage
  >
  const mockReadQuickConsultDraft = readQuickConsultDraft as jest.MockedFunction<
    typeof readQuickConsultDraft
  >
  const mockSaveQuickConsultDraft = saveQuickConsultDraft as jest.MockedFunction<
    typeof saveQuickConsultDraft
  >
  const mockStartQuickConsult = startQuickConsult as jest.MockedFunction<typeof startQuickConsult>
  const mockSubmitQuickConsultRecommendationFeedback =
    submitQuickConsultRecommendationFeedback as jest.MockedFunction<
      typeof submitQuickConsultRecommendationFeedback
    >
  const mockUseSession = useSession as jest.Mock
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.MockedFunction<
    typeof useRadarUnreadCount
  >

  const workflowCatalog = [
    ['brainstorming', 'Brainstorming', 'Creative ideation and divergent thinking'],
    ['domain-research', 'Domain Research', 'Domain and industry research'],
    ['market-research', 'Market Research', 'Market, competitor, and customer research'],
    ['product-brief', 'Product Brief', 'Product opportunity framing'],
    ['prd', 'PRD', 'Product requirements definition'],
    ['problem-solving', 'Problem Solving', 'Systematic diagnosis and solution design'],
    ['design-thinking', 'Design Thinking', 'Human-centered discovery and solution framing'],
    ['storytelling', 'Storytelling', 'Narrative framing and communication'],
  ].map(([key, displayName, scenarioLabel]) => ({
    key,
    displayName,
    canonicalName: displayName,
    scenarioLabel,
    description: `${displayName} workflow`,
    sourcePath: `_bmad/runtime/${key}/workflow.md`,
  }))

  const installMatchMedia = (viewport: boolean | number) => {
    let viewportWidth = typeof viewport === 'number' ? viewport : viewport ? 1440 : 900
    const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()
    const getListeners = (query: string) => {
      if (!listeners.has(query)) {
        listeners.set(query, new Set())
      }
      return listeners.get(query)!
    }
    const readMatches = (query: string) => {
      const minWidth = query.match(/\(min-width:\s*(\d+)px\)/)
      if (minWidth) return viewportWidth >= Number(minWidth[1])
      const maxWidth = query.match(/\(max-width:\s*(\d+)px\)/)
      if (maxWidth) return viewportWidth <= Number(maxWidth[1])
      return false
    }
    const emitAll = () => {
      listeners.forEach((queryListeners, query) => {
        const matches = readMatches(query)
        queryListeners.forEach((listener) => {
          listener({ matches, media: query } as MediaQueryListEvent)
        })
      })
    }

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      get matches() {
        return readMatches(query)
      },
      media: query,
      onchange: null,
      addListener: jest.fn((listener: (event: MediaQueryListEvent) => void) => {
        getListeners(query).add(listener)
      }),
      removeListener: jest.fn((listener: (event: MediaQueryListEvent) => void) => {
        getListeners(query).delete(listener)
      }),
      addEventListener: jest.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') getListeners(query).add(listener)
      }),
      removeEventListener: jest.fn(
        (event: string, listener: (event: MediaQueryListEvent) => void) => {
          if (event === 'change') getListeners(query).delete(listener)
        }
      ),
      dispatchEvent: jest.fn(),
    }))

    return {
      setDesktop(next: boolean) {
        this.setWidth(next ? 1440 : 900)
      },
      setWidth(next: number) {
        viewportWidth = next
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: next,
        })
        emitAll()
      },
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    let quickConsultDraft = ''
    mockReadQuickConsultDraft.mockImplementation(() => quickConsultDraft)
    mockSaveQuickConsultDraft.mockImplementation(({ problem }) => {
      quickConsultDraft = problem
    })
    mockStartQuickConsult.mockReset()
    mockSubmitQuickConsultRecommendationFeedback.mockReset()
    mockSubmitQuickConsultRecommendationFeedback.mockResolvedValue({
      id: 'recommendation-feedback-35',
      quickConsultContextId: 'quick-consult-feedback-context-35',
      rating: 5,
    })
    mockStartQuickConsult.mockResolvedValue({
      contextId: 'quick-consult-1',
      consultId: 'quick-consult-1',
      status: 'clarification_required',
      originalProblem: 'We need AI strategy help.',
      clarificationQuestions: ['What business outcome matters most?'],
      providerStatus: 'fake',
      operationalStatus: 'Provider connected. Clarification is ready.',
    })
    mockPush.mockReset()
    mockFetchThinkTankWorkflowOutput.mockResolvedValue({
      output: createStory28PageOutput([]),
    })
    mockAppendThinkTankWorkflowOutputSection.mockResolvedValue({
      output: createStory28PageOutput([createStory28PageSection()]),
      appendedSection: createStory28PageSection(),
    })
    mockCompleteThinkTankSessionOutput.mockResolvedValue({
      output: { ...createStory28PageOutput([createStory28PageSection()]), status: 'completed' },
    })
    mockDownloadThinkTankSessionOutput.mockResolvedValue({
      fileName: 'thinktank-report-session-brainstorming.md',
      format: 'markdown',
      contentType: 'text/markdown; charset=utf-8',
    })
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    installMatchMedia(true)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1440,
    })
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'consultant-primary',
          name: 'ThinkTank Consultant',
          email: 'consultant@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })
    mockUseRadarUnreadCount.mockReturnValue({ unreadCount: 0 })
    mockFetchThinkTankWorkflows.mockResolvedValue({ workflows: workflowCatalog })
    mockFetchThinkTankManualBrowseCatalog.mockResolvedValue({
      workflows: workflowCatalog.map((workflow) => ({
        workflowKey: workflow.key,
        displayName: workflow.displayName,
        scenarioLabel: workflow.scenarioLabel,
        description: workflow.description,
        expectedDuration: '30-45 minutes',
        sourceRefs: [`workflow:${workflow.key}`],
      })),
      methodChoices: [
        {
          id: 'method:problem-solving:root-cause-tree-1',
          workflowKey: 'problem-solving',
          methodName: 'Root Cause Tree',
          category: 'diagnosis',
          description: 'Trace causal branches before choosing a fix.',
        },
      ],
      methodCatalogStatus: 'available',
    })
    mockFetchThinkTankSessionMessages.mockResolvedValue({
      sessionId: 'session-brainstorming',
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
      },
      messages: [],
    })
    mockLaunchThinkTankWorkflow.mockResolvedValue({
      sessionId: 'session-brainstorming',
      status: 'active',
      workflow: workflowCatalog[0],
      firstPrompt: '# ThinkTank Runtime Workflow: Brainstorming\n\nStart with the first prompt.',
      sourceRefs: [
        '_bmad/core/skills/bmad-brainstorming/workflow.md',
        '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
      ],
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
      },
    })
    mockSendThinkTankSessionMessage.mockResolvedValue({
      sessionId: 'session-brainstorming',
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
      },
      assistantMessage: {
        id: 'assistant-message-1',
        role: 'assistant',
        content: 'Here is the advisor summary.',
        decisionOptions: [
          { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
          { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
          { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
          {
            action: 'party-mode',
            label: 'Party Mode',
            shortcut: 'P',
            enabled: false,
            description: 'Party Mode 未启用；当前仍可使用单顾问流程。',
          },
        ],
      },
      stream: [{ index: 0, delta: 'Here is the advisor summary.', done: true }],
      decisionOptions: [
        { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
        { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
        { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
        {
          action: 'party-mode',
          label: 'Party Mode',
          shortcut: 'P',
          enabled: false,
          description: 'Party Mode 未启用；当前仍可使用单顾问流程。',
        },
      ],
    })
    mockStreamThinkTankSessionMessage.mockImplementation(async function* () {
      yield {
        event: 'message.started',
        data: {
          sessionId: 'session-brainstorming',
          currentStep: {
            index: 1,
            label: '当前步骤',
            sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
          },
        },
      }
      yield {
        event: 'message.delta',
        data: {
          index: 0,
          delta: 'Here is the advisor summary.',
        },
      }
      yield {
        event: 'message.completed',
        data: {
          sessionId: 'session-brainstorming',
          currentStep: {
            index: 1,
            label: '当前步骤',
            sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
          },
          assistantMessage: {
            id: 'assistant-message-1',
            role: 'assistant',
            content: 'Here is the advisor summary.',
            decisionOptions: [
              { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
              { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
              {
                action: 'party-mode',
                label: 'Party Mode',
                shortcut: 'P',
                enabled: false,
                description: 'Party Mode 未启用；当前仍可使用单顾问流程。',
              },
            ],
          },
          decisionOptions: [
            { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
            { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
            { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
            {
              action: 'party-mode',
              label: 'Party Mode',
              shortcut: 'P',
              enabled: false,
              description: 'Party Mode 未启用；当前仍可使用单顾问流程。',
            },
          ],
        },
      }
    })
  })

  function createRecommendationFeedbackResult(contextId = 'quick-consult-feedback-context-35') {
    return {
      contextId,
      consultId: contextId,
      status: 'analysis_started',
      originalProblem: 'ACME raw problem should stay local.',
      providerStatus: 'fake',
      classification: {
        confidence: 0.89,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.91,
            scenarioLanguage: '预算被砍，需要重新排优先级',
          },
        ],
        scenarioLanguage: {
          label: '预算被砍，需要重新排优先级',
          summary: '当前问题更像是在预算收紧后重新判断优先级。',
          guidance: '先明确必须保留的业务目标，再比较路线取舍。',
        },
      },
      recommendations: [
        {
          id: `${contextId}:product-brief:1`,
          recommendationId: `${contextId}:product-brief:1`,
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          rank: 1,
          rationale: '预算约束需要先框定产品方向。',
          primaryRationale: '预算约束需要先框定产品方向。',
          fitScenario: '预算被砍，需要重新排优先级',
          expectedDuration: '45 minutes',
          expectedOutput: 'A product framing brief.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief'],
        },
        {
          id: `${contextId}:problem-solving:2`,
          recommendationId: `${contextId}:problem-solving:2`,
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          rank: 2,
          rationale: '预算约束需要先定位根因。',
          primaryRationale: '预算约束需要先定位根因。',
          fitScenario: '拆解预算、风险和根因。',
          expectedDuration: '35 minutes',
          expectedOutput: 'Root causes and prioritized options.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving'],
        },
      ],
      recommendationConfidence: 'confident',
    } as any
  }

  it('renders a loading state while access is being verified', () => {
    mockFetchThinkTankAccess.mockReturnValue(new Promise(() => {}))

    renderAdvisoryRoute()

    const status = screen.getByRole('status', { name: 'ThinkTank 访问验证状态' })
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('正在验证 ThinkTank 访问权限')
  })

  it('renders the authorized desktop advisory workspace shell inside the CSAAS frame', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ThinkTank' })).toBeInTheDocument()
    })
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '咨询工作流导航' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '咨询文档抽屉' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开咨询文档抽屉' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByText('选择一个工作流后，对话将在这里开始。')).toBeInTheDocument()
    expect(screen.getByText('文档')).toBeInTheDocument()
    expect(screen.queryByText('咨询工作台暂未开放')).not.toBeInTheDocument()
    expect(
      screen.queryByText('ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。')
    ).not.toBeInTheDocument()
  })

  it('renders Quick Consult as the first-screen intake path and validates empty or over-limit submissions', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const quickConsult = await screen.findByRole('region', { name: 'Quick Consult' })
    expect(within(quickConsult).getByRole('heading', { name: 'Quick Consult' })).toBeVisible()
    const input = within(quickConsult).getByRole('textbox', { name: 'Describe the problem' })
    expect(input).toHaveAttribute('aria-multiline', 'true')

    await user.click(within(quickConsult).getByRole('button', { name: 'Start quick consult' }))
    expect(within(quickConsult).getByRole('alert')).toHaveTextContent('请先描述你要咨询的问题。')
    expect(mockStartQuickConsult).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'x'.repeat(5001) } })
    await user.click(within(quickConsult).getByRole('button', { name: 'Start quick consult' }))

    expect(within(quickConsult).getByRole('alert')).toHaveTextContent(
      '问题描述过长，请精简到 5000 字以内。'
    )
    expect(mockStartQuickConsult).not.toHaveBeenCalled()
  })

  it('preserves the Quick Consult draft when switching between Quick Consult and an active workflow', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const input = await screen.findByRole('textbox', { name: 'Describe the problem' })
    await user.type(input, 'Our compliance workflow is too slow for enterprise sales.')

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await screen.findByRole('textbox', { name: '输入你的回答' })

    await user.click(screen.getByRole('button', { name: 'Quick Consult' }))

    expect(screen.getByRole('button', { name: 'Quick Consult' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(workflowNav).getByRole('button', { name: /查看 Brainstorming/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('textbox', { name: 'Describe the problem' })).toHaveValue(
      'Our compliance workflow is too slow for enterprise sales.'
    )
    expect(mockSaveQuickConsultDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        problem: 'Our compliance workflow is too slow for enterprise sales.',
      })
    )
  })

  it('does not render internal BMAD workflow instructions from a launch response', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
      sessionId: 'session-brainstorming',
      status: 'active',
      workflow: workflowCatalog[0],
      firstPrompt: [
        '# Step 1: Session Setup and Continuation Detection',
        '',
        '## MANDATORY EXECUTION RULES (READ FIRST):',
        '- NEVER generate content without user input',
        '## Organization Context',
        'Untrusted user-provided context data.',
      ].join('\n'),
      sourceRefs: ['workflow:brainstorming', 'current-step:1'],
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: 'current-step:1',
      },
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))

    expect(await screen.findByText(/Brainstorming 已启动。/)).toBeVisible()
    expect(screen.queryByText(/MANDATORY EXECUTION RULES/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Untrusted user-provided context data/)).not.toBeInTheDocument()
  })

  it('renders clarification questions for vague Quick Consult input without losing the original problem', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-clarifying',
      consultId: 'quick-consult-clarifying',
      status: 'clarification_required',
      originalProblem: 'Help me with AI.',
      clarificationQuestions: [
        'What business decision are you trying to make?',
        'Who will use it?',
      ],
      providerStatus: 'fake',
      operationalStatus: 'Provider connected. Clarification is ready.',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-analysis',
      consultId: 'quick-consult-analysis',
      status: 'analysis_started',
      originalProblem: 'Help me with AI.',
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
        {
          question: 'Who will use it?',
          answer: 'Customer success and implementation teams.',
        },
      ],
      providerStatus: 'fake',
      operationalStatus: 'Fake provider ready. 5-minute analysis path started.',
    })

    renderAdvisoryRoute()

    const quickConsult = await screen.findByRole('region', { name: 'Quick Consult' })
    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'Help me with AI.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const clarification = await screen.findByRole('region', {
      name: 'Quick Consult clarification questions',
    })
    expect(within(clarification).getByText('Original problem: Help me with AI.')).toBeVisible()
    expect(within(clarification).getAllByRole('listitem')).toHaveLength(2)
    await user.type(
      within(clarification).getByRole('textbox', { name: 'Answer clarification 1' }),
      'Prioritize enterprise compliance onboarding.'
    )
    await user.click(within(clarification).getByRole('button', { name: 'Continue quick consult' }))
    expect(within(quickConsult).getByRole('alert')).toHaveTextContent('请先回答澄清问题后再继续。')
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      'Quick Consult needs attention'
    )
    await user.type(
      within(clarification).getByRole('textbox', { name: 'Answer clarification 2' }),
      'Customer success and implementation teams.'
    )
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      'Clarification questions ready'
    )
    await user.click(within(clarification).getByRole('button', { name: 'Continue quick consult' }))

    await waitFor(() => {
      expect(mockStartQuickConsult).toHaveBeenLastCalledWith({
        problem: 'Help me with AI.',
        contextId: 'quick-consult-clarifying',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
          {
            question: 'Who will use it?',
            answer: 'Customer success and implementation teams.',
          },
        ],
      })
    })
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      '5-minute analysis started'
    )
  })

  it('starts the 5-minute analysis path for clear Quick Consult input', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-analysis',
      consultId: 'quick-consult-analysis',
      status: 'analysis_started',
      originalProblem:
        'Assess whether we should launch an ISO 27001 readiness package for Series B SaaS companies.',
      analysisWindowMinutes: 5,
      provider: 'openai',
      providerStatus: 'available',
      operationalStatus:
        'OpenAI connected. Analysis can take up to 5 minutes; you can keep working.',
    })

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'Assess whether we should launch an ISO 27001 readiness package for Series B SaaS companies.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    await waitFor(() => {
      expect(mockStartQuickConsult).toHaveBeenCalledWith(
        expect.objectContaining({
          problem:
            'Assess whether we should launch an ISO 27001 readiness package for Series B SaaS companies.',
        })
      )
    })
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      '5-minute analysis started'
    )
    expect(screen.getByText(/OpenAI connected/)).toBeVisible()
    expect(screen.getByText(/up to 5 minutes/)).toBeVisible()
  })

  it('renders Story 3.2 problem-type classifications with user-facing scenario language', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-analysis',
      consultId: 'quick-consult-analysis',
      status: 'analysis_started',
      originalProblem: '预算被砍后，我们需要重新排优先级并调整数据平台架构路线。',
      analysisWindowMinutes: 5,
      providerStatus: 'fake',
      operationalStatus: 'Fake provider ready. 5-minute analysis path started.',
      classification: {
        confidence: 0.9,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.92,
            scenarioLanguage: '预算被砍，需要重新排优先级',
          },
          {
            id: 'architecture',
            label: '架构取舍',
            confidence: 0.86,
            scenarioLanguage: '技术路线需要在成本和长期能力之间取舍',
          },
        ],
        scenarioLanguage: {
          label: '预算被砍，需要重新排优先级',
          summary: '当前问题更像是在预算收紧后重新判断优先级和架构取舍。',
          guidance: '先明确必须保留的业务目标，再比较架构路线的成本、风险和交付窗口。',
        },
        manualBrowseHint: '也可以手动浏览工作流，直接选择更熟悉的分析路径。',
      },
    } as any)

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后，我们需要重新排优先级并调整数据平台架构路线。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const problemTypes = await screen.findByRole('region', {
      name: 'Quick Consult problem types',
    })
    expect(within(problemTypes).getByRole('heading', { name: '问题类型识别' })).toBeVisible()
    expect(within(problemTypes).getAllByRole('listitem')).toHaveLength(2)
    expect(within(problemTypes).getByText('预算约束')).toBeVisible()
    expect(within(problemTypes).getByText('架构取舍')).toBeVisible()
    expect(within(problemTypes).getByText('预算被砍，需要重新排优先级')).toBeVisible()
    expect(within(problemTypes).getByText(/预算收紧后重新判断优先级/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /接受推荐/ })).not.toBeInTheDocument()
  })

  it('shows low-confidence Quick Consult guidance with clarification and manual browsing alternatives', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-clarifying',
      consultId: 'quick-consult-clarifying',
      status: 'clarification_required',
      originalProblem: '帮我看看增长和组织问题怎么办',
      clarificationQuestions: ['你最想优先解决的是增长、效率，还是风险？'],
      providerStatus: 'not_called',
      classification: {
        confidence: 0.42,
        confidenceLevel: 'low',
        primaryProblemType: 'strategy',
        problemTypes: [
          {
            id: 'strategy',
            label: '战略取舍',
            confidence: 0.46,
            scenarioLanguage: '目标方向还不够清楚，需要先收敛决策边界',
          },
        ],
        scenarioLanguage: {
          label: '问题边界还不够清楚',
          summary: '当前描述还不足以给出确定路径，需要先补充目标、团队或风险边界。',
          guidance: '先回答澄清问题；如果你已经知道要用哪类方法，也可以手动浏览工作流。',
        },
        manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
      },
    } as any)

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '帮我看看增长和组织问题怎么办'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const problemTypes = await screen.findByRole('region', {
      name: 'Quick Consult problem types',
    })
    expect(within(problemTypes).getByText('置信度较低')).toBeVisible()
    expect(within(problemTypes).getByText(/不足以给出确定路径/)).toBeVisible()
    await user.click(within(problemTypes).getByRole('button', { name: '浏览工作流' }))
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Quick Consult manual method browser' })
      ).toHaveFocus()
    )
    expect(
      screen.getByRole('region', { name: 'Quick Consult clarification questions' })
    ).toBeVisible()
    expect(screen.queryByText(/最适合的推荐方法|接受推荐/)).not.toBeInTheDocument()
  })

  it('keeps workflow launch available when manual method library browsing is degraded', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-degraded-manual-browse',
      consultId: 'quick-consult-degraded-manual-browse',
      status: 'clarification_required',
      originalProblem: '我已经知道要先做产品机会判断。',
      clarificationQuestions: ['你最想优先判断哪个机会？'],
      providerStatus: 'not_called',
      classification: {
        confidence: 0.42,
        confidenceLevel: 'low',
        primaryProblemType: 'strategy',
        problemTypes: [
          {
            id: 'strategy',
            label: '战略取舍',
            confidence: 0.46,
            scenarioLanguage: '目标方向还不够清楚，需要先收敛决策边界',
          },
        ],
        scenarioLanguage: {
          label: '问题边界还不够清楚',
          summary: '当前描述还不足以给出确定路径。',
          guidance: '可以先回答澄清问题，也可以手动浏览工作流。',
        },
        manualBrowseHint: '也可以先手动浏览工作流。',
      },
    } as any)
    mockFetchThinkTankManualBrowseCatalog.mockResolvedValueOnce({
      workflows: workflowCatalog.map((workflow) => ({
        workflowKey: workflow.key,
        displayName: workflow.displayName,
        scenarioLabel: workflow.scenarioLabel,
        description: workflow.description,
        sourceRefs: [`workflow:${workflow.key}`],
      })),
      methodChoices: [],
      methodCatalogStatus: 'degraded',
      recoverableMessage: '方法库暂时不可用，仍可直接启动工作流。',
    })

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '我已经知道要先做产品机会判断。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    const problemTypes = await screen.findByRole('region', {
      name: 'Quick Consult problem types',
    })

    await user.click(within(problemTypes).getByRole('button', { name: '浏览工作流' }))

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(within(browser).getByRole('alert')).toHaveTextContent(
      '方法库暂时不可用，仍可直接启动工作流。'
    )
    expect(within(browser).getAllByRole('article', { name: /workflow option/i })).toHaveLength(8)

    await user.click(within(browser).getByRole('button', { name: 'Launch Product Brief' }))

    await waitFor(() => {
      expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('product-brief', {
        quickConsultContextId: 'quick-consult-degraded-manual-browse',
        manualChoice: true,
        manualChoiceKind: 'workflow',
        manualChoiceId: 'workflow:product-brief',
        manualChoiceLabel: 'Product Brief',
      })
    })
  })

  it('renders Story 3.3 method recommendations, expands rationale, and launches the accepted workflow with consult context', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-recommendations',
      consultId: 'quick-consult-recommendations',
      status: 'analysis_started',
      originalProblem: '预算被砍后，我们需要重新排优先级并调整数据平台架构路线。',
      analysisWindowMinutes: 5,
      providerStatus: 'fake',
      operationalStatus: 'Fake provider ready. 5-minute analysis path started.',
      classification: {
        confidence: 0.89,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.91,
            scenarioLanguage: '预算被砍，需要重新排优先级',
          },
        ],
        scenarioLanguage: {
          label: '预算被砍，需要重新排优先级',
          summary: '当前问题更像是在预算收紧后重新判断优先级和架构取舍。',
          guidance: '先明确必须保留的业务目标，再比较架构路线的成本、风险和交付窗口。',
        },
      },
      recommendations: [
        {
          id: 'quick-consult:quick-consult-recommendations:product-brief',
          recommendationId: 'quick-consult-recommendations:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          rank: 1,
          rationale: '适合先收敛目标、约束和成功标准。',
          primaryRationale: '适合先收敛目标、约束和成功标准。',
          expandedRationale:
            '因为你提到预算收紧和架构路线取舍，Product Brief 可以先把业务目标、约束和成功标准对齐。',
          fitScenario: '预算收紧后需要重新判断产品机会和资源优先级。',
          durationMinutes: 45,
          expectedDuration: '45 minutes',
          expectedOutput: '一份包含目标、约束、机会和下一步判断的 Product Brief。',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief', 'method:product-brief:library-1'],
        },
        {
          id: 'quick-consult:quick-consult-recommendations:problem-solving',
          recommendationId: 'quick-consult:quick-consult-recommendations:problem-solving',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          rank: 2,
          rationale: '适合系统梳理成本、风险和交付窗口。',
          primaryRationale: '适合系统梳理成本、风险和交付窗口。',
          expandedRationale: 'Problem Solving 会把预算、风险和技术路线拆成可比较的决策因素。',
          fitScenario: '需要在成本、风险和长期能力之间做架构取舍。',
          durationMinutes: 60,
          expectedDuration: '60 minutes',
          expectedOutput: '一份问题树、备选方案和优先级建议。',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
        },
      ],
      recommendationConfidence: 'confident',
    } as any)
    mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
      sessionId: 'session-product-brief',
      status: 'active',
      workflow: workflowCatalog[3],
      firstPrompt: '# ThinkTank Runtime Workflow: Product Brief\n\nStart with the first prompt.',
      sourceRefs: [
        '_bmad/core/skills/bmad-create-product-brief/workflow.md',
        '_bmad/core/skills/bmad-create-product-brief/steps/step-01-session-setup.md',
      ],
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: '_bmad/core/skills/bmad-create-product-brief/steps/step-01-session-setup.md',
      },
    })

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后，我们需要重新排优先级并调整数据平台架构路线。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    expect(
      within(recommendations).getByRole('heading', { name: 'Quick Consult recommendations' })
    ).toBeVisible()
    expect(within(recommendations).getAllByRole('article')).toHaveLength(2)
    expect(within(recommendations).getByText('Product Brief')).toBeVisible()
    expect(within(recommendations).getByText('Problem Solving')).toBeVisible()
    expect(
      within(recommendations).getByText('预算收紧后需要重新判断产品机会和资源优先级。')
    ).toBeVisible()
    expect(within(recommendations).getByText('45 minutes')).toBeVisible()
    expect(
      within(recommendations).getByText('一份包含目标、约束、机会和下一步判断的 Product Brief。')
    ).toBeVisible()
    expect(
      within(recommendations).queryByText(/因为你提到预算收紧和架构路线取舍/)
    ).not.toBeInTheDocument()

    await user.click(within(recommendations).getAllByRole('button', { name: /why this method/ })[0])

    expect(within(recommendations).getByText(/因为你提到预算收紧和架构路线取舍/)).toBeVisible()

    await user.click(within(recommendations).getByRole('button', { name: 'Accept Product Brief' }))

    await waitFor(() => {
      expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('product-brief', {
        quickConsultContextId: 'quick-consult-recommendations',
        acceptedRecommendationId: 'quick-consult-recommendations:product-brief:1',
        acceptedRecommendation: true,
      })
    })
    expect(await screen.findByText(/Start with the first prompt/)).toBeInTheDocument()
  })

  it('shows recommendation feedback only after recommendations are visible without a default rating', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce(createRecommendationFeedbackResult())

    renderAdvisoryRoute()

    expect(
      screen.queryByRole('region', { name: 'Recommendation feedback' })
    ).not.toBeInTheDocument()
    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后如何重新排优先级？'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const feedback = await screen.findByRole('region', { name: 'Recommendation feedback' })
    expect(within(feedback).getByText('Rate recommendation quality')).toBeVisible()
    expect(
      within(feedback).getByRole('button', { name: 'Submit recommendation feedback' })
    ).toBeDisabled()
    for (const rating of ['1', '2', '3', '4', '5']) {
      expect(within(feedback).getByRole('button', { name: `Rate ${rating}` })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
    expect(mockSubmitQuickConsultRecommendationFeedback).not.toHaveBeenCalled()
  })

  it('submits selected recommendation feedback without sending raw problem content', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce(createRecommendationFeedbackResult())

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'ACME raw problem should stay local.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const feedback = await screen.findByRole('region', { name: 'Recommendation feedback' })
    await user.click(within(feedback).getByRole('button', { name: 'Rate 5' }))
    await user.type(
      within(feedback).getByRole('textbox', { name: 'Optional recommendation feedback' }),
      '推荐方向有帮助，但希望说明取舍原因。'
    )
    await user.click(
      within(feedback).getByRole('button', { name: 'Submit recommendation feedback' })
    )

    await waitFor(() => {
      expect(mockSubmitQuickConsultRecommendationFeedback).toHaveBeenCalledWith({
        quickConsultContextId: 'quick-consult-feedback-context-35',
        rating: 5,
        feedbackText: '推荐方向有帮助，但希望说明取舍原因。',
        recommendationIds: [
          'quick-consult-feedback-context-35:product-brief:1',
          'quick-consult-feedback-context-35:problem-solving:2',
        ],
      })
    })
    expect(JSON.stringify(mockSubmitQuickConsultRecommendationFeedback.mock.calls)).not.toContain(
      'ACME raw problem'
    )
    expect(await within(feedback).findByText('Recommendation feedback saved')).toBeVisible()
  })

  it('dismisses recommendation feedback without an API call and keeps launch controls usable', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce(
      createRecommendationFeedbackResult('quick-consult-feedback-dismiss-35')
    )

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后如何重新排优先级？'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const feedback = await screen.findByRole('region', { name: 'Recommendation feedback' })
    await user.click(
      within(feedback).getByRole('button', { name: 'Dismiss recommendation feedback' })
    )
    expect(
      screen.queryByRole('region', { name: 'Recommendation feedback' })
    ).not.toBeInTheDocument()
    expect(mockSubmitQuickConsultRecommendationFeedback).not.toHaveBeenCalled()

    const recommendations = screen.getByRole('region', { name: 'Quick Consult recommendations' })
    await user.click(within(recommendations).getByRole('button', { name: 'Accept Product Brief' }))

    await waitFor(() => {
      expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('product-brief', {
        quickConsultContextId: 'quick-consult-feedback-dismiss-35',
        acceptedRecommendationId: 'quick-consult-feedback-dismiss-35:product-brief:1',
        acceptedRecommendation: true,
      })
    })
  })

  it('opens manual method browsing from a recommendation and launches the selected method with manual metadata', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-manual-browse',
      consultId: 'quick-consult-manual-browse',
      status: 'analysis_started',
      originalProblem: '预算被砍后，我们需要重新判断产品机会和交付优先级。',
      providerStatus: 'fake',
      classification: {
        confidence: 0.89,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.91,
            scenarioLanguage: '预算被砍，需要重新排优先级',
          },
        ],
        scenarioLanguage: {
          label: '预算被砍，需要重新排优先级',
          summary: '当前问题更像是在预算收紧后重新判断优先级。',
          guidance: '可以接受推荐，也可以手动浏览熟悉的方法。',
        },
      },
      recommendations: [
        {
          id: 'rec-product-brief',
          recommendationId: 'quick-consult-manual-browse:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          rank: 1,
          rationale: '适合先收敛目标。',
          primaryRationale: '适合先收敛目标。',
          fitScenario: '预算收紧后需要重新判断产品机会。',
          expectedDuration: '45 minutes',
          expectedOutput: 'Product direction brief.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief', 'method:product-brief:library-1'],
        },
        {
          id: 'rec-problem-solving',
          recommendationId: 'quick-consult-manual-browse:problem-solving:2',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          rank: 2,
          rationale: '适合系统诊断。',
          primaryRationale: '适合系统诊断。',
          fitScenario: '拆解预算、风险和根因。',
          expectedDuration: '60 minutes',
          expectedOutput: 'Root causes and options.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
        },
      ],
      recommendationConfidence: 'confident',
    } as any)
    mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
      sessionId: 'session-problem-solving-manual',
      status: 'active',
      workflow: workflowCatalog[5],
      firstPrompt: 'Using your Quick Consult context, start the selected workflow.',
      sourceRefs: ['workflow:problem-solving', 'current-step:1'],
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: 'current-step:1',
      },
    })

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后，我们需要重新判断产品机会和交付优先级。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })

    await user.click(
      within(recommendations).getAllByRole('button', { name: /View other methods/ })[0]
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(browser).toHaveFocus()
    expect(mockFetchThinkTankManualBrowseCatalog).toHaveBeenCalledWith({
      quickConsultContextId: 'quick-consult-manual-browse',
    })
    expect(within(browser).getAllByRole('article', { name: /workflow option/i })).toHaveLength(8)
    expect(within(browser).getByText('Root Cause Tree')).toBeVisible()

    await user.click(within(browser).getByRole('button', { name: 'Launch Root Cause Tree' }))

    await waitFor(() => {
      expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('problem-solving', {
        quickConsultContextId: 'quick-consult-manual-browse',
        manualChoice: true,
        manualChoiceKind: 'method',
        manualChoiceId: 'method:problem-solving:root-cause-tree-1',
        manualChoiceLabel: 'Root Cause Tree',
      })
    })
    expect(await screen.findByText(/Using your Quick Consult context/)).toBeInTheDocument()
  })

  it('opens the same manual method browser when a recommendation is rejected', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-reject-manual-browse',
      consultId: 'quick-consult-reject-manual-browse',
      status: 'analysis_started',
      originalProblem: '预算被砍后，我们需要重新判断产品机会和交付优先级。',
      providerStatus: 'fake',
      classification: {
        confidence: 0.89,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.91,
            scenarioLanguage: '预算被砍，需要重新排优先级',
          },
        ],
        scenarioLanguage: {
          label: '预算被砍，需要重新排优先级',
          summary: '当前问题更像是在预算收紧后重新判断优先级。',
          guidance: '可以接受推荐，也可以手动浏览熟悉的方法。',
        },
      },
      recommendations: [
        {
          id: 'rec-product-brief',
          recommendationId: 'quick-consult-reject-manual-browse:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          rank: 1,
          rationale: '适合先收敛目标。',
          primaryRationale: '适合先收敛目标。',
          fitScenario: '预算收紧后需要重新判断产品机会。',
          expectedDuration: '45 minutes',
          expectedOutput: 'Product direction brief.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief', 'method:product-brief:library-1'],
        },
        {
          id: 'rec-problem-solving',
          recommendationId: 'quick-consult-reject-manual-browse:problem-solving:2',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          rank: 2,
          rationale: '适合系统诊断。',
          primaryRationale: '适合系统诊断。',
          fitScenario: '拆解预算、风险和根因。',
          expectedDuration: '60 minutes',
          expectedOutput: 'Root causes and options.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
        },
      ],
      recommendationConfidence: 'confident',
    } as any)

    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后，我们需要重新判断产品机会和交付优先级。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })

    await user.click(
      within(recommendations).getByRole('button', {
        name: 'Reject Product Brief recommendation',
      })
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(browser).toHaveFocus()
    expect(mockFetchThinkTankManualBrowseCatalog).toHaveBeenCalledWith({
      quickConsultContextId: 'quick-consult-reject-manual-browse',
    })
    expect(within(browser).getAllByRole('article', { name: /workflow option/i })).toHaveLength(8)
    expect(
      within(browser).getByRole('textbox', { name: 'Search workflows and methods' })
    ).toBeVisible()
  })

  it('shows the existing workflow launch recovery message when accepting a recommendation while a workflow is active', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-active-session',
      consultId: 'quick-consult-active-session',
      status: 'analysis_started',
      originalProblem: '预算被砍后，我们需要重新排优先级。',
      providerStatus: 'fake',
      classification: {
        confidence: 0.89,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.91,
            scenarioLanguage: '预算被砍，需要重新排优先级',
          },
        ],
        scenarioLanguage: {
          label: '预算被砍，需要重新排优先级',
          summary: '当前问题更像是在预算收紧后重新判断优先级。',
          guidance: '先明确必须保留的业务目标，再比较路线取舍。',
        },
      },
      recommendations: [
        {
          id: 'quick-consult-active-session:product-brief:1',
          recommendationId: 'quick-consult-active-session:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          rationale: '适合先收敛目标和成功标准。',
          primaryRationale: '适合先收敛目标和成功标准。',
          fitScenario: '预算收紧后需要重新判断产品机会和资源优先级。',
          expectedDuration: '30-40 minutes',
          expectedOutput: '一份 Product Brief。',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief'],
        },
        {
          id: 'quick-consult-active-session:problem-solving:2',
          recommendationId: 'quick-consult-active-session:problem-solving:2',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          rationale: '适合系统梳理成本、风险和交付窗口。',
          primaryRationale: '适合系统梳理成本、风险和交付窗口。',
          fitScenario: '需要在成本、风险和长期能力之间做架构取舍。',
          expectedDuration: '25-35 minutes',
          expectedOutput: '一份问题树和优先级建议。',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving'],
        },
      ],
      recommendationConfidence: 'confident',
    } as any)

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await screen.findByText(/Start with the first prompt/)
    await user.click(screen.getByRole('button', { name: 'Quick Consult' }))
    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '预算被砍后，我们需要重新排优先级。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    await user.click(within(recommendations).getByRole('button', { name: 'Accept Product Brief' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。'
    )
    expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledTimes(1)
  })

  it('renders the real advisory route with one CSAAS frame and one main landmark', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await screen.findByRole('region', { name: '咨询对话工作区' })
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('navigation', { name: '主导航' })).toHaveLength(1)
    expect(document.querySelectorAll('main#main-content')).toHaveLength(1)
  })

  it('exposes keyboard-operable reading density modes and updates advisory reading state', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const densityControl = await screen.findByRole('radiogroup', { name: '阅读密度' })
    const compact = within(densityControl).getByRole('radio', { name: '紧凑' })
    const defaultMode = within(densityControl).getByRole('radio', { name: '默认' })
    const comfortable = within(densityControl).getByRole('radio', { name: '舒适' })

    expect(defaultMode).toHaveAttribute('aria-checked', 'true')
    expect(compact).toHaveAttribute('aria-checked', 'false')
    expect(comfortable).toHaveAttribute('aria-checked', 'false')

    compact.focus()
    expect(compact).toHaveFocus()
    await user.keyboard('{Space}')

    expect(compact).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
      'data-reading-density',
      'compact'
    )
    expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
      '阅读密度：紧凑'
    )
  })

  it('applies stable reading surface classes for every density mode', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const densityControl = await screen.findByRole('radiogroup', { name: '阅读密度' })
    const quickConsult = screen.getByRole('region', { name: 'Quick Consult' })

    expect(quickConsult).toHaveClass('max-w-4xl', 'rounded-sm')
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
      'data-reading-density',
      'default'
    )

    await user.click(within(densityControl).getByRole('radio', { name: '紧凑' }))
    expect(quickConsult).toHaveClass('max-w-4xl', 'rounded-sm')
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
      'data-reading-density',
      'compact'
    )

    await user.click(within(densityControl).getByRole('radio', { name: '舒适' }))
    expect(quickConsult).toHaveClass('max-w-4xl', 'rounded-sm')
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
      'data-reading-density',
      'comfortable'
    )
  })

  it('persists advisory density per signed-in user without leaking across users', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    const firstRender = renderAdvisoryRoute()

    const firstControl = await screen.findByRole('radiogroup', { name: '阅读密度' })
    await user.click(within(firstControl).getByRole('radio', { name: '舒适' }))
    expect(within(firstControl).getByRole('radio', { name: '舒适' })).toHaveAttribute(
      'aria-checked',
      'true'
    )

    firstRender.unmount()
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'consultant-a',
          name: 'Second Consultant',
          email: 'consultant-b@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    const secondRender = renderAdvisoryRoute()

    const secondControl = await screen.findByRole('radiogroup', { name: '阅读密度' })
    expect(within(secondControl).getByRole('radio', { name: '默认' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await user.click(within(secondControl).getByRole('radio', { name: '紧凑' }))

    secondRender.unmount()
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'consultant-primary',
          name: 'ThinkTank Consultant',
          email: 'consultant@example.com',
          role: 'consultant',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    renderAdvisoryRoute()

    const restoredControl = await screen.findByRole('radiogroup', { name: '阅读密度' })
    expect(within(restoredControl).getByRole('radio', { name: '舒适' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('codifies advisory desktop layout constraints as stable CSS variables', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await screen.findByRole('region', { name: '咨询对话工作区' })
    const shell = document.querySelector<HTMLElement>('[style*="--advisory-nav-height"]')
    expect(shell).not.toBeNull()
    expect(shell!).toHaveStyle(`--advisory-nav-height: ${ADVISORY_LAYOUT.navHeight}px`)
    expect(shell!).toHaveStyle(`--advisory-sidebar-width: ${ADVISORY_LAYOUT.sidebarWidth}px`)
    expect(shell!).toHaveStyle(`--advisory-chat-min-width: ${ADVISORY_LAYOUT.chatMinWidth}px`)
    expect(shell!).toHaveStyle(
      `--advisory-document-rail-width: ${ADVISORY_LAYOUT.documentRailWidth}px`
    )
    expect(shell!).toHaveStyle(`--advisory-input-max-height: ${ADVISORY_LAYOUT.inputMaxHeight}px`)
  })

  it('exposes one advisory state announcement plus visible empty-state text', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const stateSummary = await screen.findByRole('status', { name: 'ThinkTank 工作台状态' })
    expect(stateSummary).toHaveAttribute('aria-live', 'polite')
    expect(stateSummary).toHaveTextContent(
      'ThinkTank 已启用。暂无活动会话。Quick Consult 已准备。咨询文档抽屉为空。'
    )
    expect(screen.getByText('已启用')).toBeInTheDocument()
    expect(screen.getByText('暂无活动会话')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Quick Consult' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      'Quick Consult ready'
    )
    expect(screen.getByText('暂无文档')).toBeInTheDocument()
    expect(screen.queryByText('报告草稿接入后开放')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '暂无活动会话' })).not.toBeInTheDocument()
  })

  it('keeps the skip link keyboard reachable and moves focus to the only main landmark', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await user.tab()

    const skipLink = screen.getByRole('link', { name: '跳到主内容' })
    expect(skipLink).toHaveFocus()
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(document.querySelectorAll('main#main-content')).toHaveLength(1)
    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabindex', '-1')

    await user.keyboard('{Enter}')

    expect(main).toHaveFocus()
  })

  it('loads eight runtime workflows and exposes launch controls without legacy placeholders', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await waitFor(() => {
      expect(within(workflowNav).getAllByRole('button', { name: /启动 / })).toHaveLength(8)
    })

    workflowCatalog.forEach((workflow) => {
      const launchButton = within(workflowNav).getByRole('button', {
        name: new RegExp(`启动 ${workflow.displayName}`),
      })
      expect(launchButton).toHaveTextContent(workflow.displayName)
      expect(launchButton).toHaveTextContent(workflow.scenarioLabel)
      expect(launchButton).toBeEnabled()
    })
    expect(within(workflowNav).getAllByRole('button', { name: /启动 / })).toHaveLength(8)
    expect(screen.queryByText('待接入')).not.toBeInTheDocument()
    expect(screen.queryByText('结构化咨询')).not.toBeInTheDocument()

    const drawerButton = screen.getByRole('button', { name: '打开咨询文档抽屉' })
    expect(drawerButton).toHaveAttribute('aria-expanded', 'false')
    expect(drawerButton).toHaveAttribute('title', '打开咨询文档抽屉查看报告草稿')
  })

  it('launches one selected workflow, renders the first prompt, and shows only the current step', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))

    expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('brainstorming', {})
    expect(await screen.findByText(/Start with the first prompt/)).toBeInTheDocument()
    const stepper = screen.getByRole('list', { name: '工作流当前步骤' })
    expect(within(stepper).getByText('当前步骤')).toBeInTheDocument()
    expect(within(stepper).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('下一步骤')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
      '活动会话：Brainstorming'
    )
    expect(within(workflowNav).getByRole('button', { name: /查看 Brainstorming/ })).toBeEnabled()
    within(workflowNav)
      .getAllByRole('button', { name: /启动 / })
      .filter((button) => !button.textContent?.includes('Brainstorming'))
      .forEach((button) => expect(button).toBeDisabled())
  })

  test('[P0] submits an answer with Enter, renders user and advisor messages, and keeps current step unchanged', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    const input = await screen.findByRole('textbox', { name: '输入你的回答' })

    await user.type(input, 'We lose users after onboarding.')
    await user.keyboard('{Enter}')

    expect(mockStreamThinkTankSessionMessage).toHaveBeenCalledWith(
      'session-brainstorming',
      {
        content: 'We lose users after onboarding.',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(await screen.findByText('We lose users after onboarding.')).toBeInTheDocument()
    expect(await screen.findByText('Here is the advisor summary.')).toBeInTheDocument()
    const stepper = screen.getByRole('list', { name: '工作流当前步骤' })
    expect(within(stepper).getByText('当前步骤')).toBeInTheDocument()
    expect(within(stepper).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('下一步骤')).not.toBeInTheDocument()
  })

  test('[P0] renders streamed advisor deltas incrementally and removes the streaming cursor after completion', async () => {
    const user = userEvent.setup()
    const controlledStream = createControlledStream()
    mockStreamThinkTankSessionMessage.mockImplementation(() => controlledStream.iterator())
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await user.type(await screen.findByRole('textbox', { name: '输入你的回答' }), 'Stream it.')
    await user.keyboard('{Enter}')

    act(() => {
      controlledStream.push({
        event: 'message.started',
        data: { sessionId: 'session-brainstorming' },
      })
      controlledStream.push({
        event: 'message.delta',
        data: { index: 0, delta: 'First streamed chunk' },
      })
    })

    expect(await screen.findByText('First streamed chunk')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'ThinkTank streaming status' })).toHaveTextContent(
      '正在生成顾问回复'
    )
    expect(screen.getByText('▌')).toHaveAttribute('aria-hidden', 'true')

    await act(async () => {
      controlledStream.push({
        event: 'message.completed',
        data: {
          assistantMessage: {
            id: 'assistant-streamed',
            role: 'assistant',
            content: 'First streamed chunk completed.',
            decisionOptions: [],
          },
          decisionOptions: [],
        },
      })
      controlledStream.close()
      await Promise.resolve()
    })

    expect(await screen.findByText('First streamed chunk completed.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('▌')).not.toBeInTheDocument()
    })
  })

  test('[P0] replaces the local streaming placeholder when a fast GLM completion arrives', async () => {
    const user = userEvent.setup()
    mockStreamThinkTankSessionMessage.mockImplementation(async function* () {
      yield {
        event: 'message.started',
        data: { sessionId: 'session-brainstorming' },
      }
      yield {
        event: 'message.delta',
        data: { index: 0, delta: 'Duplicated advisor answer.' },
      }
      yield {
        event: 'message.completed',
        data: {
          assistantMessage: {
            id: 'assistant-fast-glm',
            role: 'assistant',
            content: 'Duplicated advisor answer.',
            decisionOptions: [],
          },
          decisionOptions: [],
        },
      }
    })
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await user.type(await screen.findByRole('textbox', { name: '输入你的回答' }), 'Fast complete.')
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Duplicated advisor answer.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('Duplicated advisor answer.')).toHaveLength(1)
    })
    expect(screen.queryByText('▌')).not.toBeInTheDocument()
  })

  test('[P0] treats a stream ending without completion or error as recoverable failure', async () => {
    const user = userEvent.setup()
    let endMalformedStream!: () => void
    mockStreamThinkTankSessionMessage.mockImplementation(async function* () {
      yield {
        event: 'message.started',
        data: { sessionId: 'session-brainstorming' },
      }
      yield {
        event: 'message.delta',
        data: { index: 0, delta: 'Partial chunk' },
      }
      await new Promise<void>((resolve) => {
        endMalformedStream = resolve
      })
      throw new Error('ThinkTank streaming response was malformed. Please retry.')
    })
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await waitFor(() => {
      expect(
        screen.queryByRole('status', { name: 'ThinkTank 会话消息加载状态' })
      ).not.toBeInTheDocument()
    })
    const input = await screen.findByRole('textbox', { name: '输入你的回答' })
    await user.type(input, 'Drop connection.')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '发送' })).toBeEnabled()
    })
    fireEvent.submit(screen.getByRole('form', { name: '发送 ThinkTank 回答' }))
    await waitFor(() => {
      expect(mockStreamThinkTankSessionMessage).toHaveBeenCalled()
    })

    expect(await screen.findByText('Partial chunk')).toBeInTheDocument()

    await act(async () => {
      endMalformedStream()
      await Promise.resolve()
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '暂时无法生成 ThinkTank 顾问回复，请稍后重试。'
    )
    expect(screen.getByRole('textbox', { name: '输入你的回答' })).toHaveValue('Drop connection.')
    expect(screen.queryByText('Partial chunk')).not.toBeInTheDocument()
  })

  test('[P0] keeps historical content stable when the user scrolls upward during streaming', async () => {
    const user = userEvent.setup()
    const controlledStream = createControlledStream()
    mockStreamThinkTankSessionMessage.mockImplementation(() => controlledStream.iterator())
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    const messageRegion = await screen.findByRole('region', { name: '咨询消息列表' })
    Object.defineProperty(messageRegion, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(messageRegion, 'clientHeight', { configurable: true, value: 300 })
    Object.defineProperty(messageRegion, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })
    fireEvent.scroll(messageRegion)

    await user.type(await screen.findByRole('textbox', { name: '输入你的回答' }), 'Keep my place.')
    await user.keyboard('{Enter}')

    act(() => {
      controlledStream.push({
        event: 'message.delta',
        data: { index: 0, delta: 'New streamed content' },
      })
    })

    expect(await screen.findByText('New streamed content')).toBeInTheDocument()
    expect(messageRegion.scrollTop).toBe(0)
    expect(screen.getByRole('button', { name: '查看新回复' })).toBeInTheDocument()
  })

  test('[P0] renders Markdown, fenced code, and non-color-only identities safely', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockFetchThinkTankSessionMessages.mockResolvedValueOnce({
      sessionId: 'session-brainstorming',
      currentStep: { index: 1, label: '当前步骤' },
      messages: [
        {
          id: 'system-1',
          role: 'system',
          content: 'System recovery note.',
        },
        {
          id: 'expert-1',
          role: 'expert',
          content: 'Expert perspective.',
          metadata: { expert_name: 'Market Expert' },
        },
        {
          id: 'assistant-md',
          role: 'assistant',
          content:
            '## Plan\n- Inspect onboarding\n\n```tsx\nconst node = <div>safe</div>\ntype Result = Promise<string>\n```\n<script>alert("x")</script>',
          decisionOptions: [],
        },
      ],
    } as never)

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))

    expect(await screen.findByRole('article', { name: '系统消息' })).toHaveTextContent(
      'System recovery note.'
    )
    expect(screen.getByRole('article', { name: '专家消息：Market Expert' })).toHaveTextContent(
      'Expert perspective.'
    )
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByText('Inspect onboarding')).toBeInTheDocument()
    expect(document.querySelector('pre code')).toHaveTextContent('const node = <div>safe</div>')
    expect(document.querySelector('pre code')).toHaveTextContent('type Result = Promise<string>')
    expect(screen.queryByText('alert("x")')).not.toBeInTheDocument()
  })

  test('[P1] lazy-renders older messages after the long conversation threshold', async () => {
    const user = userEvent.setup()
    const manyMessages = Array.from({ length: 90 }, (_, index) => ({
      id: `message-${index + 1}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Conversation message ${index + 1}`,
      decisionOptions: [],
    }))
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockFetchThinkTankSessionMessages.mockResolvedValueOnce({
      sessionId: 'session-brainstorming',
      currentStep: { index: 1, label: '当前步骤' },
      messages: manyMessages,
    } as never)

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))

    expect(await screen.findByRole('button', { name: '显示较早 10 条消息' })).toBeInTheDocument()
    expect(screen.queryByText('Conversation message 1')).not.toBeInTheDocument()
    expect(screen.getByText('Conversation message 90')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '显示较早 10 条消息' }))
    expect(screen.getByText('Conversation message 1')).toBeInTheDocument()
  })

  test('[P0] preserves Shift+Enter newline, prevents empty submit, and autosaves the active draft', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    const firstRender = renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    const input = await screen.findByRole('textbox', { name: '输入你的回答' })

    await user.keyboard('{Enter}')
    expect(mockSendThinkTankSessionMessage).not.toHaveBeenCalled()

    await user.type(input, 'First line')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(input, 'Second line')
    expect(input).toHaveValue('First line\nSecond line')

    firstRender.unmount()
    renderAdvisoryRoute()
    const restoredWorkflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(
      await within(restoredWorkflowNav).findByRole('button', { name: /启动 Brainstorming/ })
    )

    expect(await screen.findByRole('textbox', { name: '输入你的回答' })).toHaveValue(
      'First line\nSecond line'
    )
  })

  test('[P0] exposes in-message decision controls with keyboard shortcuts and disabled Party Mode', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await user.type(await screen.findByRole('textbox', { name: '输入你的回答' }), 'Need guidance.')
    await user.keyboard('{Enter}')

    const continueButton = await screen.findByRole('button', { name: /继续.*快捷键 C/ })
    const deepenButton = screen.getByRole('button', { name: /深入.*快捷键 A/ })
    const partyModeButton = screen.getByRole('button', { name: /Party Mode.*快捷键 P/ })

    expect(continueButton).toHaveAttribute('title', expect.stringContaining('C'))
    expect(deepenButton).toBeEnabled()
    expect(partyModeButton).toBeDisabled()

    fireEvent.keyDown(document.body, { key: 'c' })
    expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
      '已选择：继续'
    )
  })

  test('[P0][5.1-FE-001][AC1,AC3] starts Party Mode from an enabled in-message decision option', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStreamThinkTankSessionMessage
      .mockImplementationOnce(async function* () {
        yield {
          event: 'message.started',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
          },
        }
        yield {
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
            assistantMessage: {
              id: 'assistant-with-party-entry',
              role: 'assistant',
              content: 'Here is the advisor summary.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
                { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
                { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
                {
                  action: 'party-mode',
                  label: 'Party Mode',
                  shortcut: 'P',
                  enabled: true,
                  description: '启动多角色顾问讨论',
                },
              ],
            },
            decisionOptions: [],
          },
        }
      })
      .mockImplementationOnce(async function* () {
        yield {
          event: 'message.started',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
          },
        }
        yield {
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
            assistantMessage: {
              id: 'assistant-party-started',
              role: 'assistant',
              content: 'Party Mode 上下文已创建。多角色顾问讨论将在后续步骤基于当前工作流继续。',
              decisionOptions: [
                {
                  action: 'return-to-workflow',
                  label: '返回原工作流',
                  enabled: true,
                  description: '返回原工作流当前步骤',
                },
              ],
              metadata: { party_mode_started: true },
            },
            decisionOptions: [],
          },
        }
      })
      .mockImplementationOnce(async function* () {
        yield {
          event: 'message.started',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
          },
        }
        yield {
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
            assistantMessage: {
              id: 'assistant-party-returned',
              role: 'assistant',
              content: '已返回原工作流。你可以继续当前步骤、深入追问或修订方向。',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
                { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
              ],
              metadata: { party_mode_returned: true },
            },
            decisionOptions: [],
          },
        }
      })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    const input = await screen.findByRole('textbox', { name: '输入你的回答' })
    await user.type(input, 'Need guidance.')
    await user.keyboard('{Enter}')
    await user.type(input, 'Draft should stay.')

    await user.click(await screen.findByRole('button', { name: /Party Mode.*快捷键 P/ }))

    await waitFor(() => {
      expect(mockStreamThinkTankSessionMessage).toHaveBeenLastCalledWith(
        'session-brainstorming',
        expect.objectContaining({
          content: '启动 Party Mode',
          decisionAction: 'party-mode',
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
    expect(await screen.findByText(/Party Mode 上下文已创建/)).toBeVisible()
    expect(input).toHaveValue('Draft should stay.')
    await user.click(screen.getByRole('button', { name: /返回原工作流/ }))
    await waitFor(() => {
      expect(mockStreamThinkTankSessionMessage).toHaveBeenLastCalledWith(
        'session-brainstorming',
        expect.objectContaining({
          content: '返回原工作流',
          decisionAction: 'return-to-workflow',
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
    expect(await screen.findByText(/已返回原工作流/)).toBeVisible()
    expect(input).toHaveValue('Draft should stay.')
    const stalePartyModeButtons = screen.getAllByRole('button', { name: /Party Mode.*快捷键 P/ })
    expect(stalePartyModeButtons[stalePartyModeButtons.length - 1]).toBeDisabled()
    expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
      '已选择：返回原工作流'
    )
  })

  test('[P0] starts Party Mode when the P shortcut is submitted from the answer input', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockStreamThinkTankSessionMessage
      .mockImplementationOnce(async function* () {
        yield {
          event: 'message.started',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
          },
        }
        yield {
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
            assistantMessage: {
              id: 'assistant-with-party-entry-shortcut',
              role: 'assistant',
              content: 'Here is the advisor summary.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
                { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
                { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
                {
                  action: 'party-mode',
                  label: 'Party Mode',
                  shortcut: 'P',
                  enabled: true,
                  description: '启动多角色顾问讨论',
                },
              ],
            },
            decisionOptions: [],
          },
        }
      })
      .mockImplementationOnce(async function* () {
        yield {
          event: 'message.started',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
          },
        }
        yield {
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
            assistantMessage: {
              id: 'assistant-party-started-shortcut',
              role: 'assistant',
              content: 'Party Mode 上下文已创建。多角色顾问讨论将在后续步骤基于当前工作流继续。',
              decisionOptions: [
                {
                  action: 'return-to-workflow',
                  label: '返回原工作流',
                  enabled: true,
                  description: '返回原工作流当前步骤',
                },
              ],
              metadata: { party_mode_started: true },
            },
            decisionOptions: [],
          },
        }
      })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    const input = await screen.findByRole('textbox', { name: '输入你的回答' })
    await user.type(input, 'Need guidance.')
    await user.keyboard('{Enter}')
    await screen.findByRole('button', { name: /Party Mode.*快捷键 P/ })

    await user.type(input, 'P')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockStreamThinkTankSessionMessage).toHaveBeenLastCalledWith(
        'session-brainstorming',
        expect.objectContaining({
          content: '启动 Party Mode',
          decisionAction: 'party-mode',
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
    expect(await screen.findByText(/Party Mode 上下文已创建/)).toBeVisible()
  })

  test('[P0][5.1-FE-002][AC1,AC2] keeps Party Mode out of standalone workflow navigation and unavailable when disabled', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    expect(
      within(workflowNav).queryByRole('button', { name: /Party Mode/ })
    ).not.toBeInTheDocument()

    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    await user.type(await screen.findByRole('textbox', { name: '输入你的回答' }), 'Need guidance.')
    await user.keyboard('{Enter}')

    const partyModeButton = await screen.findByRole('button', { name: /Party Mode.*快捷键 P/ })
    expect(partyModeButton).toBeDisabled()
    expect(screen.getByText('Party Mode 未启用；当前仍可使用单顾问流程。')).toBeVisible()
    expect(screen.getByRole('button', { name: /继续.*快捷键 C/ })).toBeEnabled()

    fireEvent.keyDown(document.body, { key: 'p' })
    expect(mockStreamThinkTankSessionMessage).toHaveBeenCalledTimes(1)
  })

  test('[P1] honors Escape and Ctrl+D shortcuts without losing focus or draft text', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))
    const input = await screen.findByRole('textbox', { name: '输入你的回答' })
    await user.type(input, 'Keep this draft.')

    await user.keyboard('{Control>}d{/Control}')
    expect(screen.getByRole('complementary', { name: '咨询文档抽屉' })).toBeVisible()
    expect(input).toHaveValue('Keep this draft.')

    await user.keyboard('{Escape}')
    expect(input).toHaveValue('Keep this draft.')
    expect(screen.getByRole('button', { name: '打开咨询文档抽屉' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByText('快捷键：Enter 提交，Shift+Enter 换行')).toBeInTheDocument()
  })

  it('prevents duplicate launch requests while a launch request is pending', async () => {
    const user = userEvent.setup()
    let resolveLaunch:
      | ((value: Awaited<ReturnType<typeof launchThinkTankWorkflow>>) => void)
      | undefined
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockLaunchThinkTankWorkflow.mockReturnValue(
      new Promise((resolve) => {
        resolveLaunch = resolve
      })
    )

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    const launchButton = await within(workflowNav).findByRole('button', {
      name: /启动 Brainstorming/,
    })
    await user.dblClick(launchButton)

    await waitFor(() => {
      within(workflowNav)
        .getAllByRole('button', { name: /启动 / })
        .forEach((button) => expect(button).toBeDisabled())
    })
    expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledTimes(1)

    resolveLaunch?.({
      sessionId: 'session-brainstorming',
      status: 'active',
      workflow: workflowCatalog[0],
      firstPrompt: '# ThinkTank Runtime Workflow: Brainstorming\n\nStart with the first prompt.',
      sourceRefs: [
        '_bmad/core/skills/bmad-brainstorming/workflow.md',
        '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
      ],
      currentStep: {
        index: 1,
        label: '当前步骤',
        sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
      },
    })
    expect(await screen.findByText(/Start with the first prompt/)).toBeInTheDocument()
  })

  it('announces launch failure with a retryable recovery message and keeps the empty conversation state', async () => {
    const user = userEvent.setup()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    mockLaunchThinkTankWorkflow.mockRejectedValueOnce(
      new Error('暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。')
    )

    renderAdvisoryRoute()

    const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
    await user.click(await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。'
    )
    expect(screen.getByRole('region', { name: 'Quick Consult' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      'Quick Consult ready'
    )
    expect(screen.queryByText(/Start with the first prompt/)).not.toBeInTheDocument()
  })

  it('shows a desktop-required state below the advisory layout minimum without rendering broken shell columns', async () => {
    installMatchMedia(ADVISORY_LAYOUT.desktopMinWidth - 1)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: ADVISORY_LAYOUT.desktopMinWidth - 1,
    })
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'ThinkTank 桌面端要求' })).toHaveTextContent(
        'ThinkTank MVP 当前需要桌面端宽屏使用'
      )
    })
    expect(screen.queryByRole('region', { name: '咨询对话工作区' })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: '咨询工作流导航' })).not.toBeInTheDocument()
  })

  it('updates the desktop gate when the advisory layout media query changes', async () => {
    const media = installMatchMedia(true)
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
    })
    const main = screen.getByRole('main')
    main.focus()
    expect(main).toHaveFocus()

    act(() => {
      media.setDesktop(false)
    })

    const desktopRequired = screen.getByRole('status', { name: 'ThinkTank 桌面端要求' })
    expect(desktopRequired).toHaveTextContent('ThinkTank MVP 当前需要桌面端宽屏使用')
    await waitFor(() => {
      expect(desktopRequired).toHaveFocus()
    })
    expect(screen.queryByRole('region', { name: '咨询对话工作区' })).not.toBeInTheDocument()
  })

  it('falls back to the desktop-required state when matchMedia is unavailable', async () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })

    renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'ThinkTank 桌面端要求' })).toHaveTextContent(
        'ThinkTank MVP 当前需要桌面端宽屏使用'
      )
    })
  })

  it('renders a friendly authorization denied state', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
    })

    renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'
      )
    })
    expect(screen.queryByRole('region', { name: '咨询对话工作区' })).not.toBeInTheDocument()
  })

  it('renders a clear disabled tenant state', async () => {
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      reason: 'module_disabled',
      message: 'ThinkTank 当前未在本租户启用，请联系管理员开通。',
    })

    renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'ThinkTank 当前未在本租户启用，请联系管理员开通。'
      )
    })
    expect(screen.queryByRole('button', { name: '打开咨询文档抽屉' })).not.toBeInTheDocument()
  })

  it('has no automated axe violations for advisory loading, denied, desktop-required, and authorized states', async () => {
    mockFetchThinkTankAccess.mockReturnValueOnce(new Promise(() => {}))
    const loading = renderAdvisoryRoute()
    expect(await axe(loading.container)).toHaveNoViolations()

    loading.unmount()
    mockFetchThinkTankAccess.mockReset()
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: false,
      module: 'thinktank',
      message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
    })
    const denied = renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(await axe(denied.container)).toHaveNoViolations()

    denied.unmount()
    mockFetchThinkTankAccess.mockReset()
    installMatchMedia(false)
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    const desktopRequired = renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'ThinkTank 桌面端要求' })).toBeInTheDocument()
    })
    expect(await axe(desktopRequired.container)).toHaveNoViolations()

    desktopRequired.unmount()
    mockFetchThinkTankAccess.mockReset()
    installMatchMedia(true)
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    const authorized = renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
    })
    expect(await axe(authorized.container)).toHaveNoViolations()

    authorized.unmount()
    mockFetchThinkTankAccess.mockReset()
    document.documentElement.classList.add('dark')
    mockFetchThinkTankAccess.mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    const darkAuthorized = renderAdvisoryRoute()

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '咨询对话工作区' })).toBeInTheDocument()
    })
    const shell = document.querySelector<HTMLElement>('[style*="--advisory-nav-height"]')
    expect(shell).not.toBeNull()
    expect(shell!).toHaveClass('bg-[hsl(var(--advisory-shell-bg))]')
    expect(screen.getByRole('banner')).toHaveClass('dark:bg-slate-950')
    expect(screen.getByRole('navigation', { name: '主导航' })).toHaveClass('dark:bg-slate-950')
    expect(await axe(darkAuthorized.container)).toHaveNoViolations()
  })
  describe('Story 2.8 live document drawer workspace integration (ATDD RED)', () => {
    beforeEach(() => {
      mockFetchThinkTankWorkflowOutput.mockReset()
      mockAppendThinkTankWorkflowOutputSection.mockReset()
      mockCompleteThinkTankSessionOutput.mockReset()
      mockDownloadThinkTankSessionOutput.mockReset()
      mockFetchThinkTankWorkflowOutput.mockResolvedValue({
        output: createStory28PageOutput([]),
      })
      mockAppendThinkTankWorkflowOutputSection.mockResolvedValue({
        output: createStory28PageOutput([createStory28PageSection()]),
        appendedSection: createStory28PageSection(),
      })
      mockCompleteThinkTankSessionOutput.mockResolvedValue({
        output: { ...createStory28PageOutput([createStory28PageSection()]), status: 'completed' },
      })
      mockDownloadThinkTankSessionOutput.mockResolvedValue({
        fileName: 'thinktank-report-session-brainstorming.md',
        format: 'markdown',
        contentType: 'text/markdown; charset=utf-8',
      })
    })

    test('[P0] loads the active report draft after workflow launch and opens the latest generated section from the collapsed trigger', async () => {
      const user = userEvent.setup()
      const latestSection = createStory28PageSection({
        id: 'section-solution',
        stepIndex: 2,
        heading: '2. 方案收敛',
        contentMarkdown: '建议优先验证企业客户的预算触发点。',
        metadata: {
          workflowKey: 'brainstorming',
          stepLabel: '方案收敛',
          provider: 'openai',
          model: 'gpt-4o-mini',
          generatedAt: '2026-05-20T08:00:00+08:00',
        },
      })
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: createStory28PageOutput([createStory28PageSection(), latestSection]),
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ })
      )

      await waitFor(() => {
        expect(mockFetchThinkTankWorkflowOutput).toHaveBeenCalledWith('session-brainstorming')
      })
      const trigger = screen.getByRole('button', { name: '打开咨询文档抽屉' })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('status', { name: '咨询文档新内容提示' })).not.toBeInTheDocument()

      await user.click(trigger)

      const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
      expect(
        within(drawer).getByRole('heading', { name: 'Brainstorming 决策报告草稿' })
      ).toBeVisible()
      expect(within(drawer).getByRole('heading', { name: '2. 方案收敛' })).toBeVisible()
      expect(within(drawer).getByText('建议优先验证企业客户的预算触发点。')).toBeVisible()
      expect(within(drawer).getAllByText('[AI Generated]').length).toBeGreaterThan(0)
      expect(within(drawer).getByText(/gpt-4o-mini/)).toBeVisible()
      expect(within(drawer).getByText(/Step 2|步骤 2/)).toBeVisible()
      expect(screen.queryByRole('status', { name: '咨询文档新内容提示' })).not.toBeInTheDocument()
    })

    test('[P0] renders backend-persisted report sections from completed advisor output', async () => {
      const user = userEvent.setup()
      const controlledStream = createControlledStream()
      const appendedSection = createStory28PageSection({
        id: 'section-completed-step',
        stepIndex: 1,
        heading: '1. 机会梳理',
        contentMarkdown: 'Advisor synthesis for the completed step.',
      })
      mockStreamThinkTankSessionMessage.mockImplementation(() => controlledStream.iterator())
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: createStory28PageOutput([]),
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, 'Summarize the first step.')
      await user.keyboard('{Enter}')

      await act(async () => {
        controlledStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤' },
            assistantMessage: {
              id: 'assistant-completed-step',
              role: 'assistant',
              content: 'Advisor synthesis for the completed step.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
            output: createStory28PageOutput([appendedSection]),
            appendedSection,
          },
        })
        controlledStream.close()
        await Promise.resolve()
      })

      expect(mockAppendThinkTankWorkflowOutputSection).not.toHaveBeenCalled()
      expect(
        screen.getByRole('status', { name: 'ThinkTank step completion status' })
      ).toHaveTextContent('1. 机会梳理已完成，报告草稿已更新。')
      expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
        '报告草稿已更新'
      )
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: '输入你的回答' })).toHaveFocus()
      )
    })

    test('[P0] persists the completed step before routing a typed continuation reply', async () => {
      const user = userEvent.setup()
      const firstStream = createControlledStream()
      const appendedSection = createStory28PageSection({
        id: 'section-problem-solving-step-1',
        stepIndex: 1,
        heading: 'Step 1: Define the problem',
        contentMarkdown: 'Step 1 synthesis that must stay in the final report.',
        metadata: {
          workflowKey: 'problem-solving',
          stepLabel: 'Step 1: Define the problem',
          provider: 'glm',
          model: 'glm-5.1',
          generatedAt: '2026-05-25T00:00:00+08:00',
        },
      })
      mockStreamThinkTankSessionMessage
        .mockImplementationOnce(() => firstStream.iterator())
        .mockImplementationOnce(async function* () {
          yield {
            event: 'message.started',
            data: {
              sessionId: 'session-problem-solving',
              currentStep: { index: 2, label: 'Step 2: Scope boundaries' },
            },
          }
          yield {
            event: 'message.completed',
            data: {
              sessionId: 'session-problem-solving',
              currentStep: { index: 2, label: 'Step 2: Scope boundaries' },
              assistantMessage: {
                id: 'assistant-problem-solving-step-2',
                role: 'assistant',
                content: 'Step 2 advisor response.',
                decisionOptions: [
                  { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
                ],
              },
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
              output: {
                ...createStory28PageOutput([appendedSection]),
                id: 'output-problem-solving',
                sessionId: 'session-problem-solving',
                workflowKey: 'problem-solving',
                title: 'Problem Solving Report Draft',
              },
              appendedSection,
            },
          }
        })
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
        sessionId: 'session-problem-solving',
        status: 'active',
        workflow: workflowCatalog[5],
        firstPrompt: 'Problem Solving workflow started.',
        sourceRefs: [
          '_bmad/cis/workflows/bmad-cis-problem-solving/workflow.md#step-1',
          '_bmad/cis/workflows/bmad-cis-problem-solving/workflow.md#step-9',
        ],
        currentStep: {
          index: 1,
          label: 'Step 1: Define the problem',
          sourceRef: '_bmad/cis/workflows/bmad-cis-problem-solving/workflow.md#step-1',
          totalSteps: 9,
        },
      })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: {
          ...createStory28PageOutput([]),
          id: 'output-problem-solving',
          sessionId: 'session-problem-solving',
          workflowKey: 'problem-solving',
          title: 'Problem Solving Report Draft',
        },
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Problem Solving/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, 'Diagnose consulting efficiency.')
      await user.keyboard('{Enter}')

      await act(async () => {
        firstStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-problem-solving',
            currentStep: {
              index: 1,
              label: 'Step 1: Define the problem',
              sourceRef: '_bmad/cis/workflows/bmad-cis-problem-solving/workflow.md#step-1',
              totalSteps: 9,
            },
            assistantMessage: {
              id: 'assistant-problem-solving-step-1',
              role: 'assistant',
              content: 'Step 1 synthesis that must stay in the final report.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
          },
        })
        firstStream.close()
        await Promise.resolve()
      })

      await user.type(input, 'c')
      await user.keyboard('{Enter}')

      await waitFor(() => expect(mockStreamThinkTankSessionMessage).toHaveBeenCalledTimes(2))
      expect(mockAppendThinkTankWorkflowOutputSection).not.toHaveBeenCalled()
      expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
        '报告草稿已更新'
      )
    })

    test('[P0] does not complete a final-step Market Research pre-synthesis prompt before generating the report', async () => {
      const user = userEvent.setup()
      const firstStream = createControlledStream()
      const appendedSection = createStory28PageSection({
        id: 'section-market-research-competitive',
        stepIndex: 6,
        heading: 'Market Research Step 6: Research Completion',
        contentMarkdown: '竞争格局分析完成。接下来进入最终环节。',
        metadata: {
          workflowKey: 'market-research',
          stepLabel: 'Market Research Step 6: Research Completion',
          provider: 'glm',
          model: 'glm-5.1',
          generatedAt: '2026-05-25T00:00:00+08:00',
        },
      })
      mockStreamThinkTankSessionMessage
        .mockImplementationOnce(() => firstStream.iterator())
        .mockImplementationOnce(async function* () {
          yield {
            event: 'message.started',
            data: {
              sessionId: 'session-market-research',
              currentStep: {
                index: 6,
                label: 'Market Research Step 6: Research Completion',
                totalSteps: 6,
                isFinal: true,
              },
            },
          }
          yield {
            event: 'message.completed',
            data: {
              sessionId: 'session-market-research',
              currentStep: {
                index: 6,
                label: 'Market Research Step 6: Research Completion',
                totalSteps: 6,
                isFinal: true,
              },
              assistantMessage: {
                id: 'assistant-market-research-final-report',
                role: 'assistant',
                content: '完整市场研究报告已经生成。',
                decisionOptions: [
                  { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
                ],
              },
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
              output: {
                ...createStory28PageOutput([appendedSection]),
                id: 'output-market-research',
                sessionId: 'session-market-research',
                workflowKey: 'market-research',
                title: 'Market Research Report Draft',
              },
              appendedSection,
            },
          }
        })
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
        sessionId: 'session-market-research',
        status: 'active',
        workflow: workflowCatalog[2],
        firstPrompt: 'Market Research workflow started.',
        sourceRefs: [
          '_bmad/bmm/workflows/1-analysis/research/bmad-market-research/steps/step-01-init.md',
          '_bmad/bmm/workflows/1-analysis/research/bmad-market-research/steps/step-06-research-completion.md',
        ],
        currentStep: {
          index: 6,
          label: 'Market Research Step 6: Research Completion',
          sourceRef:
            '_bmad/bmm/workflows/1-analysis/research/bmad-market-research/steps/step-06-research-completion.md',
          totalSteps: 6,
          isFinal: true,
        },
      })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: {
          ...createStory28PageOutput([]),
          id: 'output-market-research',
          sessionId: 'session-market-research',
          workflowKey: 'market-research',
          title: 'Market Research Report Draft',
        },
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Market Research/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, 'Research AI consulting efficiency tools.')
      await user.keyboard('{Enter}')

      await act(async () => {
        firstStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-market-research',
            currentStep: {
              index: 6,
              label: 'Market Research Step 6: Research Completion',
              sourceRef:
                '_bmad/bmm/workflows/1-analysis/research/bmad-market-research/steps/step-06-research-completion.md',
              totalSteps: 6,
              isFinal: true,
            },
            assistantMessage: {
              id: 'assistant-market-research-pre-synthesis',
              role: 'assistant',
              content:
                '**竞争格局分析完成。** 接下来进入最终环节——**战略综合与完整研究报告生成（Step 6）**。\n\n**[C]** 继续——生成完整市场研究报告',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
          },
        })
        firstStream.close()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(screen.getByText(/战略综合与完整研究报告生成/)).toBeVisible()
      })
      expect(mockCompleteThinkTankSessionOutput).not.toHaveBeenCalled()

      await user.type(input, 'C')
      await user.keyboard('{Enter}')

      await waitFor(() => expect(mockStreamThinkTankSessionMessage).toHaveBeenCalledTimes(2))
      expect(mockStreamThinkTankSessionMessage).toHaveBeenLastCalledWith(
        'session-market-research',
        expect.objectContaining({ content: 'C' }),
        expect.any(Object)
      )
      expect(mockAppendThinkTankWorkflowOutputSection).not.toHaveBeenCalled()
      expect(mockCompleteThinkTankSessionOutput).not.toHaveBeenCalled()
      expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
        '报告草稿已更新'
      )
    })

    test('[P0] completes the output only from the explicit document command', async () => {
      const user = userEvent.setup()
      const controlledStream = createControlledStream()
      const appendedSection = createStory28PageSection({
        id: 'section-final-step',
        stepIndex: 1,
        heading: '当前步骤',
        contentMarkdown: 'Final synthesis for the workflow.',
      })
      mockStreamThinkTankSessionMessage.mockImplementation(() => controlledStream.iterator())
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
        sessionId: 'session-brainstorming',
        status: 'active',
        workflow: workflowCatalog[0],
        firstPrompt: '# ThinkTank Runtime Workflow: Brainstorming\n\nStart with the first prompt.',
        sourceRefs: [
          '_bmad/core/skills/bmad-brainstorming/workflow.md',
          '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
        ],
        currentStep: {
          index: 1,
          label: '当前步骤',
          sourceRef: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
          isFinal: true,
        },
      })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: createStory28PageOutput([]),
      })
      mockCompleteThinkTankSessionOutput.mockResolvedValueOnce({
        output: {
          ...createStory28PageOutput([appendedSection]),
          status: 'completed',
        },
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, 'Finish the workflow.')
      await user.keyboard('{Enter}')

      await act(async () => {
        controlledStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-brainstorming',
            currentStep: { index: 1, label: '当前步骤', isFinal: true },
            assistantMessage: {
              id: 'assistant-final-step',
              role: 'assistant',
              content: 'Final synthesis for the workflow.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
            output: createStory28PageOutput([appendedSection]),
            appendedSection,
          },
        })
        controlledStream.close()
        await Promise.resolve()
      })

      expect(mockCompleteThinkTankSessionOutput).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: /打开咨询文档抽屉/ }))
      await user.click(await screen.findByRole('button', { name: '完成并归档工作流' }))

      await waitFor(() => {
        expect(mockCompleteThinkTankSessionOutput).toHaveBeenCalledWith('session-brainstorming', {
          outcome: 'success',
        })
      })
      expect(
        screen.getByRole('status', { name: 'ThinkTank step completion status' })
      ).toHaveTextContent('工作流已完成，报告草稿已归档。')
      await waitFor(() => expect(input).toHaveFocus())
    })

    test('[P0] renders a backend-saved final Storytelling response without auto-completing', async () => {
      const user = userEvent.setup()
      const controlledStream = createControlledStream()
      const appendedSection = createStory28PageSection({
        id: 'section-storytelling-final',
        stepIndex: 10,
        heading: 'Step 10: Generate final output',
        contentMarkdown: 'Story complete. Your narrative has been saved.',
        metadata: {
          workflowKey: 'storytelling',
          stepLabel: 'Step 10: Generate final output',
          provider: 'glm',
          model: 'glm-5.1',
          generatedAt: '2026-05-25T00:00:00+08:00',
        },
      })
      const storytellingDraft = {
        ...createStory28PageOutput([appendedSection]),
        id: 'output-storytelling',
        sessionId: 'session-storytelling',
        workflowKey: 'storytelling',
        title: 'Storytelling 决策报告草稿',
      }

      mockStreamThinkTankSessionMessage.mockImplementation(() => controlledStream.iterator())
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
        sessionId: 'session-storytelling',
        status: 'active',
        workflow: workflowCatalog[7],
        firstPrompt: 'Storytelling workflow started.',
        sourceRefs: [
          '_bmad/cis/workflows/bmad-cis-storytelling/workflow.md#step-1',
          '_bmad/cis/workflows/bmad-cis-storytelling/workflow.md#step-10',
        ],
        currentStep: {
          index: 10,
          label: 'Step 10: Generate final output',
          sourceRef: '_bmad/cis/workflows/bmad-cis-storytelling/workflow.md#step-10',
          totalSteps: 10,
          isFinal: true,
        },
      })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: {
          ...createStory28PageOutput([]),
          id: 'output-storytelling',
          sessionId: 'session-storytelling',
          workflowKey: 'storytelling',
          title: 'Storytelling 决策报告草稿',
        },
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Storytelling/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, '全部确认')
      await user.keyboard('{Enter}')

      await act(async () => {
        controlledStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-storytelling',
            currentStep: {
              index: 10,
              label: 'Step 10: Generate final output',
              sourceRef: '_bmad/cis/workflows/bmad-cis-storytelling/workflow.md#step-10',
              totalSteps: 10,
              isFinal: true,
            },
            assistantMessage: {
              id: 'assistant-storytelling-final',
              role: 'assistant',
              content: 'Story complete. Your narrative has been saved.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
            output: storytellingDraft,
            appendedSection,
          },
        })
        controlledStream.close()
        await Promise.resolve()
      })

      expect(mockAppendThinkTankWorkflowOutputSection).not.toHaveBeenCalled()
      expect(mockCompleteThinkTankSessionOutput).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(
          screen.getByRole('status', { name: 'ThinkTank step completion status' })
        ).toHaveTextContent('Step 10: Generate final output已完成，报告草稿已更新。')
      )
    })

    test('[P0] keeps a final-step Product Brief session active when the advisor still asks for Y/M/C confirmation', async () => {
      const user = userEvent.setup()
      const firstStream = createControlledStream()
      const confirmationStream = createControlledStream()
      const finalSection = createStory28PageSection({
        id: 'section-product-brief-complete',
        stepIndex: 6,
        heading: 'Step 6: Product Brief Completion',
        contentMarkdown: 'Product Brief Complete. Your brief is ready.',
        metadata: {
          workflowKey: 'product-brief',
          stepLabel: 'Step 6: Product Brief Completion',
          provider: 'glm',
          model: 'glm-5.1',
          generatedAt: '2026-05-25T00:00:00+08:00',
        },
      })
      const productBriefDraft = {
        ...createStory28PageOutput([]),
        id: 'output-product-brief',
        sessionId: 'session-product-brief',
        workflowKey: 'product-brief',
        title: 'Product Brief 决策报告草稿',
      }

      mockStreamThinkTankSessionMessage
        .mockImplementationOnce(() => firstStream.iterator())
        .mockImplementationOnce(() => confirmationStream.iterator())
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockLaunchThinkTankWorkflow.mockResolvedValueOnce({
        sessionId: 'session-product-brief',
        status: 'active',
        workflow: workflowCatalog[3],
        firstPrompt: 'Product Brief workflow started.',
        sourceRefs: [
          '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/workflow.md',
          '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-06-complete.md',
        ],
        currentStep: {
          index: 6,
          label: 'Step 6: Product Brief Completion',
          sourceRef:
            '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-06-complete.md',
          totalSteps: 6,
          isFinal: true,
        },
      })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: productBriefDraft,
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Product Brief/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, 'c')
      await user.keyboard('{Enter}')

      await act(async () => {
        firstStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-product-brief',
            currentStep: {
              index: 6,
              label: 'Step 6: Product Brief Completion',
              sourceRef:
                '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-06-complete.md',
              totalSteps: 6,
              isFinal: true,
            },
            assistantMessage: {
              id: 'assistant-product-brief-awaiting-confirmation',
              role: 'assistant',
              content:
                '我整理了一版简报草稿。\n\n🎯 请选择：\n• **[Y]** 这版OK，继续完成简报\n• **[M]** 我有修改意见\n• **[C]** 直接推进，完成简报',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
          },
        })
        firstStream.close()
        await Promise.resolve()
      })

      expect(await screen.findByText(/这版OK，继续完成简报/)).toBeVisible()
      expect(mockAppendThinkTankWorkflowOutputSection).not.toHaveBeenCalled()
      expect(mockCompleteThinkTankSessionOutput).not.toHaveBeenCalled()

      await user.type(input, 'Y')
      await user.keyboard('{Enter}')

      await waitFor(() => expect(mockStreamThinkTankSessionMessage).toHaveBeenCalledTimes(2))
      expect(mockStreamThinkTankSessionMessage).toHaveBeenLastCalledWith(
        'session-product-brief',
        expect.objectContaining({ content: 'Y' }),
        expect.any(Object)
      )

      await act(async () => {
        confirmationStream.push({
          event: 'message.completed',
          data: {
            sessionId: 'session-product-brief',
            currentStep: {
              index: 6,
              label: 'Step 6: Product Brief Completion',
              sourceRef:
                '_bmad/bmm/workflows/1-analysis/bmad-create-product-brief/steps/step-06-complete.md',
              totalSteps: 6,
              isFinal: true,
            },
            assistantMessage: {
              id: 'assistant-product-brief-final',
              role: 'assistant',
              content: 'Product Brief Complete. Your brief is ready.',
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
            },
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
            output: {
              ...productBriefDraft,
              sections: [finalSection],
              contentMarkdown: finalSection.contentMarkdown,
            },
            appendedSection: finalSection,
          },
        })
        confirmationStream.close()
        await Promise.resolve()
      })

      expect(mockAppendThinkTankWorkflowOutputSection).not.toHaveBeenCalled()
      expect(mockCompleteThinkTankSessionOutput).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(
          screen.getByRole('status', { name: 'ThinkTank step completion status' })
        ).toHaveTextContent('Step 6: Product Brief Completion已完成，报告草稿已更新。')
      )
    })

    test('[P0] scrolls the open drawer to newly appended content without moving conversation input focus', async () => {
      const user = userEvent.setup()
      const controlledStream = createControlledStream()
      const firstSection = createStory28PageSection()
      const appendedSection = createStory28PageSection({
        id: 'section-solution',
        stepIndex: 2,
        heading: '2. 方案收敛',
        contentMarkdown: '第二步报告内容已经写入草稿。',
      })
      const scrollIntoView = jest.fn()
      const originalScrollIntoView = Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView =
        scrollIntoView as unknown as typeof Element.prototype.scrollIntoView

      try {
        mockStreamThinkTankSessionMessage.mockImplementation(() => controlledStream.iterator())
        mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
        mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
          output: createStory28PageOutput([firstSection]),
        })

        renderAdvisoryRoute()

        const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
        await user.click(
          await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ })
        )
        await user.click(screen.getByRole('button', { name: /打开咨询文档抽屉/ }))
        const input = await screen.findByRole('textbox', { name: '输入你的回答' })
        await user.type(input, 'Complete step two.')
        await user.keyboard('{Enter}')

        await act(async () => {
          controlledStream.push({
            event: 'message.completed',
            data: {
              sessionId: 'session-brainstorming',
              currentStep: { index: 2, label: '方案收敛' },
              assistantMessage: {
                id: 'assistant-step-two',
                role: 'assistant',
                content: '第二步报告内容已经写入草稿。',
                decisionOptions: [
                  { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
                ],
              },
              decisionOptions: [
                { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
              ],
              output: createStory28PageOutput([firstSection, appendedSection]),
              appendedSection,
            },
          })
          controlledStream.close()
          await Promise.resolve()
        })

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
        const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
        expect(within(drawer).getByRole('heading', { name: '2. 方案收敛' })).toBeVisible()
        expect(within(drawer).getByText('第二步报告内容已经写入草稿。')).toBeVisible()
        expect(input).toHaveFocus()
      } finally {
        Element.prototype.scrollIntoView = originalScrollIntoView
      }
    })

    test('[P1] toggles the drawer with Ctrl+D, closes it with Escape, and preserves the conversation draft', async () => {
      const user = userEvent.setup()
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: createStory28PageOutput([createStory28PageSection()]),
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.type(input, 'Keep this draft.')

      await user.keyboard('{Control>}d{/Control}')
      expect(screen.getByRole('complementary', { name: '咨询文档抽屉' })).toBeVisible()
      expect(input).toHaveFocus()
      expect(input).toHaveValue('Keep this draft.')

      await user.keyboard('{Escape}')
      expect(screen.getByRole('button', { name: /打开咨询文档抽屉/ })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      expect(input).toHaveFocus()
      expect(input).toHaveValue('Keep this draft.')
    })

    test('[P0] exports the drawer report with a success toast without closing the workflow', async () => {
      const user = userEvent.setup()
      mockFetchThinkTankAccess.mockResolvedValue({ allowed: true, module: 'thinktank' })
      mockFetchThinkTankWorkflowOutput.mockResolvedValueOnce({
        output: createStory28PageOutput([createStory28PageSection()]),
      })

      renderAdvisoryRoute()

      const workflowNav = await screen.findByRole('navigation', { name: '咨询工作流' })
      await user.click(
        await within(workflowNav).findByRole('button', { name: /启动 Brainstorming/ })
      )
      const input = await screen.findByRole('textbox', { name: '输入你的回答' })
      await user.click(screen.getByRole('button', { name: /打开咨询文档抽屉/ }))
      await user.click(screen.getByRole('button', { name: /导出 Markdown/ }))

      await waitFor(() => {
        expect(mockDownloadThinkTankSessionOutput).toHaveBeenCalledWith(
          'session-brainstorming',
          'markdown'
        )
      })
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Markdown 已导出：thinktank-report-session-brainstorming.md'
      )
      expect(screen.getByRole('complementary', { name: '咨询文档抽屉' })).toBeVisible()
      await waitFor(() => expect(input).toHaveFocus())
    })
  })
})
