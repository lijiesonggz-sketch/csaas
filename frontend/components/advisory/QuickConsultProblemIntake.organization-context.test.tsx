import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickConsultProblemIntake } from './QuickConsultProblemIntake'
import { startQuickConsult } from '@/lib/advisory/quick-consult'

jest.mock('@/lib/advisory/quick-consult', () => ({
  QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE: '请先描述你要咨询的问题。',
  QUICK_CONSULT_FEEDBACK_FAILED_MESSAGE: '暂时无法保存推荐反馈，请稍后重试。',
  QUICK_CONSULT_FEEDBACK_MAX_LENGTH: 2000,
  QUICK_CONSULT_PROBLEM_MAX_LENGTH: 5000,
  QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE: '问题描述过长，请精简到 5000 字符以内。',
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

describe('QuickConsultProblemIntake organization context gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStartQuickConsult.mockResolvedValue({
      status: 'analysis_started',
      contextId: '550e8400-e29b-41d4-a716-446655440036',
      consultId: '550e8400-e29b-41d4-a716-446655440036',
      consultationId: 'provider-consultation-1',
      originalProblemContext: {
        text: 'Assess compliance onboarding risk.',
        language: 'en',
      },
      clarificationAnswers: [],
      providerStatus: 'fake',
      latencyMs: 3,
      analysisWindowMinutes: 5,
      preview: {
        nextStepLabel: 'Quick Consult analysis',
        estimatedDurationMinutes: 5,
      },
      operationalStatus: '5-minute analysis started.',
      recommendations: [],
      recommendationConfidence: 'none',
    })
  })

  it('does not fan out duplicate starts while the first-use organization gate is pending', async () => {
    const user = userEvent.setup()
    let resolveGate: (allowed: boolean) => void = () => undefined
    const onBeforeStartQuickConsult = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveGate = resolve
        })
    )

    render(
      <QuickConsultProblemIntake
        userIdentity="tenant-1:org-1:user-1"
        onBeforeStartQuickConsult={onBeforeStartQuickConsult}
      />
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Describe the problem' }),
      'Assess compliance onboarding risk.'
    )
    const startButton = screen.getByRole('button', { name: 'Start quick consult' })

    await user.click(startButton)
    await waitFor(() => expect(startButton).toBeDisabled())
    await user.click(startButton)

    expect(onBeforeStartQuickConsult).toHaveBeenCalledTimes(1)
    expect(mockStartQuickConsult).not.toHaveBeenCalled()

    resolveGate(true)

    await waitFor(() => {
      expect(mockStartQuickConsult).toHaveBeenCalledTimes(1)
    })
  })
})
