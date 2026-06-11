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

  it('builds deterministic clustering for appendix-based structured standards without relabeling appendix leaves as the previous numeric section', async () => {
    const aiOrchestrator = { generate: jest.fn() }
    const generator = createGenerator(aiOrchestrator)
    const content = [
      '10.3 残余风险分析',
      '评估人员根据数据处理者决定的风险处置措施，形成记录。',
      '附 录 A',
      '(规范性)',
      '数据安全风险识别内容',
      'A. 1 数据安全管理',
      'A. 1. 1 安全管理制度',
      'A. 1. 1. 1 数据安全制度体系',
      '针对数据安全制度体系建设情况，应重点评估如下方面:',
      'a) 数据安全总体策略、方针、目标和原则制定情况;',
      'd) 关键岗位的数据安全管理操作规程建设情况;',
      'A. 1. 1. 2 数据安全制度落实',
      '针对被评估方数据安全制度落实情况，应重点评估如下方面。',
      'a) 网络安全责任制、数据安全责任制落实情况。',
      'g) 针对重要数据处理者，还应评估以下内容。',
      '1) 对数据处理活动定期开展数据安全风险评估的情况。',
      '2) 向有关部门报送评估报告情况。',
    ].join('\n')

    const result = await generator.generate({
      documents: [
        {
          id: 'doc-gbt-45577',
          name: 'GB/T 45577',
          content,
        },
      ],
      clusteringMode: 'structured',
    })

    const clauses = result.gpt4.categories
      .flatMap((category) => category.clusters)
      .flatMap((cluster) => cluster.clauses)

    expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    expect(result.gpt4.coverage_summary.overall).toEqual({
      total_clauses: 5,
      clustered_clauses: 5,
      coverage_rate: 1,
      coverage_granularity: 'leaf_requirement',
    })
    expect(clauses.map((clause) => clause.clause_id)).toEqual([
      'A.1.1.1-a',
      'A.1.1.1-d',
      'A.1.1.2-a',
      'A.1.1.2-g-1',
      'A.1.1.2-g-2',
    ])
    expect(clauses.map((clause) => clause.clause_id)).not.toContain('10.3-d-1')
    expect(result.gpt4.categories[0]).toMatchObject({
      id: 'category_a_1_1',
      name: 'A.1.1 安全管理制度',
    })
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
    expect(result.gpt4.clustering_logic).toContain('AI语义聚类')
    expect(result.gpt4.clustering_logic).toContain('系统自动归并')
    expect(result.gpt4.generation_mode).toBe('ai')
    expect(result.gpt4.coverage_summary.overall).toMatchObject({
      total_clauses: 2,
      clustered_clauses: 2,
      coverage_rate: 1,
      coverage_granularity: 'leaf_requirement',
    })
    expect(
      result.gpt4.categories
        .flatMap((category) => category.clusters)
        .flatMap((cluster) => cluster.clauses)
        .map((clause) => clause.clause_id),
    ).toContain('5.1.2-b')
    expect(
      result.gpt4.categories.find((category) => category.id === 'category_coverage_backfill'),
    ).toBeUndefined()
  })

  it('assigns missing canonical clause ids into existing semantic clusters when AI returns summary-style clustering', async () => {
    const aiResult = {
      categories: [
        {
          id: 'category-ai',
          name: '摘要式聚类',
          description: '模型只输出了代表性条款',
          clusters: [
            {
              id: 'cluster-ai-1',
              name: '制度建设',
              description: '制度建设要求',
              importance: 'HIGH',
              risk_level: 'HIGH',
              clauses: [
                {
                  source_document_id: 'doc-policy',
                  source_document_name: '监管办法',
                  clause_id: '第一条',
                  clause_text: '第一条 建立制度。',
                  rationale: '代表性条款',
                },
                {
                  source_document_id: 'doc-gbt',
                  source_document_name: 'GB/T 45577',
                  clause_id: 'A.1.1.1',
                  clause_text: '附录评估项编号，不是系统 canonical leaf id。',
                  rationale: '模型使用了附录编号',
                },
              ],
            },
          ],
        },
      ],
      clustering_logic: 'AI只输出代表性条款',
      coverage_summary: {
        by_document: {},
        overall: {
          total_clauses: 0,
          clustered_clauses: 0,
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

    const result = await generator.generate({
      documents: [
        {
          id: 'doc-policy',
          name: '监管办法',
          content: '第一条 建立制度。\n第二条 定期评审制度。',
        },
        {
          id: 'doc-gbt',
          name: 'GB/T 45577',
          content: ['5.2 基础要求', 'a) 建立分类分级制度。', 'b) 明确数据处理责任。'].join('\n'),
        },
      ],
      clusteringMode: 'ai',
    })

    const output = result.gpt4
    expect(output.coverage_summary.overall).toEqual({
      total_clauses: 4,
      clustered_clauses: 4,
      coverage_rate: 1,
      coverage_granularity: undefined,
    })
    expect(output.coverage_summary.by_document['doc-policy']).toMatchObject({
      total_clauses: 2,
      clustered_clauses: 2,
      missing_clause_ids: [],
    })
    expect(output.coverage_summary.by_document['doc-gbt']).toMatchObject({
      total_clauses: 2,
      clustered_clauses: 2,
      missing_clause_ids: [],
      coverage_granularity: 'leaf_requirement',
    })

    const clauseIds = output.categories
      .flatMap((category) => category.clusters)
      .flatMap((cluster) => cluster.clauses)
      .map((clause) => clause.clause_id)

    expect(clauseIds).toEqual(expect.arrayContaining(['第二条', '5.2-a', '5.2-b']))
    expect(output.clustering_logic).toContain('系统自动归并')
    expect(
      output.categories.find((category) => category.id === 'category_coverage_backfill'),
    ).toBeUndefined()
  })

  it('repairs aliased source document ids before calculating missing canonical clauses', async () => {
    const realPbocDocumentId = '93e13f0e-5a76-450b-8bcf-ccfa8d215dcb'
    const aiResult = {
      categories: [
        {
          id: 'category-ai',
          name: '监管制度',
          description: '监管制度要求',
          clusters: [
            {
              id: 'cluster-ai-1',
              name: '制度建立',
              description: '制度建立要求',
              importance: 'HIGH',
              risk_level: 'HIGH',
              clauses: [
                {
                  source_document_id: 'doc_pboc',
                  source_document_name: 'PBOC',
                  clause_id: '第一条',
                  clause_text: '第一条 建立制度。',
                  rationale: '制度建立要求',
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
          clustered_clauses: 0,
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

    const result = await generator.generate({
      documents: [
        {
          id: realPbocDocumentId,
          name: '中国人民银行金融科技监管办法',
          content: '第一条 建立制度。\n第二条 定期评审制度。',
        },
      ],
      clusteringMode: 'ai',
    })

    const output = result.gpt4
    const allClauses = output.categories
      .flatMap((category) => category.clusters)
      .flatMap((cluster) => cluster.clauses)
    const originalClause = allClauses.find((clause) => clause.clause_id === '第一条')
    const backfillCategory = output.categories.find(
      (category) => category.id === 'category_coverage_backfill',
    )

    expect(originalClause).toMatchObject({
      source_document_id: realPbocDocumentId,
      source_document_name: '中国人民银行金融科技监管办法',
      clause_id: '第一条',
    })
    expect(backfillCategory).toBeUndefined()
    expect(allClauses.find((clause) => clause.clause_id === '第二条')).toMatchObject({
      source_document_id: realPbocDocumentId,
      clause_id: '第二条',
    })
    expect(output.coverage_summary.by_document[realPbocDocumentId]).toEqual({
      total_clauses: 2,
      clustered_clauses: 2,
      missing_clause_ids: [],
      coverage_granularity: 'article',
    })
  })

  it('keeps truly unrelated missing canonical clauses in the backfill category', async () => {
    const aiResult = {
      categories: [
        {
          id: 'category-ai',
          name: '访问控制',
          description: '账号身份鉴别和访问控制要求',
          clusters: [
            {
              id: 'cluster-ai-1',
              name: '身份鉴别',
              description: '用户账号认证、身份鉴别和访问控制',
              importance: 'HIGH',
              risk_level: 'HIGH',
              clauses: [
                {
                  source_document_id: 'doc-policy',
                  source_document_name: '测试办法',
                  clause_id: '第一条',
                  clause_text: '第一条 用户账号应进行身份鉴别和访问控制。',
                  rationale: '访问控制主题',
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
          clustered_clauses: 0,
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

    const result = await generator.generate({
      documents: [
        {
          id: 'doc-policy',
          name: '测试办法',
          content: '第一条 用户账号应进行身份鉴别和访问控制。\n第二条 建立灾难恢复和数据备份机制。',
        },
      ],
      clusteringMode: 'ai',
    })

    const backfillCategory = result.gpt4.categories.find(
      (category) => category.id === 'category_coverage_backfill',
    )

    expect(backfillCategory?.clusters).toHaveLength(1)
    expect(backfillCategory?.clusters[0].clauses[0]).toMatchObject({
      source_document_id: 'doc-policy',
      clause_id: '第二条',
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
