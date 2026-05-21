import { ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import {
  QuickConsultMethodRecommendationService,
  QuickConsultRecommendationConfidence,
} from './quick-consult-method-recommendation.service'
import { QuickConsultProblemClassificationResult } from './quick-consult.service'

/**
 * Story 3.7 ATDD RED phase - recommendation generation applies safe enterprise context.
 *
 * Provider endpoint/source: service-level contract behind
 * POST /advisory/quick-consult/start.
 */

const createWorkflow = (key: string): ThinkTankWorkflowMetadata => ({
  key,
  displayName: `${key} workflow`,
  scenarioLabel: `${key} scenario`,
  sourcePath: `_bmad/runtime/${key}/workflow.md`,
  supportedFileType: '.md',
  firstPromptSource: `_bmad/runtime/${key}/steps/step-01.md`,
  methodLibraryPaths: [`_bmad/runtime/${key}/methods.csv`],
  agentSourcePaths: [],
  description: `${key} description`,
})

const highConfidenceClassification: QuickConsultProblemClassificationResult = {
  confidence: 0.91,
  confidenceLevel: 'high',
  primaryProblemType: 'compliance',
  problemTypes: [
    {
      id: 'compliance',
      label: '合规整改',
      confidence: 0.91,
      scenarioLanguage: '合规要求临近，需要明确整改范围和优先级',
    },
    {
      id: 'risk',
      label: '风险控制',
      confidence: 0.86,
      scenarioLanguage: '风险正在影响决策，需要先判断影响面和缓解路径',
    },
  ],
  scenarioLanguage: {
    label: '合规要求临近，需要明确整改范围和优先级',
    summary: '当前问题更像是在合规压力下明确整改范围、优先级和业务影响。',
    guidance: '先厘清涉及系统、审计要求和整改成本，再选择深入分析路径。',
  },
  manualBrowseHint: '也可以手动浏览工作流，直接选择更熟悉的分析路径。',
}

function createService() {
  const registry = {
    discoverWorkflows: jest
      .fn()
      .mockResolvedValue(
        [
          'brainstorming',
          'domain-research',
          'market-research',
          'product-brief',
          'prd',
          'problem-solving',
          'design-thinking',
          'storytelling',
        ].map(createWorkflow),
      ),
  }
  return {
    registry,
    service: new QuickConsultMethodRecommendationService(
      registry as unknown as ThinkTankWorkflowRegistryService,
    ),
  }
}

describe('QuickConsultMethodRecommendationService contextual recommendations (Story 3.7 ATDD RED)', () => {
  it('[P0] AC1 annotates and ranks recommendations with safe CSAAS maturity and compliance summaries', async () => {
    const { service } = createService()

    const result = await (service as any).generateRecommendations({
      contextId: 'quick-consult-context-37',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
      organizationContext: {
        contextId: 'organization-context-36',
        organizationName: '华数安全集团',
        industry: '数据安全合规',
        size: '201-500人',
        completenessScore: 100,
        completeness: {
          requiredFieldsComplete: true,
          missingFields: [],
          updatedAt: '2026-05-20T15:33:04.000Z',
        },
      },
      enterpriseSignals: {
        mode: 'enterprise',
        signalsApplied: ['it_maturity', 'compliance'],
        sources: ['csaas_it_maturity', 'csaas_compliance'],
        summary: {
          overallMaturity: 'managed',
          topShortcomings: ['日志留存', '访问控制复核'],
          complianceGapLevel: 'medium',
          riskThemes: ['ISO 27001 访问控制'],
          latestReportStatus: 'completed',
          rawQuestionnaireAnswers: ['do not leak'],
          rawReportSections: ['do not leak'],
        },
      },
    })

    expect(result.confidence).toBe(QuickConsultRecommendationConfidence.Confident)
    expect(result.recommendations).toHaveLength(3)
    expect(result.recommendationContext).toMatchObject({
      mode: 'enterprise',
      signalsApplied: ['it_maturity', 'compliance'],
      sources: ['organization_context', 'csaas_it_maturity', 'csaas_compliance'],
    })
    expect(result.recommendations[0].workflowKey).toBe('domain-research')
    expect(result.recommendations[0].primaryRationale).toMatch(
      /成熟度|managed|合规|medium|日志留存|访问控制/,
    )
    expect(JSON.stringify(result)).not.toMatch(
      /rawQuestionnaireAnswers|rawReportSections|do not leak|_bmad|prompt|provider/i,
    )
  })

  it('[P0] AC2 keeps generic classification-driven recommendations when CSAAS signals are degraded', async () => {
    const { service } = createService()

    const result = await (service as any).generateRecommendations({
      contextId: 'quick-consult-generic-37',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
      enterpriseSignals: {
        mode: 'generic',
        status: 'degraded',
        fallbackReason: 'timeout',
        signalsApplied: [],
        sources: [],
      },
    })

    expect(result.confidence).toBe(QuickConsultRecommendationConfidence.Confident)
    expect(
      result.recommendations.map(
        (recommendation: { workflowKey: string }) => recommendation.workflowKey,
      ),
    ).toEqual(['domain-research', 'problem-solving', 'prd'])
    expect(result.recommendationContext).toMatchObject({
      mode: 'generic',
      fallbackReason: 'timeout',
      signalsApplied: [],
      sources: [],
    })
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2)
  })

  it('[P0] AC2 does not cite CSAAS sources when enterprise mode has no applied signals', async () => {
    const { service } = createService()

    const result = await (service as any).generateRecommendations({
      contextId: 'quick-consult-empty-enterprise-signals-37',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
      enterpriseSignals: {
        mode: 'enterprise',
        status: 'available',
        signalsApplied: [],
        sources: ['csaas_it_maturity'],
        summary: {
          overallMaturity: 'managed',
        },
      },
    })

    expect(result.recommendationContext).toMatchObject({
      mode: 'generic',
      signalsApplied: [],
      sources: [],
    })
    expect(JSON.stringify(result.recommendations)).not.toMatch(/csaas:|成熟度managed/)
  })

  it('[P1] AC3 includes a non-blocking context completion prompt without suppressing recommendation cards', async () => {
    const { service } = createService()

    const result = await (service as any).generateRecommendations({
      contextId: 'quick-consult-low-completeness-37',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
      organizationContext: {
        contextId: 'organization-context-low',
        organizationName: '华数安全集团',
        industry: null,
        size: null,
        completenessScore: 33,
        completeness: {
          requiredFieldsComplete: true,
          missingFields: ['industry', 'size'],
          updatedAt: '2026-05-20T15:33:04.000Z',
        },
      },
      enterpriseSignals: {
        mode: 'generic',
        status: 'degraded',
        fallbackReason: 'no_data',
        signalsApplied: [],
        sources: [],
      },
    })

    expect(result.confidence).toBe(QuickConsultRecommendationConfidence.Confident)
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2)
    expect(result.recommendationContext.contextCompletionPrompt).toEqual({
      missingFields: ['industry', 'size'],
      message: expect.stringContaining('补充'),
      action: 'open_enterprise_background_settings',
    })
  })

  it('[P1] AC3 infers safe missing fields when low completeness metadata is empty', async () => {
    const { service } = createService()

    const result = await (service as any).generateRecommendations({
      contextId: 'quick-consult-low-completeness-empty-fields-37',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
      organizationContext: {
        contextId: 'organization-context-low-empty-fields',
        organizationName: '华数安全集团',
        industry: null,
        size: null,
        completenessScore: 33,
        completeness: {
          requiredFieldsComplete: true,
          missingFields: [],
          updatedAt: '2026-05-20T15:33:04.000Z',
        },
      },
      enterpriseSignals: {
        mode: 'generic',
        status: 'degraded',
        fallbackReason: 'no_data',
        signalsApplied: [],
        sources: [],
      },
    })

    expect(result.recommendationContext.contextCompletionPrompt).toEqual({
      missingFields: ['industry', 'size'],
      message: expect.stringContaining('行业、规模'),
      action: 'open_enterprise_background_settings',
    })
  })
})
