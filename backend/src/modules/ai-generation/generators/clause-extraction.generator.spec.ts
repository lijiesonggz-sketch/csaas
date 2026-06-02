import { ClauseExtractionGenerator } from './clause-extraction.generator'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'

describe('ClauseExtractionGenerator', () => {
  function createGenerator() {
    const aiOrchestrator = {
      generate: jest.fn(),
    }

    return {
      generator: new ClauseExtractionGenerator(aiOrchestrator as any),
      aiOrchestrator,
    }
  }

  it('extracts structured leaf requirements deterministically without calling AI', async () => {
    const { generator, aiOrchestrator } = createGenerator()
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

    const result = await generator.extractClauses({
      standardDocument: {
        id: 'doc-1',
        name: '人工智能企业智能化成熟度评估模型',
        content,
      },
      expectedClauseCount: 2,
    })

    expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    expect(result.claude).toBeNull()
    expect(result.domestic).toBeNull()
    expect(result.gpt4).toMatchObject({
      total_clauses: 4,
      extraction_metadata: {
        extraction_method: 'structured_leaf_requirement',
        confidence: 1,
      },
    })
    expect(result.gpt4?.clauses.map((clause) => clause.clause_id)).toEqual([
      '5.1.2-a',
      '5.1.2-b',
      '5.1.3-c-1',
      '5.1.3-c-2',
    ])
    expect(result.gpt4?.clauses[0]).toMatchObject({
      clause_full_text: 'a) 利益相关者分析，明确利益相关者的需求；',
      chapter: '5.1 战略管理 > 5.1.2 过程描述',
    })
  })

  it('falls back to AI extraction for documents without structured leaf requirements', async () => {
    const { generator, aiOrchestrator } = createGenerator()
    aiOrchestrator.generate.mockResolvedValue({
      content: JSON.stringify({
        total_clauses: 1,
        clauses: [
          {
            clause_id: '第十条',
            clause_full_text: '第十条 建立管理制度。',
          },
        ],
      }),
      tokens: { prompt: 1, completion: 1, total: 2 },
      cost: 0,
      model: 'glm-5',
    })

    const result = await generator.extractClauses({
      standardDocument: {
        id: 'doc-1',
        name: '普通标准',
        content: '第十条 建立管理制度。',
      },
      expectedClauseCount: 1,
    })

    expect(aiOrchestrator.generate).toHaveBeenCalledWith(expect.any(Object), AIModel.GPT4)
    expect(result.gpt4?.clauses).toEqual([
      {
        clause_id: '第十条',
        clause_full_text: '第十条 建立管理制度。',
      },
    ])
  })
})
