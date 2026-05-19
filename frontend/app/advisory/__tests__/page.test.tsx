import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useSession } from 'next-auth/react'
import AdvisoryLayout from '../layout'
import AdvisoryPage from '../page'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'
import { fetchThinkTankAccess } from '@/lib/advisory/access'
import { fetchThinkTankWorkflows, launchThinkTankWorkflow } from '@/lib/advisory/workflows'
import { useRadarUnreadCount } from '@/lib/hooks/useRadarUnreadCount'

expect.extend(toHaveNoViolations)

jest.mock('@/lib/advisory/access', () => ({
  canAccessThinkTank: jest.fn(() => true),
  fetchThinkTankAccess: jest.fn(),
  THINKTANK_ACCESS_DENIED_MESSAGE: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
}))

jest.mock('@/lib/advisory/workflows', () => ({
  fetchThinkTankWorkflows: jest.fn(),
  launchThinkTankWorkflow: jest.fn(),
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

describe('AdvisoryPage', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockFetchThinkTankWorkflows = fetchThinkTankWorkflows as jest.MockedFunction<
    typeof fetchThinkTankWorkflows
  >
  const mockLaunchThinkTankWorkflow = launchThinkTankWorkflow as jest.MockedFunction<
    typeof launchThinkTankWorkflow
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
