import {
  calculateCoverageFromClauseIds,
  extractClauseIdsFromContent,
  extractStructuredLeafRequirementsFromContent,
  normalizeClauseId,
} from './clause-id-utils'

describe('clause-id-utils requirement inventory extraction', () => {
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

  it('extracts structured sections with parent headings and requirement text', () => {
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

    expect(extractStructuredLeafRequirementsFromContent(content)).toEqual([
      {
        id: '5.1.2',
        title: '过程描述',
        parentId: '5.1',
        parentTitle: '战略管理',
        requirements: [
          {
            id: '5.1.2-a',
            sectionId: '5.1.2',
            sectionTitle: '过程描述',
            text: 'a) 利益相关者分析，明确利益相关者的需求；',
          },
          {
            id: '5.1.2-b',
            sectionId: '5.1.2',
            sectionTitle: '过程描述',
            text: 'b) 战略需求评估，明确人工智能战略需求范围；',
          },
        ],
      },
      {
        id: '5.1.3',
        title: '能力等级标准',
        parentId: '5.1',
        parentTitle: '战略管理',
        requirements: [
          {
            id: '5.1.3-c-1',
            sectionId: '5.1.3',
            sectionTitle: '能力等级标准',
            text: 'c) 第 3 级，稳健级：\n1) 开展利益相关者分析并明确其需求；',
          },
          {
            id: '5.1.3-c-2',
            sectionId: '5.1.3',
            sectionTitle: '能力等级标准',
            text: 'c) 第 3 级，稳健级：\n2) 开展人工智能发展战略需求评估。',
          },
        ],
      },
    ])
  })

  it('removes PDF page artifacts and stops a leaf requirement at the next top-level heading', () => {
    const content = [
      '4.2 成熟度评估等级',
      '4.2.1 初始级',
      '具体特征如下：',
      'a) 在人才、资金、算力、算法模型等方面开展智能化建设的初期筹备；',
      'b) 缺乏企业级统一的人工智能战略规划，主要是被动式管理人工智能应用；',
      'c) 仅在少数场景开展人工智能技术试点，智能化探索规模较小且分散；',
      '-- 7 of 38 --',
      'GB/T XXXXX—XXXX',
      '6',
      'd) 处于智能化探索起步阶段，短时间内尚未取得明显业务效益。',
      '4.2.5 优化级',
      '具体特征如下：',
      'a) 企业的统一智能化应用与管理平台等能够支撑产业链上下游的智能化升级应用需求；',
      'b) AI催生新产品和新服务，构建高度开放协同的产业智能体互联生态；',
      'c) 主导国家、行业等相关标准制定工作，对外输出智能化最佳实践，成为行业智能化发展的标杆',
      '并创造价值。',
      '5 战略管理',
      '5.1 战略规划',
      '5.1.1 概述',
    ].join('\n')

    const sections = extractStructuredLeafRequirementsFromContent(content)
    const requirements = sections.flatMap((section) => section.requirements)

    expect(requirements.find((requirement) => requirement.id === '4.2.1-c')?.text).toBe(
      'c) 仅在少数场景开展人工智能技术试点，智能化探索规模较小且分散；',
    )
    expect(requirements.find((requirement) => requirement.id === '4.2.5-c')?.text).toBe(
      'c) 主导国家、行业等相关标准制定工作，对外输出智能化最佳实践，成为行业智能化发展的标杆\n并创造价值。',
    )
  })

  it('normalizes clustered child requirement ids before comparing coverage', () => {
    const documentIds = ['5.1.2-a', '5.1.2-b', '5.1.3-c-1', '5.1.3-c-2']
    const coverage = calculateCoverageFromClauseIds(documentIds, ['5.1.2 a)', '5.1.3 c) 2)'])

    expect(coverage).toEqual({
      total_clauses: 4,
      clustered_clauses: 2,
      missing_clause_ids: ['5.1.2-b', '5.1.3-c-1'],
      coverage_granularity: 'leaf_requirement',
    })
  })

  it('keeps article-level coverage for documents without leaf requirements', () => {
    const content = '第十条 建立管理制度。\n第十一条 定期开展评审。'

    expect(extractClauseIdsFromContent(content)).toEqual(['第十条', '第十一条'])
    expect(
      calculateCoverageFromClauseIds(extractClauseIdsFromContent(content), ['第十条']),
    ).toEqual({
      total_clauses: 2,
      clustered_clauses: 1,
      missing_clause_ids: ['第十一条'],
      coverage_granularity: 'article',
    })
  })

  it('counts child clustered ids against parent section inventories when a document has no leaves', () => {
    const coverage = calculateCoverageFromClauseIds(['5.1', '5.2'], ['5.1.2 a)'])

    expect(coverage).toEqual({
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
