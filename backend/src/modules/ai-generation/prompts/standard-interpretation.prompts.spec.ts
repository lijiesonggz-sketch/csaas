import { fillBatchInterpretationPrompt } from './standard-interpretation.prompts'

describe('standard interpretation batch prompt', () => {
  it('keeps enterprise batch interpretation concise and does not require per-clause references', () => {
    const prompt = fillBatchInterpretationPrompt(
      {
        clauses: [
          {
            clause_id: '5.1.2-a',
            chapter: '5.1 战略管理 > 5.1.2 过程描述',
            clause_full_text: 'a) 利益相关者分析，明确利益相关者的需求；',
          },
          {
            clause_id: '5.1.2-b',
            chapter: '5.1 战略管理 > 5.1.2 过程描述',
            clause_full_text: 'b) 战略需求评估，明确人工智能战略需求范围；',
          },
        ],
        standardDocument: {
          id: 'doc-1',
          name: '人工智能企业智能化成熟度评估模型',
        },
        totalClauseCount: 533,
        currentBatchIndex: 1,
        totalBatches: 54,
      },
      'enterprise',
    )

    expect(prompt).toContain('覆盖完整，表达精炼')
    expect(prompt).toContain('what/why/how每项不超过120字')
    expect(prompt).toContain('数组字段每项不超过3条')
    expect(prompt).not.toContain('references数组')
    expect(prompt).not.toContain('每个条款必须提供1-3个最相关的参考资料')
  })
})
