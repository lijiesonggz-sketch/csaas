import { render, screen, waitFor, within } from '@testing-library/react'
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

const mockStartQuickConsult = jest.fn()
const mockSaveQuickConsultDraft = jest.fn()

function configureQuickConsultClientMock() {
  jest.doMock(
    '@/lib/advisory/quick-consult',
    () => ({
      QUICK_CONSULT_PROBLEM_MAX_LENGTH: 5000,
      QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE: '请先描述你要咨询的问题。',
      QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE: '问题描述过长，请精简到 5000 字以内。',
      startQuickConsult: (...args: unknown[]) => mockStartQuickConsult(...args),
      saveQuickConsultDraft: (...args: unknown[]) => mockSaveQuickConsultDraft(...args),
    }),
    { virtual: true }
  )
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

function installDesktopViewport() {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: /\(min-width:\s*1024px\)/.test(query) || /\(min-width:\s*1180px\)/.test(query),
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

describe('Story 3.1 quick-consult-problem-intake frontend acceptance tests (ATDD RED)', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockUseSession = useSession as jest.Mock
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.MockedFunction<
    typeof useRadarUnreadCount
  >

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
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
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })
    mockStartQuickConsult.mockResolvedValue({
      consultId: 'quick-consult-1',
      status: 'clarification_required',
      originalProblem: 'We need AI strategy help.',
      clarificationQuestions: ['What business outcome matters most?'],
      provider: 'openai',
      model: 'gpt-4o-mini',
      operationalStatus: 'Provider connected. Responses may take up to 5 minutes.',
    })
  })

  test.skip('[P0] renders Quick Consult problem intake with a free-text textarea and accessible submit action', async () => {
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    const workspace = await screen.findByRole('region', { name: '咨询对话工作区' })
    const quickConsult = within(workspace).getByRole('region', { name: 'Quick Consult' })
    expect(within(quickConsult).getByRole('heading', { name: 'Quick Consult' })).toBeInTheDocument()
    expect(
      within(quickConsult).getByRole('textbox', { name: 'Describe the problem' })
    ).toHaveAttribute('aria-multiline', 'true')
    expect(within(quickConsult).getByRole('button', { name: 'Start quick consult' })).toBeEnabled()
  })

  test.skip('[P0] preserves the problem draft when the consultant leaves and returns to Quick Consult', async () => {
    const user = userEvent.setup()
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    const input = await screen.findByRole('textbox', { name: 'Describe the problem' })
    await user.type(input, 'Our compliance workflow is too slow for enterprise sales.')
    await user.click(screen.getByRole('button', { name: /启动 Brainstorming/ }))
    await user.click(screen.getByRole('button', { name: 'Quick Consult' }))

    expect(screen.getByRole('textbox', { name: 'Describe the problem' })).toHaveValue(
      'Our compliance workflow is too slow for enterprise sales.'
    )
    expect(mockSaveQuickConsultDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        problem: 'Our compliance workflow is too slow for enterprise sales.',
      })
    )
  })

  test.skip('[P0] blocks empty and over-limit problem submissions with inline validation without calling the client', async () => {
    const user = userEvent.setup()
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.click(await screen.findByRole('button', { name: 'Start quick consult' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请先描述你要咨询的问题。')
    expect(mockStartQuickConsult).not.toHaveBeenCalled()

    const input = screen.getByRole('textbox', { name: 'Describe the problem' })
    await user.type(input, 'x'.repeat(5001))
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    expect(screen.getByRole('alert')).toHaveTextContent('问题描述过长，请精简到 5000 字以内。')
    expect(mockStartQuickConsult).not.toHaveBeenCalled()
  })

  test.skip('[P0] announces submit pending state and disables duplicate submission while intake is processing', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockReturnValue(new Promise(() => {}))
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'We need to reduce onboarding friction for a security compliance product.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    expect(screen.getByRole('button', { name: 'Starting quick consult' })).toBeDisabled()
    expect(screen.getByRole('status', { name: 'Quick Consult status' })).toHaveTextContent(
      'Preparing consultant intake'
    )
    expect(mockStartQuickConsult).toHaveBeenCalledTimes(1)
  })

  test.skip('[P0] shows one or two clarification questions for a vague problem while preserving the original problem', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      consultId: 'quick-consult-clarifying',
      status: 'clarification_required',
      originalProblem: 'Help me with AI.',
      clarificationQuestions: [
        'What business decision are you trying to make?',
        'Who will use it?',
      ],
      provider: 'openai',
      model: 'gpt-4o-mini',
      operationalStatus: 'Provider connected. Clarification is ready.',
    })
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'Help me with AI.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const clarification = await screen.findByRole('region', {
      name: 'Quick Consult clarification questions',
    })
    expect(within(clarification).getByText('Original problem: Help me with AI.')).toBeVisible()
    const questions = within(clarification).getAllByRole('listitem')
    expect(questions).toHaveLength(2)
    expect(questions[0]).toHaveTextContent('What business decision are you trying to make?')
    expect(questions[1]).toHaveTextContent('Who will use it?')
  })

  test.skip('[P0] starts the 5-minute analysis path for a clear problem and shows provider plus latency-safe operational status', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      consultId: 'quick-consult-analysis',
      status: 'analysis_started',
      originalProblem:
        'Assess whether we should launch an ISO 27001 readiness package for Series B SaaS companies.',
      clarificationQuestions: [],
      analysisWindowMinutes: 5,
      provider: 'openai',
      model: 'gpt-4o-mini',
      operationalStatus:
        'OpenAI connected. Analysis can take up to 5 minutes; you can keep working.',
    })
    configureQuickConsultClientMock()
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
    expect(screen.getByText(/you can keep working/)).toBeVisible()
  })
})

describe('Story 3.2 problem-type detection and scenario language frontend acceptance tests (ATDD RED)', () => {
  test.skip('[P0][AC1] displays problem-type classifications with user-facing scenario language after Quick Consult analysis', async () => {
    // RED intent: analysis_started renders a "Quick Consult problem types" region
    // with classification labels and business scenario copy.
  })

  test.skip('[P0][AC1] renders multiple classifications for strategy budget architecture input without showing method recommendation cards', async () => {
    // RED intent: Story 3.2 may show multiple problem types but must not render
    // Story 3.3 recommendation card actions such as accepting a method.
  })

  test.skip('[P0][AC2] treats low-confidence classification as uncertain and offers clarification plus manual browsing', async () => {
    // RED intent: low-confidence results show clarification questions and a manual
    // workflow browsing alternative instead of confident recommendations.
  })

  test.skip('[P1][AC2] preserves original problem context while continuing from low-confidence clarification', async () => {
    // RED intent: clarification continuation keeps the original problem context
    // and appends only whitelisted clarification answers.
  })

  test.skip('[P1][AC3] consumes structured classification metadata without exposing raw sensitive problem text outside the consult context', async () => {
    // RED intent: frontend contract consumes structured classification fields;
    // backend tests own persistence and telemetry privacy.
  })
})

describe('Story 3.3 method recommendations with rationale frontend acceptance tests (ATDD RED)', () => {
  const mockFetchThinkTankAccess = fetchThinkTankAccess as jest.MockedFunction<
    typeof fetchThinkTankAccess
  >
  const mockUseSession = useSession as jest.Mock
  const mockUseRadarUnreadCount = useRadarUnreadCount as jest.MockedFunction<
    typeof useRadarUnreadCount
  >

  beforeEach(() => {
    jest.clearAllMocks()
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
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    const workflows = jest.requireMock('@/lib/advisory/workflows')
    workflows.fetchThinkTankWorkflows.mockResolvedValue({
      workflows: [
        {
          key: 'brainstorming',
          displayName: 'Brainstorming',
          canonicalName: 'Brainstorming',
          scenarioLabel: 'Generate options',
          description: 'Explore alternatives quickly.',
          sourcePath: 'bmad-cis-brainstorming/SKILL.md',
        },
        {
          key: 'problem-solving',
          displayName: 'Problem Solving',
          canonicalName: 'Problem Solving',
          scenarioLabel: 'Diagnose root causes',
          description: 'Structure root-cause analysis.',
          sourcePath: 'bmad-cis-problem-solving/SKILL.md',
        },
        {
          key: 'design-thinking',
          displayName: 'Design Thinking',
          canonicalName: 'Design Thinking',
          scenarioLabel: 'Human-centered discovery',
          description: 'Clarify users, pains, and solution framing.',
          sourcePath: 'bmad-cis-design-thinking/SKILL.md',
        },
        {
          key: 'domain-research',
          displayName: 'Domain Research',
          canonicalName: 'Domain Research',
          scenarioLabel: 'Understand a domain',
          description: 'Research unfamiliar domain context.',
          sourcePath: 'bmad-domain-research/SKILL.md',
        },
        {
          key: 'market-research',
          displayName: 'Market Research',
          canonicalName: 'Market Research',
          scenarioLabel: 'Analyze market and customers',
          description: 'Research competitors and customer segments.',
          sourcePath: 'bmad-market-research/SKILL.md',
        },
        {
          key: 'product-brief',
          displayName: 'Product Brief',
          canonicalName: 'Product Brief',
          scenarioLabel: 'Frame product direction',
          description: 'Create concise product framing.',
          sourcePath: 'bmad-create-product-brief/SKILL.md',
        },
        {
          key: 'prd',
          displayName: 'PRD',
          canonicalName: 'PRD',
          scenarioLabel: 'Write requirements',
          description: 'Create a product requirements document.',
          sourcePath: 'bmad-create-prd/SKILL.md',
        },
        {
          key: 'storytelling',
          displayName: 'Storytelling',
          canonicalName: 'Storytelling',
          scenarioLabel: 'Craft narrative',
          description: 'Shape stakeholder narrative.',
          sourcePath: 'bmad-cis-storytelling/SKILL.md',
        },
      ],
    })
    workflows.launchThinkTankWorkflow.mockResolvedValue({
      sessionId: 'session-from-recommendation',
      workflow: {
        key: 'problem-solving',
        displayName: 'Problem Solving',
        canonicalName: 'Problem Solving',
        scenarioLabel: 'Diagnose root causes',
        sourcePath: 'bmad-cis-problem-solving/SKILL.md',
      },
      status: 'active',
      sourceRefs: ['bmad-cis-problem-solving/SKILL.md'],
      firstPrompt:
        'We will start from the Quick Consult context instead of asking you to re-enter the problem.',
      currentStep: {
        index: 1,
        label: 'Frame the problem',
        sourceRef: 'bmad-cis-problem-solving/SKILL.md',
        totalSteps: 5,
      },
    })
    workflows.fetchThinkTankSessionMessages.mockResolvedValue({
      sessionId: 'session-from-recommendation',
      currentStep: {
        index: 1,
        label: 'Frame the problem',
        sourceRef: 'bmad-cis-problem-solving/SKILL.md',
        totalSteps: 5,
      },
      messages: [],
    })
  })

  test.skip('[P0][3.3-UI-001] renders a Quick Consult recommendations region with two to three method cards after confident analysis', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-context-33',
      consultId: 'quick-consult-context-33',
      status: 'analysis_started',
      originalProblem:
        'We need to decide how to package ISO 27001 readiness consulting for Series B SaaS customers.',
      classification: {
        confidence: 0.86,
        confidenceLevel: 'high',
        primaryProblemType: 'strategy',
        scenarioLanguage: {
          label: 'Strategy decision with customer discovery risk',
          summary: 'The problem asks for a market-facing packaging decision with evidence gaps.',
          guidance: 'Choose a method that quickly tests assumptions before drafting requirements.',
        },
        problemTypes: [
          {
            id: 'strategy',
            label: 'Strategy',
            confidence: 0.86,
            scenarioLanguage: 'Strategy decision',
          },
        ],
      },
      recommendations: [
        {
          id: 'rec-problem-solving',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          fitScenario: 'Best when the decision depends on root causes and constraints.',
          expectedDuration: '25-35 minutes',
          expectedOutput: 'Problem frame, root causes, and decision options.',
          primaryRationale:
            'The input has a clear business decision and multiple unknown constraints.',
          sourceRefs: ['workflow:problem-solving', 'method:root-cause-analysis'],
        },
        {
          id: 'rec-market-research',
          workflowKey: 'market-research',
          methodName: 'Market Research',
          fitScenario: 'Best when market evidence is missing.',
          expectedDuration: '30-45 minutes',
          expectedOutput: 'Customer segment and competitor evidence map.',
          primaryRationale: 'The package decision needs external market validation.',
          sourceRefs: ['workflow:market-research', 'method:competitor-scan'],
        },
      ],
    })
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'We need to decide how to package ISO 27001 readiness consulting for Series B SaaS customers.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    const cards = within(recommendations).getAllByRole('article')
    expect(cards.length).toBeGreaterThanOrEqual(2)
    expect(cards.length).toBeLessThanOrEqual(3)
    expect(within(cards[0]).getByRole('heading', { name: 'Problem Solving' })).toBeVisible()
    expect(within(cards[1]).getByRole('heading', { name: 'Market Research' })).toBeVisible()
  })

  test.skip('[P0][3.3-UI-002] shows every recommendation card field needed to choose a method', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-context-card-fields',
      status: 'analysis_started',
      originalProblem:
        'Our enterprise onboarding process is slow and we need a better method to diagnose it.',
      classification: {
        confidence: 0.82,
        confidenceLevel: 'high',
        primaryProblemType: 'process',
        scenarioLanguage: {
          label: 'Process improvement scenario',
          summary: 'The issue is an operational process bottleneck.',
          guidance: 'Use a method that exposes root causes and next actions.',
        },
        problemTypes: [
          {
            id: 'process',
            label: 'Process',
            confidence: 0.82,
            scenarioLanguage: 'Operational bottleneck',
          },
        ],
      },
      recommendations: [
        {
          id: 'rec-process-problem-solving',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          fitScenario: 'Use this when the team sees symptoms but not the real bottleneck.',
          expectedDuration: '25-35 minutes',
          expectedOutput: 'Root-cause tree, constraint list, and prioritized experiments.',
          primaryRationale:
            'The problem is specific enough to analyze causes before picking a solution.',
          sourceRefs: ['workflow:problem-solving', 'method:root-cause-tree'],
        },
      ],
    })
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'Our enterprise onboarding process is slow and we need a better method to diagnose it.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    const card = within(recommendations).getByRole('article', { name: /Problem Solving/ })
    expect(within(card).getByRole('heading', { name: 'Problem Solving' })).toBeVisible()
    expect(
      within(card).getByText('Use this when the team sees symptoms but not the real bottleneck.')
    ).toBeVisible()
    expect(within(card).getByText('25-35 minutes')).toBeVisible()
    expect(
      within(card).getByText('Root-cause tree, constraint list, and prioritized experiments.')
    ).toBeVisible()
    expect(
      within(card).getByText(
        'The problem is specific enough to analyze causes before picking a solution.'
      )
    ).toBeVisible()
    expect(within(card).getByText('workflow:problem-solving')).toBeVisible()
    expect(within(card).getByText('method:root-cause-tree')).toBeVisible()
  })

  test.skip('[P1][3.3-UI-003] expands why-this-method rationale in plain language without exposing prompt or provider internals', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-context-rationale',
      status: 'analysis_started',
      originalProblem:
        'We need a human-centered way to validate a new compliance dashboard concept.',
      classification: {
        confidence: 0.8,
        confidenceLevel: 'high',
        primaryProblemType: 'innovation',
        scenarioLanguage: {
          label: 'Innovation discovery scenario',
          summary: 'The input asks to validate a user-facing concept.',
          guidance: 'Use a method that connects users, pains, and solution shape.',
        },
        problemTypes: [
          {
            id: 'innovation',
            label: 'Innovation',
            confidence: 0.8,
            scenarioLanguage: 'Concept validation',
          },
        ],
      },
      recommendations: [
        {
          id: 'rec-design-thinking',
          workflowKey: 'design-thinking',
          methodName: 'Design Thinking',
          fitScenario: 'Use this when user needs and adoption risks are central.',
          expectedDuration: '30-45 minutes',
          expectedOutput: 'User assumptions, pain points, and prototype direction.',
          primaryRationale: 'The issue depends on user behavior, not just feature scope.',
          expandedRationale:
            'This method fits because the next decision is about who will use the dashboard, what pain they feel, and what evidence would make the concept worth building.',
          sourceRefs: ['workflow:design-thinking', 'method:empathy-map'],
        },
      ],
    })
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'We need a human-centered way to validate a new compliance dashboard concept.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    await user.click(within(recommendations).getByRole('button', { name: /why this method/i }))

    expect(
      within(recommendations).getByText(
        'This method fits because the next decision is about who will use the dashboard, what pain they feel, and what evidence would make the concept worth building.'
      )
    ).toBeVisible()
    expect(
      within(recommendations).queryByText(
        /system prompt|raw prompt|provider|model|gpt|claude|temperature|token/i
      )
    ).not.toBeInTheDocument()
  })

  test.skip('[P0][3.3-UI-004] low-confidence classification shows no recommendation cards and keeps clarification plus manual browsing paths', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-low-confidence',
      consultId: 'quick-consult-low-confidence',
      status: 'clarification_required',
      originalProblem: 'Help with growth and architecture and budget.',
      clarificationQuestions: [
        'Which decision do you need to make first?',
        'What constraint makes this urgent?',
      ],
      classification: {
        confidence: 0.38,
        confidenceLevel: 'low',
        primaryProblemType: 'strategy',
        manualBrowseHint:
          'The signal is unclear. Answer the clarification questions or browse workflows manually.',
        scenarioLanguage: {
          label: 'Unclear mixed scenario',
          summary:
            'The problem combines strategy, architecture, and budget without a clear first decision.',
          guidance: 'Clarify the decision boundary before choosing a method.',
        },
        problemTypes: [
          {
            id: 'strategy',
            label: 'Strategy',
            confidence: 0.38,
            scenarioLanguage: 'Mixed strategy signal',
          },
        ],
      },
      recommendations: [],
    })
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'Help with growth and architecture and budget.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    expect(
      screen.queryByRole('region', { name: 'Quick Consult recommendations' })
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole('region', { name: 'Quick Consult clarification questions' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '浏览工作流' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: '咨询工作流' })).toBeVisible()
  })

  test.skip('[P0][3.3-UI-005] accepting a recommendation launches the existing workflow with Quick Consult context and does not ask to re-enter the problem', async () => {
    const user = userEvent.setup()
    const workflows = jest.requireMock('@/lib/advisory/workflows')
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-context-accept',
      consultId: 'quick-consult-context-accept',
      status: 'analysis_started',
      originalProblem:
        'We need to decide whether to build an AI compliance questionnaire generator for existing customers.',
      classification: {
        confidence: 0.84,
        confidenceLevel: 'high',
        primaryProblemType: 'strategy',
        scenarioLanguage: {
          label: 'Strategy and product framing scenario',
          summary: 'The input asks for a product investment decision.',
          guidance: 'Use a workflow that starts from the captured context.',
        },
        problemTypes: [
          {
            id: 'strategy',
            label: 'Strategy',
            confidence: 0.84,
            scenarioLanguage: 'Product strategy decision',
          },
        ],
      },
      recommendations: [
        {
          id: 'rec-product-brief',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          fitScenario: 'Use this when the next artifact is product framing for stakeholders.',
          expectedDuration: '30-40 minutes',
          expectedOutput: 'Product brief with audience, problem, value, and risks.',
          primaryRationale: 'The captured problem is ready to become a product decision brief.',
          sourceRefs: ['workflow:product-brief', 'method:product-framing'],
        },
      ],
    })
    workflows.launchThinkTankWorkflow.mockResolvedValueOnce({
      sessionId: 'session-product-brief-from-quick-consult',
      workflow: {
        key: 'product-brief',
        displayName: 'Product Brief',
        canonicalName: 'Product Brief',
        scenarioLabel: 'Frame product direction',
        sourcePath: 'bmad-create-product-brief/SKILL.md',
      },
      status: 'active',
      sourceRefs: ['bmad-create-product-brief/SKILL.md'],
      firstPrompt: 'Using your Quick Consult context, draft the product framing for this decision.',
      currentStep: {
        index: 1,
        label: 'Frame the product decision',
        sourceRef: 'bmad-create-product-brief/SKILL.md',
        totalSteps: 4,
      },
    })
    configureQuickConsultClientMock()
    renderAdvisoryRoute()

    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      'We need to decide whether to build an AI compliance questionnaire generator for existing customers.'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    await user.click(within(recommendations).getByRole('button', { name: /accept product brief/i }))

    await waitFor(() => {
      expect(workflows.launchThinkTankWorkflow).toHaveBeenCalledWith(
        'product-brief',
        expect.objectContaining({
          quickConsultContextId: 'quick-consult-context-accept',
          acceptedRecommendationId: 'rec-product-brief',
          acceptedRecommendation: true,
        })
      )
    })
    expect(screen.getByRole('article', { name: /Product Brief 首个提示/ })).toHaveTextContent(
      'Using your Quick Consult context'
    )
    expect(screen.queryByRole('textbox', { name: 'Describe the problem' })).not.toBeInTheDocument()
    expect(screen.queryByText(/re-enter|重新输入|再次描述问题/i)).not.toBeInTheDocument()
  })
})

describe.skip('Story 3.4 manual workflow and method browsing frontend acceptance tests (ATDD RED)', () => {
  type Story34WorkflowMocks = {
    fetchThinkTankWorkflows: jest.Mock
    fetchThinkTankSessionMessages: jest.Mock
    launchThinkTankWorkflow: jest.Mock
    fetchThinkTankManualBrowseCatalog: jest.Mock
  }

  const story34Problem = '预算被砍后，我们需要重新判断产品机会、架构路线和企业客户合规交付优先级。'

  const story34WorkflowCatalog = [
    ['brainstorming', 'Brainstorming', 'Generate options'],
    ['domain-research', 'Domain Research', 'Understand a domain'],
    ['market-research', 'Market Research', 'Analyze market and customers'],
    ['product-brief', 'Product Brief', 'Frame product direction'],
    ['prd', 'PRD', 'Write requirements'],
    ['problem-solving', 'Problem Solving', 'Diagnose root causes'],
    ['design-thinking', 'Design Thinking', 'Human-centered discovery'],
    ['storytelling', 'Storytelling', 'Craft narrative'],
  ].map(([key, displayName, scenarioLabel]) => ({
    key,
    displayName,
    canonicalName: displayName,
    scenarioLabel,
    description: `${displayName} workflow`,
    sourcePath: `workflow:${key}`,
  }))

  function readStory34WorkflowMocks(): Story34WorkflowMocks {
    const workflows = jest.requireMock('@/lib/advisory/workflows') as Partial<Story34WorkflowMocks>
    workflows.fetchThinkTankManualBrowseCatalog ??= jest.fn()
    return workflows as Story34WorkflowMocks
  }

  function createStory34ManualBrowseCatalog(overrides: Record<string, unknown> = {}) {
    return {
      workflows: story34WorkflowCatalog.map((workflow) => ({
        workflowKey: workflow.key,
        displayName: workflow.displayName,
        scenarioLabel: workflow.scenarioLabel,
        description: workflow.description,
        expectedDuration: '30-45 minutes',
        sourceRefs: [`workflow:${workflow.key}`],
      })),
      methodChoices: [
        {
          id: 'method:problem-solving:root-cause-analysis',
          workflowKey: 'problem-solving',
          methodName: 'Root Cause Analysis',
          category: 'Diagnose',
          description: 'Find causes before choosing actions.',
        },
        {
          id: 'method:design-thinking:empathy-map',
          workflowKey: 'design-thinking',
          methodName: 'Empathy Map',
          category: 'Discovery',
          description: 'Human-centered discovery for user pains.',
        },
        {
          id: 'method:product-brief:opportunity-brief',
          workflowKey: 'product-brief',
          methodName: 'Opportunity Brief',
          category: 'Strategy',
          description: 'Frame product direction and constraints.',
        },
      ],
      methodCatalogStatus: 'available',
      ...overrides,
    }
  }

  async function openStory34Recommendations(user: ReturnType<typeof userEvent.setup>) {
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-context-34',
      consultId: 'quick-consult-context-34',
      status: 'analysis_started',
      originalProblem: story34Problem,
      classification: {
        confidence: 0.88,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          { id: 'budget', label: '预算约束', confidence: 0.88, scenarioLanguage: '预算收紧' },
        ],
        scenarioLanguage: {
          label: '预算收紧后的产品和架构取舍',
          summary: '需要在产品机会、架构成本和交付窗口之间做取舍。',
          guidance: '可以接受推荐，也可以手动浏览熟悉的方法。',
        },
      },
      recommendations: [
        {
          id: 'rec-product-brief',
          recommendationId: 'quick-consult-context-34:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          fitScenario: '预算收紧后先收敛产品方向。',
          expectedDuration: '45 minutes',
          expectedOutput: 'Product direction brief.',
          primaryRationale: '先对齐目标、约束和成功标准。',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief', 'method:product-brief:opportunity-brief'],
        },
        {
          id: 'rec-problem-solving',
          recommendationId: 'quick-consult-context-34:problem-solving:2',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          fitScenario: '拆解预算、风险和根因。',
          expectedDuration: '60 minutes',
          expectedOutput: 'Root causes and options.',
          primaryRationale: '适合系统诊断。',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving', 'method:problem-solving:root-cause-analysis'],
        },
      ],
      recommendationConfidence: 'confident',
    })

    configureQuickConsultClientMock()
    renderAdvisoryRoute()
    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      story34Problem
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    return screen.findByRole('region', { name: 'Quick Consult recommendations' })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    installDesktopViewport()
    ;(fetchThinkTankAccess as jest.MockedFunction<typeof fetchThinkTankAccess>).mockResolvedValue({
      allowed: true,
      module: 'thinktank',
    })
    ;(useRadarUnreadCount as jest.MockedFunction<typeof useRadarUnreadCount>).mockReturnValue({
      unreadCount: 0,
    })
    ;(useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: 'consultant-primary',
          email: 'consultant@example.com',
          organizationId: 'org-123',
        },
      },
      status: 'authenticated',
    })

    const workflows = readStory34WorkflowMocks()
    workflows.fetchThinkTankWorkflows.mockResolvedValue({ workflows: story34WorkflowCatalog })
    workflows.fetchThinkTankManualBrowseCatalog.mockResolvedValue(
      createStory34ManualBrowseCatalog()
    )
    workflows.fetchThinkTankSessionMessages.mockResolvedValue({
      sessionId: 'session-manual',
      currentStep: { index: 1, label: 'Start' },
      messages: [],
    })
    workflows.launchThinkTankWorkflow.mockImplementation(async (workflowKey: string) => ({
      sessionId: `session-manual-${workflowKey}`,
      status: 'active',
      workflow:
        story34WorkflowCatalog.find((workflow) => workflow.key === workflowKey) ??
        story34WorkflowCatalog[0],
      firstPrompt: 'Using your Quick Consult context, start the selected workflow.',
      sourceRefs: [`workflow:${workflowKey}`],
      currentStep: { index: 1, label: 'Start', sourceRef: `workflow:${workflowKey}` },
    }))
  })

  it.skip('[P0][3.4-UI-001][AC1] opens the manual browse region from View other methods and shows scannable workflows plus methods', async () => {
    const user = userEvent.setup()
    const workflows = readStory34WorkflowMocks()
    const recommendations = await openStory34Recommendations(user)

    await user.click(
      within(recommendations).getAllByRole('button', { name: 'View other methods' })[0]
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(browser).toHaveFocus()
    expect(workflows.fetchThinkTankManualBrowseCatalog).toHaveBeenCalledWith({
      quickConsultContextId: 'quick-consult-context-34',
    })
    expect(within(browser).getAllByRole('article', { name: /workflow option/i })).toHaveLength(8)
    expect(within(browser).getByText('Frame product direction')).toBeVisible()
    expect(within(browser).getByText('Root Cause Analysis')).toBeVisible()
    expect(within(browser).getByText('Opportunity Brief')).toBeVisible()
  })

  it.skip('[P0][3.4-UI-002][AC1] opens the same manual browse region when a recommendation is rejected', async () => {
    const user = userEvent.setup()
    const recommendations = await openStory34Recommendations(user)

    await user.click(
      within(recommendations).getByRole('button', { name: 'Reject Product Brief recommendation' })
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(browser).toBeVisible()
    expect(
      within(browser).getByRole('textbox', { name: 'Search workflows and methods' })
    ).toBeVisible()
    expect(readStory34WorkflowMocks().launchThinkTankWorkflow).not.toHaveBeenCalled()
  })

  it.skip('[P0][3.4-UI-003][AC1] opens the manual browse region from low-confidence guidance instead of only focusing the sidebar', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-low-confidence-34',
      status: 'clarification_required',
      originalProblem: '增长、组织和架构都不太清楚。',
      clarificationQuestions: ['你最想先解决哪个决策？'],
      classification: {
        confidence: 0.41,
        confidenceLevel: 'low',
        primaryProblemType: 'strategy',
        problemTypes: [
          { id: 'strategy', label: '战略取舍', confidence: 0.41, scenarioLanguage: '边界不清晰' },
        ],
        scenarioLanguage: {
          label: '问题边界不清晰',
          summary: '需要先收敛。',
          guidance: '可以澄清，也可以手动浏览。',
        },
        manualBrowseHint: '你也可以先手动浏览工作流，不必等待系统给出确定推荐。',
      },
    })

    configureQuickConsultClientMock()
    renderAdvisoryRoute()
    await user.type(
      await screen.findByRole('textbox', { name: 'Describe the problem' }),
      '增长、组织和架构都不太清楚。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
    await user.click(await screen.findByRole('button', { name: '浏览工作流' }))

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(browser).toHaveFocus()
    expect(
      screen.getByRole('region', { name: 'Quick Consult clarification questions' })
    ).toBeVisible()
  })

  it.skip('[P0][3.4-UI-004][AC1] filters workflows and methods by scenario language, workflow name, and method name', async () => {
    const user = userEvent.setup()
    const recommendations = await openStory34Recommendations(user)
    await user.click(
      within(recommendations).getAllByRole('button', { name: 'View other methods' })[0]
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    const search = within(browser).getByRole('textbox', { name: 'Search workflows and methods' })

    await user.type(search, 'root cause')
    expect(within(browser).getByText('Root Cause Analysis')).toBeVisible()
    expect(within(browser).getByText('Problem Solving')).toBeVisible()
    expect(within(browser).queryByText('Opportunity Brief')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'human-centered')
    expect(within(browser).getByText('Design Thinking')).toBeVisible()
    expect(within(browser).getByText('Empathy Map')).toBeVisible()
  })

  it.skip('[P0][3.4-UI-005][AC3] shows a recoverable method-library error while direct workflow launch remains enabled and keyboard reachable', async () => {
    const user = userEvent.setup()
    const workflows = readStory34WorkflowMocks()
    workflows.fetchThinkTankManualBrowseCatalog.mockResolvedValueOnce(
      createStory34ManualBrowseCatalog({
        methodChoices: [],
        methodCatalogStatus: 'degraded',
        recoverableMessage: '方法库暂时不可用，仍可直接启动工作流。',
      })
    )
    const recommendations = await openStory34Recommendations(user)
    await user.click(
      within(recommendations).getAllByRole('button', { name: 'View other methods' })[0]
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    const alert = within(browser).getByRole('alert')
    expect(alert).toHaveTextContent('方法库暂时不可用，仍可直接启动工作流。')
    expect(alert).not.toHaveTextContent(/_bmad|prompt|csv|[A-Z]:\\/i)

    const launch = within(browser).getByRole('button', { name: 'Launch Product Brief' })
    expect(launch).toBeEnabled()
    launch.focus()
    expect(launch).toHaveFocus()
    await user.click(launch)

    expect(workflows.launchThinkTankWorkflow).toHaveBeenCalledWith(
      'product-brief',
      expect.objectContaining({
        quickConsultContextId: 'quick-consult-context-34',
        manualChoice: true,
        manualChoiceKind: 'workflow',
        manualChoiceId: 'workflow:product-brief',
        manualChoiceLabel: 'Product Brief',
      })
    )
  })

  it.skip('[P0][3.4-UI-006][AC2] launches a manually selected method through the shared workflow launcher with metadata distinct from accepted recommendations', async () => {
    const user = userEvent.setup()
    const workflows = readStory34WorkflowMocks()
    const recommendations = await openStory34Recommendations(user)
    await user.click(
      within(recommendations).getAllByRole('button', { name: 'View other methods' })[0]
    )

    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    await user.click(within(browser).getByRole('button', { name: 'Launch Root Cause Analysis' }))

    await waitFor(() => expect(workflows.launchThinkTankWorkflow).toHaveBeenCalled())
    const calls = workflows.launchThinkTankWorkflow.mock.calls
    const [workflowKey, metadata] = calls[calls.length - 1]

    expect(workflowKey).toBe('problem-solving')
    expect(metadata).toEqual(
      expect.objectContaining({
        quickConsultContextId: 'quick-consult-context-34',
        manualChoice: true,
        manualChoiceKind: 'method',
        manualChoiceId: 'method:problem-solving:root-cause-analysis',
        manualChoiceLabel: 'Root Cause Analysis',
      })
    )
    expect(metadata).not.toHaveProperty('acceptedRecommendation')
    expect(metadata).not.toHaveProperty('acceptedRecommendationId')
    expect(
      await screen.findByRole('article', { name: /Problem Solving 首个提示/ })
    ).toHaveTextContent('Using your Quick Consult context')
  })
})

const mockSubmitQuickConsultRecommendationFeedback = jest.fn()

describe.skip('Story 3.5 recommendation feedback frontend acceptance tests (ATDD RED)', () => {
  beforeEach(() => {
    mockSubmitQuickConsultRecommendationFeedback.mockReset()
    mockSubmitQuickConsultRecommendationFeedback.mockResolvedValue({
      id: 'recommendation-feedback-35',
      rating: 5,
      quickConsultContextId: 'quick-consult-feedback-context-35',
    })
  })

  it('[P0][3.5-UI-001][AC1] shows a recommendation quality rating control only after recommendations are visible and does not preselect a default rating', async () => {
    const user = userEvent.setup()
    configureQuickConsultClientMock()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-feedback-context-35',
      status: 'analysis_started',
      classification: {
        confidence: 0.86,
        confidenceLevel: 'high',
        primaryProblemType: 'budget',
        problemTypes: [
          {
            id: 'budget',
            label: '预算约束',
            confidence: 0.9,
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
          id: 'quick-consult-feedback-context-35:problem-solving:1',
          recommendationId: 'quick-consult-feedback-context-35:problem-solving:1',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          primaryRationale: '预算约束需要先定位根因。',
          rationale: '预算约束需要先定位根因。',
          fitScenario: '预算被砍，需要重新排优先级',
          expectedDuration: '35 minutes',
          expectedOutput: 'Root causes and prioritized options.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:problem-solving'],
        },
      ],
      recommendationConfidence: 'confident',
    })

    renderAdvisoryRoute()
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

  it('[P0][3.5-UI-002][AC1][AC3] submits a selected 1-5 rating with optional text and shows a saved state without sending raw problem content', async () => {
    const user = userEvent.setup()
    const quickConsult = jest.requireMock('@/lib/advisory/quick-consult') as {
      submitQuickConsultRecommendationFeedback: jest.Mock
    }
    quickConsult.submitQuickConsultRecommendationFeedback =
      mockSubmitQuickConsultRecommendationFeedback

    configureQuickConsultClientMock()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-feedback-context-35',
      status: 'analysis_started',
      recommendations: [
        {
          id: 'quick-consult-feedback-context-35:product-brief:1',
          recommendationId: 'quick-consult-feedback-context-35:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          primaryRationale: '预算约束需要先框定产品方向。',
          rationale: '预算约束需要先框定产品方向。',
          fitScenario: '预算被砍，需要重新排优先级',
          expectedDuration: '45 minutes',
          expectedOutput: 'A product framing brief.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief'],
        },
      ],
      recommendationConfidence: 'confident',
    })

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

    expect(mockSubmitQuickConsultRecommendationFeedback).toHaveBeenCalledWith({
      quickConsultContextId: 'quick-consult-feedback-context-35',
      rating: 5,
      feedbackText: '推荐方向有帮助，但希望说明取舍原因。',
      recommendationIds: ['quick-consult-feedback-context-35:product-brief:1'],
    })
    expect(JSON.stringify(mockSubmitQuickConsultRecommendationFeedback.mock.calls)).not.toContain(
      'ACME raw problem'
    )
    expect(await within(feedback).findByText('Recommendation feedback saved')).toBeVisible()
  })

  it('[P0][3.5-UI-003][AC2] dismisses feedback without an API call and leaves recommendation launch controls usable', async () => {
    const user = userEvent.setup()
    configureQuickConsultClientMock()
    mockStartQuickConsult.mockResolvedValueOnce({
      contextId: 'quick-consult-feedback-dismiss-35',
      status: 'analysis_started',
      recommendations: [
        {
          id: 'quick-consult-feedback-dismiss-35:product-brief:1',
          recommendationId: 'quick-consult-feedback-dismiss-35:product-brief:1',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          primaryRationale: '预算约束需要先框定产品方向。',
          rationale: '预算约束需要先框定产品方向。',
          fitScenario: '预算被砍，需要重新排优先级',
          expectedDuration: '45 minutes',
          expectedOutput: 'A product framing brief.',
          classificationRefs: ['budget'],
          sourceRefs: ['workflow:product-brief'],
        },
      ],
      recommendationConfidence: 'confident',
    })

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
    expect(
      within(recommendations).getByRole('button', { name: 'Accept Product Brief' })
    ).toBeEnabled()
    expect(
      within(recommendations).getByRole('button', { name: 'View other methods for Product Brief' })
    ).toBeEnabled()
    expect(
      within(recommendations).getByRole('button', { name: 'Reject Product Brief recommendation' })
    ).toBeEnabled()
  })
})
