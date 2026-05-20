import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { fetchThinkTankManualBrowseCatalog, launchThinkTankWorkflow } from './workflows'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('ThinkTank workflow client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  it('launches a workflow with optional accepted Quick Consult recommendation metadata', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-product-brief',
          status: 'active',
          workflow: {
            key: 'product-brief',
            displayName: 'Product Brief',
            canonicalName: 'Product Brief',
            scenarioLabel: 'Product opportunity framing',
          },
          sourceRefs: ['workflow:product-brief', 'current-step:1'],
          firstPrompt: 'Using your Quick Consult context, start the product brief.',
          currentStep: {
            index: 1,
            label: '当前步骤',
            sourceRef: 'current-step:1',
          },
        },
      }),
    })

    await expect(
      launchThinkTankWorkflow('product-brief', {
        quickConsultContextId: 'quick-consult-context-33',
        acceptedRecommendationId: 'quick-consult-context-33:product-brief:1',
        acceptedRecommendation: true,
      })
    ).resolves.toMatchObject({
      sessionId: 'session-product-brief',
      status: 'active',
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/workflows/product-brief/launch', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quickConsultContextId: 'quick-consult-context-33',
        acceptedRecommendationId: 'quick-consult-context-33:product-brief:1',
        acceptedRecommendation: true,
      }),
      cache: 'no-store',
    })
  })

  it('launches a workflow with manual Quick Consult choice metadata distinct from accepted recommendations', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-design-thinking',
          status: 'active',
          workflow: {
            key: 'design-thinking',
            displayName: 'Design Thinking',
            canonicalName: 'Design Thinking',
            scenarioLabel: 'Human-centered discovery',
          },
          sourceRefs: ['workflow:design-thinking', 'current-step:1'],
          firstPrompt: 'Using your Quick Consult context, start design thinking.',
          currentStep: {
            index: 1,
            label: '当前步骤',
            sourceRef: 'current-step:1',
          },
        },
      }),
    })

    await expect(
      launchThinkTankWorkflow('design-thinking', {
        quickConsultContextId: 'quick-consult-context-34',
        manualChoice: true,
        manualChoiceKind: 'method',
        manualChoiceId: 'method:design-thinking:empathy-map',
        manualChoiceLabel: 'Empathy Map',
        acceptedRecommendation: false,
      })
    ).resolves.toMatchObject({
      sessionId: 'session-design-thinking',
      status: 'active',
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/workflows/design-thinking/launch', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quickConsultContextId: 'quick-consult-context-34',
        manualChoice: true,
        manualChoiceKind: 'method',
        manualChoiceId: 'method:design-thinking:empathy-map',
        manualChoiceLabel: 'Empathy Map',
      }),
      cache: 'no-store',
    })
  })

  it('fetches and normalizes the Quick Consult manual browse catalog', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          workflows: [
            {
              workflowKey: 'product-brief',
              displayName: 'Product Brief',
              scenarioLabel: 'Frame product direction',
              description: 'Frame product direction safely.',
              sourceRefs: ['workflow:product-brief', '_bmad/private/workflow.md'],
            },
          ],
          methodChoices: [
            {
              id: 'method:problem-solving:root-cause-tree-1',
              workflowKey: 'problem-solving',
              methodName: 'Root Cause Tree',
              category: 'diagnosis',
              description: 'Trace causes.',
            },
            {
              id: 'method:bad',
              workflowKey: 'bad key',
              methodName: '',
              sourceRefs: ['_bmad/private.csv'],
            },
          ],
          methodCatalogStatus: 'degraded',
          recoverableMessage: '方法库暂时不可用，仍可直接启动工作流。',
        },
      }),
    })

    await expect(
      fetchThinkTankManualBrowseCatalog({ quickConsultContextId: 'quick-consult-context-34' })
    ).resolves.toEqual({
      workflows: [
        {
          workflowKey: 'product-brief',
          displayName: 'Product Brief',
          scenarioLabel: 'Frame product direction',
          description: 'Frame product direction safely.',
          expectedDuration: undefined,
          sourceRefs: ['workflow:product-brief'],
        },
      ],
      methodChoices: [
        {
          id: 'method:problem-solving:root-cause-tree-1',
          workflowKey: 'problem-solving',
          methodName: 'Root Cause Tree',
          category: 'diagnosis',
          phase: undefined,
          description: 'Trace causes.',
        },
      ],
      methodCatalogStatus: 'degraded',
      recoverableMessage: '方法库暂时不可用，仍可直接启动工作流。',
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/quick-consult/manual-browse', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quickConsultContextId: 'quick-consult-context-34',
      }),
      cache: 'no-store',
    })
  })
})
