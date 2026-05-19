import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useSession } from 'next-auth/react'
import AdvisoryLayout from '../layout'
import AdvisoryPage from '../page'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import {
  fetchThinkTankWorkflows,
  fetchThinkTankSessionMessages,
  launchThinkTankWorkflow,
  sendThinkTankSessionMessage,
} from '@/lib/advisory/workflows'
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
  fetchThinkTankSessionMessages: jest.fn(),
  launchThinkTankWorkflow: jest.fn(),
  sendThinkTankSessionMessage: jest.fn(),
}))

jest.mock('@/lib/advisory/streaming', () => ({
  THINKTANK_STREAM_ERROR_MESSAGE: 'ThinkTank streaming response was malformed. Please retry.',
  streamThinkTankSessionMessage: jest.fn(),
}))

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
    mockPush.mockReset()
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
          { action: 'party-mode', label: 'Party Mode', shortcut: 'P', enabled: false },
        ],
      },
      stream: [{ index: 0, delta: 'Here is the advisor summary.', done: true }],
      decisionOptions: [
        { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
        { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
        { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
        { action: 'party-mode', label: 'Party Mode', shortcut: 'P', enabled: false },
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
              { action: 'party-mode', label: 'Party Mode', shortcut: 'P', enabled: false },
            ],
          },
          decisionOptions: [
            { action: 'continue', label: '继续', shortcut: 'C', enabled: true },
            { action: 'deepen', label: '深入', shortcut: 'A', enabled: true },
            { action: 'revise', label: '修订', shortcut: 'R', enabled: true },
            { action: 'party-mode', label: 'Party Mode', shortcut: 'P', enabled: false },
          ],
        },
      }
    })
  })

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
    expect(screen.getByRole('button', { name: '展开咨询文档抽屉' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByText('选择一个工作流后，对话将在这里开始。')).toBeInTheDocument()
    expect(screen.getByText('文档')).toBeInTheDocument()
    expect(screen.queryByText('咨询工作台暂未开放')).not.toBeInTheDocument()
    expect(
      screen.queryByText('ThinkTank 模块已启用入口，完整咨询工作台将在后续版本开放。')
    ).not.toBeInTheDocument()
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
    const readingSurface = screen.getByRole('heading', { name: '等待开始咨询' }).parentElement

    expect(readingSurface).toHaveClass('max-w-lg', 'text-sm', 'leading-6')
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
      'data-reading-density',
      'default'
    )

    await user.click(within(densityControl).getByRole('radio', { name: '紧凑' }))
    expect(readingSurface).toHaveClass('max-w-md', 'text-[13px]', 'leading-5')
    expect(screen.getByRole('region', { name: '咨询对话工作区' })).toHaveAttribute(
      'data-reading-density',
      'compact'
    )

    await user.click(within(densityControl).getByRole('radio', { name: '舒适' }))
    expect(readingSurface).toHaveClass('max-w-xl', 'text-base', 'leading-7')
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
      'ThinkTank 已启用。暂无活动会话。等待开始咨询。咨询文档抽屉为空。'
    )
    expect(screen.getByText('已启用')).toBeInTheDocument()
    expect(screen.getByText('暂无活动会话')).toBeInTheDocument()
    expect(screen.getByText('等待开始咨询')).toBeInTheDocument()
    expect(screen.getByText('暂无文档')).toBeInTheDocument()
    expect(screen.getByText('报告草稿接入后开放')).toBeInTheDocument()
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
      expect(within(workflowNav).getByText(workflow.displayName)).toBeInTheDocument()
      expect(within(workflowNav).getByText(workflow.scenarioLabel)).toBeInTheDocument()
      expect(
        within(workflowNav).getByRole('button', {
          name: new RegExp(`启动 ${workflow.displayName}`),
        })
      ).toBeEnabled()
    })
    expect(within(workflowNav).getAllByRole('button', { name: /启动 / })).toHaveLength(8)
    expect(screen.queryByText('待接入')).not.toBeInTheDocument()
    expect(screen.queryByText('结构化咨询')).not.toBeInTheDocument()

    const drawerButton = screen.getByRole('button', { name: '展开咨询文档抽屉' })
    expect(drawerButton).toHaveAttribute('aria-disabled', 'true')
    expect(drawerButton).toHaveAccessibleDescription('文档抽屉将在报告草稿接入后开放')
    expect(drawerButton).toHaveAttribute('title', '文档抽屉将在报告草稿接入后开放')
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

    expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('brainstorming')
    expect(await screen.findByText(/Start with the first prompt/)).toBeInTheDocument()
    const stepper = screen.getByRole('list', { name: '工作流当前步骤' })
    expect(within(stepper).getByText('当前步骤')).toBeInTheDocument()
    expect(within(stepper).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('下一步骤')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
      '活动会话：Brainstorming'
    )
    within(workflowNav)
      .getAllByRole('button', { name: /启动 / })
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

    document.body.focus()
    await user.keyboard('c')
    expect(screen.getByRole('status', { name: 'ThinkTank 工作台状态' })).toHaveTextContent(
      '已选择：继续'
    )
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
    expect(screen.getByRole('button', { name: '展开咨询文档抽屉' })).toHaveAccessibleDescription(
      '文档抽屉将在报告草稿接入后开放'
    )
    expect(input).toHaveValue('Keep this draft.')

    await user.keyboard('{Escape}')
    expect(input).toHaveValue('Keep this draft.')
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
    expect(screen.getByText('等待开始咨询')).toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: '展开咨询文档抽屉' })).not.toBeInTheDocument()
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
})
