import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { startQuickConsult } from './quick-consult'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('Quick Consult contextual recommendations client normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  it('[P0][3.7-FE-001][AC1][AC2][AC3] preserves recommendationContext and enterpriseContext metadata from the start response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-context-37',
          status: 'analysis_started',
          recommendationConfidence: 'confident',
          classification: {
            confidence: 0.91,
            confidenceLevel: 'high',
            primaryProblemType: 'compliance',
            problemTypes: [
              {
                id: 'compliance',
                label: '合规风险',
                confidence: 0.91,
                scenarioLanguage: 'ISO 27001 合规整改优先级',
              },
            ],
            scenarioLanguage: {
              label: 'ISO 27001 合规整改优先级',
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
            fallbackReason: null,
          },
          recommendations: [
            {
              id: 'rec-problem-solving',
              recommendationId: 'rec-problem-solving',
              workflowKey: 'problem-solving',
              methodName: 'Problem Solving',
              fitScenario: '合规风险和成熟度短板需要先定位根因。',
              expectedDuration: '35 minutes',
              expectedOutput: 'Root causes and prioritized remediation options.',
              rationale: 'CSAAS maturity and compliance signals point to access-control gaps.',
              primaryRationale:
                'CSAAS maturity and compliance signals point to access-control gaps.',
              classificationRefs: ['compliance'],
              sourceRefs: [
                'workflow:problem-solving',
                'method:problem-solving:root-cause-analysis',
                'csaas:it-maturity',
                'csaas:compliance',
              ],
            },
            {
              id: 'rec-product-brief',
              recommendationId: 'rec-product-brief',
              workflowKey: 'product-brief',
              methodName: 'Product Brief',
              fitScenario: '需要把整改建议包装成可执行方案。',
              expectedDuration: '45 minutes',
              expectedOutput: 'Compliance readiness brief.',
              rationale: '企业背景和合规缺口需要转成决策材料。',
              primaryRationale: '企业背景和合规缺口需要转成决策材料。',
              classificationRefs: ['compliance'],
              sourceRefs: ['workflow:product-brief', 'method:product-brief:opportunity-brief'],
            },
          ],
        },
      }),
    })

    await expect(
      startQuickConsult({ problem: '请结合企业成熟度和 ISO 27001 缺口判断整改优先级。' })
    ).resolves.toMatchObject({
      contextId: 'quick-consult-context-37',
      status: 'analysis_started',
      recommendationConfidence: 'confident',
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
        expect.objectContaining({
          methodName: 'Problem Solving',
          sourceRefs: expect.arrayContaining(['csaas:it-maturity', 'csaas:compliance']),
        }),
        expect.objectContaining({ methodName: 'Product Brief' }),
      ],
    })
    expect(JSON.parse(mockFetch.mock.calls[0][1].body as string)).toEqual({
      problem: '请结合企业成熟度和 ISO 27001 缺口判断整改优先级。',
    })
  })

  it('[P0][3.7-FE-003][AC1][AC2] degrades malformed enterprise context with no applied signals to generic mode', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          contextId: 'quick-consult-context-empty-signals-37',
          status: 'analysis_started',
          recommendationConfidence: 'confident',
          classification: {
            confidence: 0.91,
            confidenceLevel: 'high',
            primaryProblemType: 'compliance',
            problemTypes: [
              {
                id: 'compliance',
                label: '合规风险',
                confidence: 0.91,
                scenarioLanguage: 'ISO 27001 合规整改优先级',
              },
            ],
            scenarioLanguage: {
              label: 'ISO 27001 合规整改优先级',
              summary: '需要结合成熟度和合规缺口排序行动。',
              guidance: '先处理高风险缺口，再安排流程治理。',
            },
          },
          recommendationContext: {
            mode: 'enterprise',
            signalsApplied: [],
            sources: ['organization_context', 'csaas_it_maturity'],
            contextCompletionPrompt: {
              missingFields: [],
              message: '补充企业背景可提升推荐精度。',
              action: 'open_enterprise_background_settings',
            },
          },
          recommendations: [
            {
              id: 'rec-problem-solving',
              recommendationId: 'rec-problem-solving',
              workflowKey: 'problem-solving',
              methodName: 'Problem Solving',
              fitScenario: '合规风险和成熟度短板需要先定位根因。',
              expectedDuration: '35 minutes',
              expectedOutput: 'Root causes and prioritized remediation options.',
              rationale: 'Use a structured diagnosis path.',
              primaryRationale: 'Use a structured diagnosis path.',
              classificationRefs: ['compliance'],
              sourceRefs: [
                'workflow:problem-solving',
                'method:problem-solving:root-cause-analysis',
              ],
            },
            {
              id: 'rec-prd',
              recommendationId: 'rec-prd',
              workflowKey: 'prd',
              methodName: 'PRD',
              fitScenario: '需要形成可执行需求。',
              expectedDuration: '50 minutes',
              expectedOutput: 'Requirements outline.',
              rationale: 'Use a structured requirement path.',
              primaryRationale: 'Use a structured requirement path.',
              classificationRefs: ['compliance'],
              sourceRefs: ['workflow:prd', 'method:prd:runtime'],
            },
          ],
        },
      }),
    })

    await expect(
      startQuickConsult({ problem: '请判断 ISO 27001 整改优先级。' })
    ).resolves.toMatchObject({
      recommendationContext: {
        mode: 'generic',
        signalsApplied: [],
        sources: ['organization_context'],
        fallbackReason: 'malformed',
        contextCompletionPrompt: {
          missingFields: [],
          message: '补充企业背景可提升推荐精度。',
          action: 'open_enterprise_background_settings',
        },
      },
    })
  })
})
