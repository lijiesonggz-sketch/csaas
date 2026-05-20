import { ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import {
  QuickConsultMethodRecommendationService,
  QuickConsultRecommendationConfidence,
} from './quick-consult-method-recommendation.service'
import { QuickConsultProblemClassificationResult } from './quick-consult.service'

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
  primaryProblemType: 'budget',
  problemTypes: [
    {
      id: 'budget',
      label: '预算约束',
      confidence: 0.91,
      scenarioLanguage: '预算被砍，需要重新排优先级',
    },
    {
      id: 'architecture',
      label: '架构取舍',
      confidence: 0.86,
      scenarioLanguage: '技术路线需要在成本和长期能力之间取舍',
    },
    {
      id: 'compliance',
      label: '合规整改',
      confidence: 0.8,
      scenarioLanguage: '合规要求临近，需要明确整改范围和优先级',
    },
  ],
  scenarioLanguage: {
    label: '预算被砍，需要重新排优先级',
    summary: '当前问题更像是在预算收紧后重新判断优先级和关键取舍。',
    guidance: '先明确必须保留的业务目标，再比较路线的成本、风险和交付窗口。',
  },
  manualBrowseHint: '也可以手动浏览工作流，直接选择更熟悉的分析路径。',
}

describe('QuickConsultMethodRecommendationService', () => {
  it('generates deterministic file-driven recommendation cards from classification order', async () => {
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
    const service = new QuickConsultMethodRecommendationService(
      registry as unknown as ThinkTankWorkflowRegistryService,
    )

    const result = await service.generateRecommendations({
      contextId: 'quick-consult-context-33',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
    })

    expect(registry.discoverWorkflows).toHaveBeenCalledTimes(1)
    expect(result.confidence).toBe(QuickConsultRecommendationConfidence.Confident)
    expect(result.recommendations.map((recommendation) => recommendation.workflowKey)).toEqual([
      'problem-solving',
      'design-thinking',
      'domain-research',
    ])
    expect(result.recommendations.map((recommendation) => recommendation.rank)).toEqual([1, 2, 3])
    expect(result.recommendations[0]).toEqual(
      expect.objectContaining({
        id: 'quick-consult-context-33:problem-solving:1',
        recommendationId: 'quick-consult-context-33:problem-solving:1',
        workflowKey: 'problem-solving',
        methodName: 'problem-solving workflow',
        classificationRefs: ['budget'],
        durationMinutes: expect.any(Number),
        expectedDuration: expect.stringMatching(/minutes/),
        expectedOutput: expect.any(String),
        sourceRefs: ['workflow:problem-solving', 'method:problem-solving:library-1'],
      }),
    )
    expect(result.recommendations[0].rationale).toMatch(/预算约束|预算被砍/)
    expect(result.recommendations[0].expandedRationale).toMatch(/预算约束|预算被砍/)
    expect(JSON.stringify(result.recommendations)).not.toMatch(
      /_bmad|runtime|workflow\.md|prompt|content/i,
    )
  })

  it('returns no confident cards for low-confidence classification', async () => {
    const registry = {
      discoverWorkflows: jest.fn(),
    }
    const service = new QuickConsultMethodRecommendationService(
      registry as unknown as ThinkTankWorkflowRegistryService,
    )

    const result = await service.generateRecommendations({
      contextId: 'quick-consult-low-confidence',
      classification: {
        ...highConfidenceClassification,
        confidence: 0.42,
        confidenceLevel: 'low',
      },
      providerStatus: 'fake',
    })

    expect(registry.discoverWorkflows).not.toHaveBeenCalled()
    expect(result).toEqual({
      confidence: QuickConsultRecommendationConfidence.None,
      recommendations: [],
      generatedAt: expect.any(String),
      sourceRefCount: 0,
    })
  })

  it('references saved organization context in visible recommendation rationale without tenant internals', async () => {
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
    const service = new QuickConsultMethodRecommendationService(
      registry as unknown as ThinkTankWorkflowRegistryService,
    )

    const result = await service.generateRecommendations({
      contextId: 'quick-consult-context-36',
      classification: highConfidenceClassification,
      providerStatus: 'fake',
      organizationContext: {
        contextId: 'organization-context-36',
        organizationName: '华数安全集团',
        industry: '数据安全合规',
        size: null,
        completenessScore: 67,
        completeness: {
          requiredFieldsComplete: true,
          missingFields: ['size'],
          updatedAt: '2026-05-20T15:33:04.000Z',
        },
      },
    } as never)

    expect(result.recommendations[0].primaryRationale).toContain('华数安全集团')
    expect(result.recommendations[0].expandedRationale).toContain('数据安全合规')
    expect(JSON.stringify(result.recommendations)).not.toMatch(/tenant|organization-context-36/)
  })

  it('fails instead of returning a confident response when fewer than two workflow candidates exist', async () => {
    const registry = {
      discoverWorkflows: jest.fn().mockResolvedValue(['problem-solving'].map(createWorkflow)),
    }
    const service = new QuickConsultMethodRecommendationService(
      registry as unknown as ThinkTankWorkflowRegistryService,
    )

    await expect(
      service.generateRecommendations({
        contextId: 'quick-consult-incomplete-catalog',
        classification: highConfidenceClassification,
        providerStatus: 'fake',
      }),
    ).rejects.toThrow(/fewer than two candidates/)
  })
})
