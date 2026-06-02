import { MatrixGenerator } from './matrix.generator'

describe('MatrixGenerator original maturity model extraction', () => {
  function createGenerator() {
    const aiOrchestrator = {
      generate: jest.fn(),
    }
    const configService = {
      get: jest.fn().mockReturnValue(600000),
    }

    return {
      generator: new MatrixGenerator(aiOrchestrator as any, configService as any),
      aiOrchestrator,
    }
  }

  const baseClause = {
    source_document_id: 'doc-1',
    source_document_name: '人工智能企业智能化成熟度评估.pdf',
    rationale: '保留原标准结构',
  }

  it('should extract an original maturity model from capability-level standard clusters without calling AI', async () => {
    const { generator, aiOrchestrator } = createGenerator()
    const onProgress = jest.fn()

    const result = await generator.generate(
      {
        clusteringResult: {
          generation_mode: 'structured',
          clustering_logic: '按原始层级自动映射',
          coverage_summary: {
            by_document: {},
            overall: {
              total_clauses: 5,
              clustered_clauses: 5,
              coverage_rate: 1,
              coverage_granularity: 'leaf_requirement',
            },
          },
          categories: [
            {
              id: 'category_5_1',
              name: '5.1 战略规划',
              description: '按原标准结构保留 5.1 战略规划 下的要求项。',
              clusters: [
                {
                  id: 'cluster_5_1_2',
                  name: '5.1.2 过程描述',
                  description: '过程描述',
                  importance: 'MEDIUM',
                  risk_level: 'MEDIUM',
                  clauses: [
                    {
                      ...baseClause,
                      clause_id: '5.1.2-a',
                      clause_text: 'a) 利益相关者分析，明确利益相关者的需求；',
                    },
                  ],
                },
                {
                  id: 'cluster_5_1_3',
                  name: '5.1.3 能力等级标准',
                  description: '能力等级标准',
                  importance: 'MEDIUM',
                  risk_level: 'MEDIUM',
                  clauses: [
                    {
                      ...baseClause,
                      clause_id: '5.1.3-a-1',
                      clause_text:
                        'a) 第 1 级，初始级：\n1) 个别人员意识到人工智能技术的引入和管理将会使组织获益；',
                    },
                    {
                      ...baseClause,
                      clause_id: '5.1.3-b-1',
                      clause_text:
                        'b) 第 2 级，受管理级：\n1) 组织识别与人工智能发展的利益相关者；',
                    },
                    {
                      ...baseClause,
                      clause_id: '5.1.3-c-1',
                      clause_text: 'c) 第 3 级，稳健级：\n1) 开展利益相关者分析并明确其需求；',
                    },
                    {
                      ...baseClause,
                      clause_id: '5.1.3-d-1',
                      clause_text: 'd) 第 4 级，量化管理级：\n1) 建立战略执行量化指标；',
                    },
                    {
                      ...baseClause,
                      clause_id: '5.1.3-e-1',
                      clause_text:
                        'e) 第 5 级，优化级：\n1) 人工智能发展战略可有效提升企业竞争力；',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      onProgress,
    )

    expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    expect(result.gpt4).toBe(result.claude)
    expect(result.gpt4).toBe(result.domestic)
    expect(result.gpt4.generation_mode).toBe('original_maturity_model')
    expect(result.gpt4.matrix).toHaveLength(1)
    expect(result.gpt4.matrix[0].cluster_name).toBe('5.1 战略规划')
    expect(result.gpt4.matrix[0].levels.level_1.name).toBe('初始级')
    expect(result.gpt4.matrix[0].levels.level_2.name).toBe('受管理级')
    expect(result.gpt4.matrix[0].levels.level_3.name).toBe('稳健级')
    expect(result.gpt4.matrix[0].levels.level_4.name).toBe('量化管理级')
    expect(result.gpt4.matrix[0].levels.level_5.name).toBe('优化级')
    expect(result.gpt4.matrix[0].levels.level_1.key_practices[0]).toContain('个别人员意识到')
    expect(result.gpt4.extraction_summary?.skipped_process_description_clusters).toBe(1)
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 1,
        total: 1,
        message: expect.stringContaining('按原文提取成熟度模型'),
      }),
    )
  })

  it('should extract the overall maturity-level definition row from maturity level categories', async () => {
    const { generator } = createGenerator()

    const result = await generator.generate({
      clusteringResult: {
        generation_mode: 'structured',
        clustering_logic: '按原始层级自动映射',
        coverage_summary: {
          by_document: {},
          overall: {
            total_clauses: 5,
            clustered_clauses: 5,
            coverage_rate: 1,
            coverage_granularity: 'leaf_requirement',
          },
        },
        categories: [
          {
            id: 'category_4_2',
            name: '4.2 成熟度评估等级',
            description: '按原标准结构保留 4.2 成熟度评估等级 下的要求项。',
            clusters: [
              {
                id: 'cluster_4_2_1',
                name: '4.2.1 初始级',
                description: '初始级',
                importance: 'MEDIUM',
                risk_level: 'MEDIUM',
                clauses: [
                  {
                    ...baseClause,
                    clause_id: '4.2.1-a',
                    clause_text: 'a) 在人才、资金、算力、算法模型等方面开展智能化建设的初期筹备；',
                  },
                ],
              },
              {
                id: 'cluster_4_2_2',
                name: '4.2.2 受管理级',
                description: '受管理级',
                importance: 'MEDIUM',
                risk_level: 'MEDIUM',
                clauses: [
                  {
                    ...baseClause,
                    clause_id: '4.2.2-a',
                    clause_text: 'a) 具备部门层面的小型算力基础设施及AI模型运行环境；',
                  },
                ],
              },
              {
                id: 'cluster_4_2_3',
                name: '4.2.3 稳健级',
                description: '稳健级',
                importance: 'MEDIUM',
                risk_level: 'MEDIUM',
                clauses: [
                  {
                    ...baseClause,
                    clause_id: '4.2.3-a',
                    clause_text: 'a) 制定详细的人工智能发展战略和规划；',
                  },
                ],
              },
              {
                id: 'cluster_4_2_4',
                name: '4.2.4 量化管理级',
                description: '量化管理级',
                importance: 'MEDIUM',
                risk_level: 'MEDIUM',
                clauses: [
                  {
                    ...baseClause,
                    clause_id: '4.2.4-a',
                    clause_text: 'a) 实现核心智能化资源的全局智能调度与实时动态监控；',
                  },
                ],
              },
              {
                id: 'cluster_4_2_5',
                name: '4.2.5 优化级',
                description: '优化级',
                importance: 'MEDIUM',
                risk_level: 'MEDIUM',
                clauses: [
                  {
                    ...baseClause,
                    clause_id: '4.2.5-a',
                    clause_text: 'a) 企业的统一智能化应用与管理平台支撑产业链升级；',
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(result.gpt4.matrix).toHaveLength(1)
    expect(result.gpt4.matrix[0].cluster_name).toBe('4.2 成熟度评估等级')
    expect(result.gpt4.matrix[0].levels.level_1.key_practices[0]).toContain('初期筹备')
    expect(result.gpt4.matrix[0].levels.level_5.key_practices[0]).toContain('产业链升级')
  })

  it('should keep ordinary clustering results on the existing AI generation path', async () => {
    const { generator, aiOrchestrator } = createGenerator()
    const row = {
      cluster_id: 'cluster_access_control',
      cluster_name: '访问控制',
      levels: {
        level_1: { name: '初始级', description: '初始级描述', key_practices: ['实践1'] },
        level_2: { name: '可重复级', description: '可重复级描述', key_practices: ['实践2'] },
        level_3: { name: '已定义级', description: '已定义级描述', key_practices: ['实践3'] },
        level_4: { name: '可管理级', description: '可管理级描述', key_practices: ['实践4'] },
        level_5: { name: '优化级', description: '优化级描述', key_practices: ['实践5'] },
      },
    }
    aiOrchestrator.generate.mockResolvedValue({
      content: JSON.stringify(row),
      tokens: { total: 10 },
      cost: 0,
    })

    const result = await generator.generate({
      clusteringResult: {
        generation_mode: 'ai',
        clustering_logic: 'AI语义聚类',
        coverage_summary: {
          by_document: {},
          overall: {
            total_clauses: 1,
            clustered_clauses: 1,
            coverage_rate: 1,
          },
        },
        categories: [
          {
            id: 'category_security',
            name: '安全管理',
            description: '安全管理',
            clusters: [
              {
                id: 'cluster_access_control',
                name: '访问控制',
                description: '访问控制要求',
                importance: 'HIGH',
                risk_level: 'HIGH',
                clauses: [
                  {
                    ...baseClause,
                    clause_id: '第1条',
                    clause_text: '应建立访问控制机制。',
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    expect(aiOrchestrator.generate).toHaveBeenCalledTimes(2)
    expect(result.gpt4.matrix[0].cluster_name).toBe('访问控制')
  })
})
