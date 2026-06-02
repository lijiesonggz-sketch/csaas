import {
  calculateCoverageFromClauseIds,
  extractClauseIdsFromContent,
  normalizeClauseId,
} from './clauseIds'

describe('clauseIds', () => {
  it('extracts AIMM-style leaf requirements as the lowest evaluable units', () => {
    const content = [
      '5.1.2 过程描述',
      '过程描述如下：',
      'a) 利益相关者分析，明确利益相关者的需求；',
      'b) 战略需求评估，明确人工智能战略需求范围；',
      '5.1.3 能力等级标准',
      '能力等级标准如下。',
      'c) 第 3 级，稳健级：',
      '1) 开展利益相关者分析并明确其需求；',
      '2) 开展人工智能发展战略需求评估。',
    ].join('\n')

    expect(extractClauseIdsFromContent(content)).toEqual([
      '5.1.2-a',
      '5.1.2-b',
      '5.1.3-c-1',
      '5.1.3-c-2',
    ])
  })

  it('normalizes clustered child requirement ids before comparing coverage', () => {
    expect(
      calculateCoverageFromClauseIds(
        ['5.1.2-a', '5.1.2-b', '5.1.3-c-1', '5.1.3-c-2'],
        ['5.1.2 a)', '5.1.3 c) 2)']
      )
    ).toEqual({
      total_clauses: 4,
      clustered_clauses: 2,
      missing_clause_ids: ['5.1.2-b', '5.1.3-c-1'],
      coverage_granularity: 'leaf_requirement',
    })
  })

  it('keeps article-level coverage for documents without leaf requirements', () => {
    const ids = extractClauseIdsFromContent('第十条 建立管理制度。\n第十一条 定期开展评审。')

    expect(ids).toEqual(['第十条', '第十一条'])
    expect(calculateCoverageFromClauseIds(ids, ['第十条'])).toEqual({
      total_clauses: 2,
      clustered_clauses: 1,
      missing_clause_ids: ['第十一条'],
      coverage_granularity: 'article',
    })
  })

  it('counts child clustered ids against parent section inventories when a document has no leaves', () => {
    expect(calculateCoverageFromClauseIds(['5.1', '5.2'], ['5.1.2 a)'])).toEqual({
      total_clauses: 2,
      clustered_clauses: 1,
      missing_clause_ids: ['5.2'],
      coverage_granularity: 'section',
    })
  })

  it('does not treat scoring values and citation numbers as standalone requirements', () => {
    const content = [
      '12.1 成熟度满足程度',
      '表 26 智能化能力项要求满足程度与得分对应',
      '全部满足 1',
      '大部分满足 0.8',
      '部分满足 0.5',
      '[来源：GB/T 41867—2022，3.1.2]',
    ].join('\n')

    expect(extractClauseIdsFromContent(content)).toEqual(['12.1'])
  })

  it('preserves non-numbered generated capability ids for fallback coverage', () => {
    expect(normalizeClauseId('战略管理-规范级')).toBe('战略管理-规范级')
  })
})
