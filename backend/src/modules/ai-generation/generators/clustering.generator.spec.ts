import { ClusteringGenerator, Category } from './clustering.generator'

describe('ClusteringGenerator coverage recalculation', () => {
  const createGenerator = (aiOrchestrator: any = {}) =>
    new ClusteringGenerator(
      aiOrchestrator as any,
      { get: jest.fn().mockReturnValue(10) } as any,
      {} as any,
    )

  it('builds deterministic clustering from a single structured AIMM document without calling AI', async () => {
    const aiOrchestrator = { generate: jest.fn() }
    const generator = createGenerator(aiOrchestrator)
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

    const result = await generator.generate({
      documents: [
        {
          id: 'doc-aimm',
          name: 'AIMM标准',
          content,
        },
      ],
    })

    expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    expect(result.gpt4).toEqual(result.claude)
    expect(result.gpt4).toEqual(result.domestic)
    expect(result.gpt4.coverage_summary.overall).toEqual({
      total_clauses: 4,
      clustered_clauses: 4,
      coverage_rate: 1,
      coverage_granularity: 'leaf_requirement',
    })

    const clauses = result.gpt4.categories
      .flatMap((category) => category.clusters)
      .flatMap((cluster) => cluster.clauses)

    expect(clauses.map((clause) => clause.clause_id)).toEqual([
      '5.1.2-a',
      '5.1.2-b',
      '5.1.3-c-1',
      '5.1.3-c-2',
    ])
    expect(clauses[0]).toMatchObject({
      source_document_id: 'doc-aimm',
      source_document_name: 'AIMM标准',
      clause_text: 'a) 利益相关者分析，明确利益相关者的需求；',
    })
    expect(result.gpt4.categories[0]).toMatchObject({
      id: 'category_5_1',
      name: '5.1 战略管理',
    })
    expect(result.gpt4.clustering_logic).toContain('原始层级')
  })

  it('uses AI semantic clustering when requested even if the document is structured', async () => {
    const aiResult = {
      categories: [
        {
          id: 'category-ai',
          name: 'AI语义聚类',
          description: 'AI语义聚类结果',
          clusters: [
            {
              id: 'cluster-ai',
              name: '战略需求主题',
              description: 'AI重新归并后的主题',
              importance: 'MEDIUM',
              risk_level: 'MEDIUM',
              clauses: [
                {
                  source_document_id: 'doc-aimm',
                  source_document_name: 'AIMM标准',
                  clause_id: '5.1.2-a',
                  clause_text: 'a) 利益相关者分析，明确利益相关者的需求；',
                  rationale: 'AI语义归并',
                },
              ],
            },
          ],
        },
      ],
      clustering_logic: 'AI语义聚类',
      coverage_summary: {
        by_document: {},
        overall: {
          total_clauses: 0,
          clustered_clauses: 1,
          coverage_rate: 0,
        },
      },
    }
    const aiOrchestrator = {
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify(aiResult),
        tokens: { total: 100 },
        cost: 0.01,
      }),
    }
    const generator = createGenerator(aiOrchestrator)
    const content = [
      '5 人工智能治理',
      '5.1 战略管理',
      '5.1.2 过程描述',
      'a) 利益相关者分析，明确利益相关者的需求；',
      'b) 战略需求评估，明确人工智能战略需求范围；',
    ].join('\n')

    const result = await generator.generate({
      documents: [
        {
          id: 'doc-aimm',
          name: 'AIMM标准',
          content,
        },
      ],
      clusteringMode: 'ai',
    })

    expect(aiOrchestrator.generate).toHaveBeenCalled()
    expect(result.gpt4.clustering_logic).toBe('AI语义聚类')
    expect(result.gpt4.generation_mode).toBe('ai')
    expect(result.gpt4.coverage_summary.overall).toMatchObject({
      total_clauses: 2,
      clustered_clauses: 1,
      coverage_rate: 0.5,
      coverage_granularity: 'leaf_requirement',
    })
  })

  it('uses clustered clause ids as the denominator when document ids cannot be matched', () => {
    const generator = createGenerator() as any
    const categories: Category[] = [
      {
        id: 'category-1',
        name: '战略管理',
        description: '战略管理相关要求',
        clusters: [
          {
            id: 'cluster-1',
            name: '战略规划',
            description: '战略规划要求',
            importance: 'HIGH',
            risk_level: 'HIGH',
            clauses: [
              {
                source_document_id: 'doc-1',
                source_document_name: 'GB/T 33136',
                clause_id: '战略管理-规范级',
                clause_text: '制定数据中心战略规划',
                rationale: '同属战略管理能力项',
              },
              {
                source_document_id: 'doc-1',
                source_document_name: 'GB/T 33136',
                clause_id: '战略管理-先进级',
                clause_text: '战略规划与组织战略对齐',
                rationale: '同属战略管理能力项',
              },
            ],
          },
        ],
      },
    ]

    const coverage = generator.generateDefaultCoverage(categories, [
      {
        id: 'doc-1',
        name: 'GB/T 33136',
        content: '7. 1 战略管理\n规范级 制定数据中心战略规划\n先进级 战略规划与组织战略对齐',
      },
    ])

    expect(coverage.overall).toEqual({
      total_clauses: 2,
      clustered_clauses: 2,
      coverage_rate: 1,
      coverage_granularity: 'generated',
    })
    expect(coverage.by_document['doc-1']).toEqual({
      total_clauses: 2,
      clustered_clauses: 2,
      missing_clause_ids: [],
      coverage_granularity: 'generated',
    })
  })

  it('keeps missing-clause detection when document clause ids match clustered ids', () => {
    const generator = createGenerator() as any
    const categories: Category[] = [
      {
        id: 'category-1',
        name: '安全要求',
        description: '安全要求',
        clusters: [
          {
            id: 'cluster-1',
            name: '制度要求',
            description: '制度要求',
            importance: 'HIGH',
            risk_level: 'MEDIUM',
            clauses: [
              {
                source_document_id: 'doc-1',
                source_document_name: '测试标准',
                clause_id: '第一条',
                clause_text: '建立制度',
                rationale: '制度要求',
              },
            ],
          },
        ],
      },
    ]

    const coverage = generator.generateDefaultCoverage(categories, [
      {
        id: 'doc-1',
        name: '测试标准',
        content: '第一条 建立制度\n第二条 定期评审制度',
      },
    ])

    expect(coverage.overall).toEqual({
      total_clauses: 2,
      clustered_clauses: 1,
      coverage_rate: 0.5,
      coverage_granularity: 'article',
    })
    expect(coverage.by_document['doc-1'].missing_clause_ids).toEqual(['第二条'])
  })
})
