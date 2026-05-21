import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickConsultProblemIntake } from './QuickConsultProblemIntake'
import { startQuickConsult } from '@/lib/advisory/quick-consult'
import { fetchThinkTankManualBrowseCatalog } from '@/lib/advisory/workflows'

jest.mock('@/lib/advisory/quick-consult', () => ({
  QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE: '请先描述你要咨询的问题。',
  QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE: '暂时无法保存推荐反馈，请稍后重试。',
  QUICK_CONSULT_FEEDBACK_MAX_LENGTH: 2000,
  QUICK_CONSULT_PROBLEM_MAX_LENGTH: 5000,
  QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE: '问题描述过长，请精简到 5000 字以内。',
  QUICK_CONSULT_START_FAILED_MESSAGE: '暂时无法启动 Quick Consult，请稍后重试。',
  readQuickConsultDraft: jest.fn(() => ''),
  saveQuickConsultDraft: jest.fn(),
  startQuickConsult: jest.fn(),
  submitQuickConsultRecommendationFeedback: jest.fn(),
}))

jest.mock('@/lib/advisory/workflows', () => ({
  fetchThinkTankManualBrowseCatalog: jest.fn(),
}))

const mockStartQuickConsult = startQuickConsult as jest.Mock
const mockFetchThinkTankManualBrowseCatalog = fetchThinkTankManualBrowseCatalog as jest.Mock

function createContextualAnalysisResult(overrides: Record<string, unknown> = {}) {
  return {
    contextId: 'quick-consult-context-37',
    consultId: 'quick-consult-context-37',
    status: 'analysis_started',
    originalProblem: '请结合企业成熟度和 ISO 27001 缺口判断整改优先级。',
    classification: {
      confidence: 0.91,
      confidenceLevel: 'high',
      primaryProblemType: 'compliance',
      problemTypes: [
        {
          id: 'compliance',
          label: '合规风险',
          confidence: 0.91,
          scenarioLanguage: '合规整改优先级',
        },
      ],
      scenarioLanguage: {
        label: '合规整改优先级',
        summary: '需要结合成熟度和合规缺口排序行动。',
        guidance: '先处理高风险缺口，再安排流程治理。',
      },
    },
    recommendationContext: {
      mode: 'enterprise',
      signalsApplied: ['it_maturity', 'compliance'],
      sources: ['organization_context', 'csaas_it_maturity', 'csaas_compliance'],
    },
    enterpriseContext: {
      mode: 'enterprise',
      signalsApplied: ['it_maturity', 'compliance'],
      sources: ['organization_context', 'csaas_it_maturity', 'csaas_compliance'],
    },
    recommendations: [
      {
        id: 'rec-product-brief',
        recommendationId: 'rec-product-brief',
        workflowKey: 'product-brief',
        methodName: 'Product Brief',
        fitScenario: '需要把整改建议包装成可执行方案。',
        expectedDuration: '45 minutes',
        expectedOutput: 'Compliance readiness brief.',
        rationale: '企业成熟度和合规缺口需要转成决策材料。',
        primaryRationale: '企业成熟度和合规缺口需要转成决策材料。',
        classificationRefs: ['compliance'],
        sourceRefs: ['workflow:product-brief', 'method:product-brief:opportunity-brief'],
      },
      {
        id: 'rec-problem-solving',
        recommendationId: 'rec-problem-solving',
        workflowKey: 'problem-solving',
        methodName: 'Problem Solving',
        fitScenario: '成熟度短板和合规风险需要先定位根因。',
        expectedDuration: '35 minutes',
        expectedOutput: 'Root causes and prioritized remediation options.',
        rationale: 'CSAAS signals show access-control gaps.',
        primaryRationale: 'CSAAS signals show access-control gaps.',
        classificationRefs: ['compliance'],
        sourceRefs: ['workflow:problem-solving', 'method:problem-solving:root-cause-analysis'],
      },
    ],
    recommendationConfidence: 'confident',
    ...overrides,
  }
}

async function submitQuickConsult(user: ReturnType<typeof userEvent.setup>) {
  render(
    <QuickConsultProblemIntake
      userIdentity="tenant-a:org-a:user-a"
      onAcceptRecommendation={jest.fn()}
    />
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Describe the problem' }),
    '请结合企业成熟度和 ISO 27001 缺口判断整改优先级。'
  )
  await user.click(screen.getByRole('button', { name: 'Start quick consult' }))
  return screen.findByRole('region', { name: 'Quick Consult recommendations' })
}

describe('QuickConsultProblemIntake contextual recommendation indicators', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    mockStartQuickConsult.mockResolvedValue(createContextualAnalysisResult())
    mockFetchThinkTankManualBrowseCatalog.mockResolvedValue({
      workflows: [
        {
          workflowKey: 'product-brief',
          displayName: 'Product Brief',
          canonicalName: 'Product Brief',
          scenarioLabel: 'Frame remediation package',
          description: 'Turn compliance context into an action plan.',
          expectedDuration: '45 minutes',
        },
      ],
      methodChoices: [
        {
          id: 'method:product-brief:opportunity-brief',
          workflowKey: 'product-brief',
          methodName: 'Opportunity Brief',
          category: 'Strategy',
          phase: 'Discovery',
          description: 'Frame compliance readiness opportunity.',
        },
      ],
      methodCatalogStatus: 'available',
    })
  })

  it('[P0][3.7-UI-001][AC1] shows a visible enterprise context indicator when CSAAS signals are applied', async () => {
    const user = userEvent.setup()
    const recommendations = await submitQuickConsult(user)

    expect(
      within(recommendations).getByRole('status', {
        name: /企业上下文|enterprise context|recommendation context/i,
      })
    ).toHaveTextContent(/正在使用企业上下文|已结合企业上下文|IT成熟度|合规数据|CSAAS/i)
    expect(
      within(recommendations).getAllByText(/CSAAS IT成熟度|CSAAS合规数据/).length
    ).toBeGreaterThan(0)
    expect(
      within(recommendations).queryByText(/it_maturity|workflow:|method:/)
    ).not.toBeInTheDocument()
    expect(
      within(recommendations).getByRole('article', { name: 'Product Brief recommendation' })
    ).toBeVisible()
  })

  it('[P0][3.7-UI-002][AC2] shows the generic-mode warning as an alert while keeping recommendations usable', async () => {
    const user = userEvent.setup()
    mockStartQuickConsult.mockResolvedValueOnce(
      createContextualAnalysisResult({
        recommendationContext: {
          mode: 'generic',
          signalsApplied: [],
          sources: [],
          fallbackReason: 'timeout',
        },
        enterpriseContext: {
          mode: 'generic',
          signalsApplied: [],
          sources: [],
          fallbackReason: 'timeout',
        },
      })
    )

    const recommendations = await submitQuickConsult(user)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '当前使用通用推荐模式，企业背景数据暂时不可用'
    )
    expect(within(recommendations).getAllByRole('article')).toHaveLength(2)
    expect(
      within(recommendations).getByRole('button', { name: 'Accept Product Brief' })
    ).toBeEnabled()
    expect(
      within(recommendations).getByRole('button', { name: 'View other methods for Product Brief' })
    ).toBeEnabled()
  })

  it('[P0][3.7-UI-003][AC3] displays a non-blocking low-completeness prompt while accept and manual browse controls remain usable', async () => {
    const user = userEvent.setup()
    const onAcceptRecommendation = jest.fn()
    const onOpenEnterpriseBackgroundSettings = jest.fn()
    mockStartQuickConsult.mockResolvedValueOnce(
      createContextualAnalysisResult({
        recommendationContext: {
          mode: 'enterprise',
          signalsApplied: ['it_maturity'],
          sources: ['csaas_it_maturity'],
          contextCompletionPrompt: {
            missingFields: ['industry', 'size', 'complianceOwner'],
            message: '补充行业、规模和合规负责人可提升推荐精度。',
            action: 'open_enterprise_background_settings',
          },
        },
        enterpriseContext: {
          mode: 'enterprise',
          signalsApplied: ['it_maturity'],
          sources: ['csaas_it_maturity'],
        },
      })
    )

    render(
      <QuickConsultProblemIntake
        userIdentity="tenant-a:org-a:user-a"
        onOpenEnterpriseBackgroundSettings={onOpenEnterpriseBackgroundSettings}
        onAcceptRecommendation={onAcceptRecommendation}
      />
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Describe the problem' }),
      '请结合企业成熟度判断整改优先级。'
    )
    await user.click(screen.getByRole('button', { name: 'Start quick consult' }))

    expect(await screen.findByText('补充行业、规模和合规负责人可提升推荐精度。')).toBeVisible()
    const recommendations = await screen.findByRole('region', {
      name: 'Quick Consult recommendations',
    })
    await user.click(within(recommendations).getByRole('button', { name: '完善企业背景' }))
    expect(onOpenEnterpriseBackgroundSettings).toHaveBeenCalledTimes(1)
    await user.click(within(recommendations).getByRole('button', { name: 'Accept Product Brief' }))
    await waitFor(() => {
      expect(onAcceptRecommendation).toHaveBeenCalledWith(
        'product-brief',
        expect.objectContaining({
          quickConsultContextId: 'quick-consult-context-37',
          acceptedRecommendationId: 'rec-product-brief',
          acceptedRecommendation: true,
        })
      )
    })

    await user.click(
      within(recommendations).getByRole('button', { name: 'View other methods for Product Brief' })
    )
    const browser = await screen.findByRole('region', {
      name: 'Quick Consult manual method browser',
    })
    expect(browser).toHaveFocus()
    expect(
      within(browser).getByRole('textbox', { name: 'Search workflows and methods' })
    ).toBeEnabled()
    expect(within(browser).getByRole('button', { name: 'Launch Product Brief' })).toBeEnabled()
  })
})
