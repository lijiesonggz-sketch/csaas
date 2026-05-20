import {
  QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE,
  QUICK_CONSULT_FEEDBACK_REQUIRED_RATING_MESSAGE,
  QUICK_CONSULT_FEEDBACK_TOO_LONG_MESSAGE,
  QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE,
  QUICK_CONSULT_START_FAILED_MESSAGE,
  readQuickConsultDraft,
  saveQuickConsultDraft,
  startQuickConsult,
  submitQuickConsultRecommendationFeedback,
} from './quick-consult'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('Quick Consult client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  it('validates empty and over-limit problem input before network calls', async () => {
    await expect(startQuickConsult({ problem: '   ' })).rejects.toThrow(
      QUICK_CONSULT_EMPTY_PROBLEM_MESSAGE
    )
    await expect(startQuickConsult({ problem: 'x'.repeat(5001) })).rejects.toThrow(
      QUICK_CONSULT_PROBLEM_TOO_LONG_MESSAGE
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('starts Quick Consult through the frontend proxy and unwraps the response envelope', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-1',
          status: 'analysis_started',
          operationalStatus: 'OpenAI connected. Analysis can take up to 5 minutes.',
        },
      }),
    })

    await expect(
      startQuickConsult({ problem: '  Assess ISO 27001 remediation priorities.  ' })
    ).resolves.toEqual(
      expect.objectContaining({
        contextId: 'quick-consult-1',
        consultId: 'quick-consult-1',
        status: 'analysis_started',
      })
    )
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/quick-consult/start', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        problem: 'Assess ISO 27001 remediation priorities.',
      }),
      cache: 'no-store',
    })
  })

  it('normalizes structured classification metadata from the start response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-1',
          status: 'analysis_started',
          originalProblemContext: {
            text: '预算被砍后，我们需要重新排优先级。',
            language: 'zh-CN',
          },
          classification: {
            confidence: 0.88,
            confidenceLevel: 'high',
            primaryProblemType: 'budget',
            problemTypes: [
              {
                id: 'budget',
                label: '预算约束',
                confidence: 0.9,
                scenarioLanguage: '预算被砍，需要重新排优先级',
              },
              {
                id: '',
                label: 'drop me',
                confidence: 2,
                scenarioLanguage: '',
              },
            ],
            scenarioLanguage: {
              label: '预算被砍，需要重新排优先级',
              summary: '当前问题更像是在预算收紧后重新判断优先级。',
              guidance: '先明确必须保留的业务目标，再比较路线取舍。',
            },
            manualBrowseHint: '也可以手动浏览工作流。',
          },
        },
      }),
    })

    await expect(
      startQuickConsult({ problem: '预算被砍后，我们需要重新排优先级。' })
    ).resolves.toMatchObject({
      status: 'analysis_started',
      classification: {
        confidence: 0.88,
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
        },
        manualBrowseHint: '也可以手动浏览工作流。',
      },
    })
  })

  it('normalizes method recommendations from the start response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-context-33',
          status: 'analysis_started',
          recommendationConfidence: 'confident',
          recommendations: [
            {
              id: 'rec-problem-solving',
              recommendationId: 'rec-problem-solving',
              workflowKey: 'problem-solving',
              methodName: 'Problem Solving',
              fitScenario: 'Use this when constraints and root causes matter.',
              expectedDuration: '25-35 minutes',
              durationMinutes: 35,
              expectedOutput: 'Root-cause tree and prioritized options.',
              rationale: 'The input has budget and architecture constraints.',
              primaryRationale: 'Budget and architecture constraints need structured diagnosis.',
              expandedRationale:
                'This fits because the captured scenario is about cost, priority, and technical tradeoffs.',
              rank: 1,
              classificationRefs: ['budget'],
              sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
            },
            {
              id: '',
              workflowKey: 'bad key',
              methodName: '',
              sourceRefs: ['_bmad/private/workflow.md'],
            },
            {
              id: 'rec-product-brief',
              recommendationId: 'rec-product-brief',
              workflowKey: 'product-brief',
              methodName: 'Product Brief',
              fitScenario: 'Use this when product framing matters.',
              expectedDuration: '30-40 minutes',
              durationMinutes: 40,
              expectedOutput: 'A concise product framing brief.',
              rationale: 'The input needs product opportunity framing.',
              primaryRationale: 'Budget and architecture constraints need product framing.',
              rank: 2,
              classificationRefs: ['budget'],
              sourceRefs: ['workflow:product-brief', 'method:product-brief:library-1'],
            },
          ],
        },
      }),
    })

    await expect(
      startQuickConsult({ problem: 'Assess budget and architecture tradeoffs.' })
    ).resolves.toMatchObject({
      status: 'analysis_started',
      recommendationConfidence: 'confident',
      recommendations: [
        {
          id: 'rec-problem-solving',
          recommendationId: 'rec-problem-solving',
          workflowKey: 'problem-solving',
          methodName: 'Problem Solving',
          fitScenario: 'Use this when constraints and root causes matter.',
          expectedDuration: '25-35 minutes',
          durationMinutes: 35,
          expectedOutput: 'Root-cause tree and prioritized options.',
          primaryRationale: 'Budget and architecture constraints need structured diagnosis.',
          sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
        },
        {
          id: 'rec-product-brief',
          recommendationId: 'rec-product-brief',
          workflowKey: 'product-brief',
          methodName: 'Product Brief',
          sourceRefs: ['workflow:product-brief', 'method:product-brief:library-1'],
        },
      ],
    })
  })

  it('drops confident recommendations when fewer than two valid cards remain after normalization', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-context-33',
          status: 'analysis_started',
          recommendationConfidence: 'confident',
          recommendations: [
            {
              id: 'rec-problem-solving',
              recommendationId: 'rec-problem-solving',
              workflowKey: 'problem-solving',
              methodName: 'Problem Solving',
              fitScenario: 'Use this when constraints and root causes matter.',
              expectedDuration: '25-35 minutes',
              expectedOutput: 'Root-cause tree and prioritized options.',
              rationale: 'The input has budget and architecture constraints.',
              primaryRationale: 'Budget and architecture constraints need structured diagnosis.',
              classificationRefs: ['budget'],
              sourceRefs: ['workflow:problem-solving'],
            },
            {
              id: 'drop-me',
              workflowKey: 'product-brief',
              methodName: 'Product Brief',
              sourceRefs: ['_bmad/private/workflow.md'],
            },
          ],
        },
      }),
    })

    await expect(
      startQuickConsult({ problem: 'Assess budget and architecture tradeoffs.' })
    ).resolves.toMatchObject({
      recommendationConfidence: 'none',
      recommendations: [],
    })
  })

  it('drops recommendation cards from a low-confidence start response defensively', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-low-confidence',
          status: 'analysis_started',
          recommendationConfidence: 'confident',
          classification: {
            confidence: 0.42,
            confidenceLevel: 'low',
            problemTypes: [
              {
                id: 'strategy',
                label: '战略取舍',
                confidence: 0.42,
                scenarioLanguage: '问题边界还不够清楚',
              },
            ],
            scenarioLanguage: {
              label: '问题边界还不够清楚',
              summary: '当前描述还不足以给出确定路径。',
              guidance: '先回答澄清问题。',
            },
          },
          recommendations: [
            {
              id: 'rec-problem-solving',
              recommendationId: 'rec-problem-solving',
              workflowKey: 'problem-solving',
              methodName: 'Problem Solving',
              fitScenario: 'Use this when constraints and root causes matter.',
              expectedDuration: '25-35 minutes',
              expectedOutput: 'Root-cause tree and prioritized options.',
              rationale: 'The input is still unclear.',
              primaryRationale: 'The input is still unclear.',
              classificationRefs: ['strategy'],
              sourceRefs: ['workflow:problem-solving'],
            },
          ],
        },
      }),
    })

    await expect(startQuickConsult({ problem: 'Help me decide.' })).resolves.toMatchObject({
      status: 'analysis_started',
      recommendationConfidence: 'none',
      recommendations: [],
    })
  })

  it('reads backend error envelopes for Quick Consult start failures', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          message: '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。',
        },
      }),
    })

    await expect(startQuickConsult({ problem: 'Assess onboarding risk.' })).rejects.toThrow(
      '当前账号暂无 ThinkTank 访问权限，请联系管理员开通。'
    )
  })

  it('continues Quick Consult with whitelisted clarification answers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: '550e8400-e29b-41d4-a716-446655440001',
          status: 'analysis_started',
          originalProblemContext: { text: 'Help me with AI.', language: 'en' },
          clarificationAnswers: [
            {
              question: 'What business decision are you trying to make?',
              answer: 'Prioritize enterprise compliance onboarding.',
            },
          ],
        },
      }),
    })

    await expect(
      startQuickConsult({
        problem: 'Help me with AI.',
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
          { question: '', answer: 'drop me' },
        ],
      })
    ).resolves.toMatchObject({
      status: 'analysis_started',
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
      ],
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/quick-consult/start', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        problem: 'Help me with AI.',
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
        ],
      }),
      cache: 'no-store',
    })
  })

  it('keeps Quick Consult drafts in session storage separate from workflow session drafts', () => {
    saveQuickConsultDraft({
      userIdentity: 'consultant-primary',
      problem: 'Our compliance workflow is too slow.',
    })

    expect(readQuickConsultDraft('consultant-primary')).toBe('Our compliance workflow is too slow.')
    expect(window.sessionStorage.getItem('thinktank:quick-consult-draft:anonymous')).toBeNull()
    expect(window.localStorage.getItem('thinktank:session-draft:consultant-primary')).toBeNull()

    saveQuickConsultDraft({ userIdentity: 'consultant-primary', problem: '' })
    expect(readQuickConsultDraft('consultant-primary')).toBe('')
  })

  it('does not persist drafts for anonymous users and degrades when storage is unavailable', () => {
    saveQuickConsultDraft({
      userIdentity: null,
      problem: 'Sensitive customer strategy.',
    })
    expect(window.sessionStorage.length).toBe(0)
    expect(readQuickConsultDraft(null)).toBe('')

    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(readQuickConsultDraft('consultant-primary')).toBe('')
    getItemSpy.mockRestore()

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() =>
      saveQuickConsultDraft({
        userIdentity: 'consultant-primary',
        problem: 'Our compliance workflow is too slow.',
      })
    ).not.toThrow()
    setItemSpy.mockRestore()
  })

  it('rejects malformed clarification responses without actionable questions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-clarifying',
          status: 'clarification_required',
          originalProblem: 'Help me with AI.',
          clarificationQuestions: [],
        },
      }),
    })

    await expect(startQuickConsult({ problem: 'Help me with AI.' })).rejects.toThrow(
      QUICK_CONSULT_START_FAILED_MESSAGE
    )
  })

  it('validates recommendation feedback rating before network calls', async () => {
    for (const rating of [0, 3.5, 6, Number.NaN]) {
      await expect(
        submitQuickConsultRecommendationFeedback({
          quickConsultContextId: 'quick-consult-context-35',
          rating,
        })
      ).rejects.toThrow(QUICK_CONSULT_FEEDBACK_REQUIRED_RATING_MESSAGE)
    }

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects over-limit recommendation feedback text instead of silently truncating it', async () => {
    await expect(
      submitQuickConsultRecommendationFeedback({
        quickConsultContextId: 'quick-consult-context-35',
        rating: 5,
        feedbackText: 'x'.repeat(2001),
      })
    ).rejects.toThrow(QUICK_CONSULT_FEEDBACK_TOO_LONG_MESSAGE)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('submits recommendation feedback through the frontend proxy with whitelisted payload fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'feedback-35',
          quickConsultContextId: 'quick-consult-context-35',
          rating: 5,
          createdAt: '2026-05-20T14:02:00.000Z',
        },
      }),
    })

    await expect(
      submitQuickConsultRecommendationFeedback({
        quickConsultContextId: ' quick-consult-context-35 ',
        rating: 5,
        feedbackText: '  推荐方向有帮助。  ',
        recommendationIds: [' rec-1 ', '', 'rec-1', 'rec-2'],
      })
    ).resolves.toEqual({
      id: 'feedback-35',
      quickConsultContextId: 'quick-consult-context-35',
      rating: 5,
      createdAt: '2026-05-20T14:02:00.000Z',
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/quick-consult/recommendation-feedback', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quickConsultContextId: 'quick-consult-context-35',
        rating: 5,
        feedbackText: '推荐方向有帮助。',
        recommendationIds: ['rec-1', 'rec-2'],
      }),
      cache: 'no-store',
    })
    expect(mockFetch.mock.calls[0][1].body).not.toContain('rawProblem')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('tenantId')
    expect(mockFetch.mock.calls[0][1].body).not.toContain('actorId')
  })
})
