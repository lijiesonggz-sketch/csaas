import { StandardInterpretationGenerator } from './standard-interpretation.generator'

describe('StandardInterpretationGenerator structured batch interpretation', () => {
  function createGenerator() {
    const aiOrchestrator = {
      generate: jest.fn(),
    }
    const clauseExtractionGenerator = {
      extractClauses: jest.fn(),
      selectBestExtraction: jest.fn((results) => results.gpt4),
    }
    const clauseCoverageService = {
      countClausesByRegex: jest.fn(() => ({
        totalCount: 2,
        uniqueClauseIds: new Set(['5.1.2', '5.1.3']),
        patternMatches: [],
      })),
      validateCoverage: jest.fn(),
      fillMissingClauses: jest.fn(),
    }

    return {
      generator: new StandardInterpretationGenerator(
        aiOrchestrator as any,
        clauseExtractionGenerator as any,
        clauseCoverageService as any,
      ),
      aiOrchestrator,
      clauseExtractionGenerator,
      clauseCoverageService,
    }
  }

  it('builds deterministic interpretation for structured leaf extraction results without AI calls', async () => {
    const { generator, aiOrchestrator, clauseExtractionGenerator, clauseCoverageService } =
      createGenerator()

    const content = [
      '5 人工智能治理',
      '5.1 战略管理',
      '5.1.2 过程描述',
      'a) 利益相关者分析，明确利益相关者的需求；',
      'b) 战略需求评估，明确人工智能战略需求范围；',
      '5.1.3 能力等级标准',
      'c) 第 3 级，稳健级：',
      '1) 开展利益相关者分析并明确其需求；',
      '2) 开展人工智能发展战略需求评估。',
    ].join('\n')

    clauseExtractionGenerator.extractClauses.mockResolvedValue({
      gpt4: {
        total_clauses: 4,
        clauses: [
          {
            clause_id: '5.1.2-a',
            clause_full_text: 'a) 利益相关者分析，明确利益相关者的需求；',
          },
          {
            clause_id: '5.1.2-b',
            clause_full_text: 'b) 战略需求评估，明确人工智能战略需求范围；',
          },
          {
            clause_id: '5.1.3-c-1',
            clause_full_text: 'c) 第 3 级，稳健级：\n1) 开展利益相关者分析并明确其需求；',
          },
          {
            clause_id: '5.1.3-c-2',
            clause_full_text: 'c) 第 3 级，稳健级：\n2) 开展人工智能发展战略需求评估。',
          },
        ],
        extraction_metadata: {
          document_length: content.length,
          extraction_method: 'structured_leaf_requirement',
          confidence: 1,
        },
      },
      claude: null,
      domestic: null,
    })

    const result = await generator.generateBatchInterpretation({
      standardDocument: {
        id: 'doc-1',
        name: '人工智能企业智能化成熟度评估模型',
        content,
      },
      batchSize: 2,
      maxTokens: 3000,
    })

    expect(clauseCoverageService.validateCoverage).not.toHaveBeenCalled()
    expect(clauseCoverageService.fillMissingClauses).not.toHaveBeenCalled()
    expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    expect(result.gpt4?.key_requirements).toHaveLength(4)
    expect(result.gpt4?.key_requirements[0]).toMatchObject({
      clause_id: '5.1.2-a',
      chapter: '5.1.2 过程描述',
      clause_full_text: 'a) 利益相关者分析，明确利益相关者的需求；',
      clause_text: 'a) 利益相关者分析，明确利益相关者的需求；',
      priority: 'MEDIUM',
    })
    expect(result.gpt4?.key_requirements[0].compliance_criteria).toContain(
      '保留能够证明该要求已落实的制度、流程、记录或系统证据',
    )
    expect(result.gpt4?.overview.background).toContain('结构化条款清单')
  })
})
