import { CrossStandardGenerator } from './cross-standard.generator'

const DOCS = [
  { id: 'doc-a', name: '网信办数据管理办法', content: '第一条 数据留存不少于六个月。'.repeat(3) },
  { id: 'doc-b', name: '工信部数据管理规定', content: '第一条 数据留存不少于十二个月。'.repeat(3) },
]

/** 构造聚类 fixture：1个多来源簇 + 1个单来源簇 */
function makeClusteringFixture() {
  const output = {
    categories: [
      {
        id: 'cat-1',
        name: '数据安全管理',
        description: '数据全生命周期管理要求',
        clusters: [
          {
            id: 'cluster-1',
            name: '日志留存期限',
            description: '数据/日志留存时长要求',
            importance: 'HIGH',
            risk_level: 'HIGH',
            clauses: [
              {
                source_document_id: 'doc-a',
                source_document_name: '网信办数据管理办法',
                clause_id: '12',
                clause_text: '日志留存不少于六个月',
                rationale: '',
              },
              {
                source_document_id: 'doc-b',
                source_document_name: '工信部数据管理规定',
                clause_id: '8',
                clause_text: '日志留存不少于十二个月',
                rationale: '',
              },
            ],
          },
          {
            id: 'cluster-2',
            name: '数据出境申报',
            description: '数据出境安全评估申报',
            importance: 'MEDIUM',
            risk_level: 'MEDIUM',
            clauses: [
              {
                source_document_id: 'doc-a',
                source_document_name: '网信办数据管理办法',
                clause_id: '20',
                clause_text: '数据出境应申报安全评估',
                rationale: '',
              },
            ],
          },
        ],
      },
    ],
    clustering_logic: 'test',
    coverage_summary: {
      by_document: {},
      overall: { total_clauses: 3, clustered_clauses: 3, coverage_rate: 1 },
    },
  }
  return { gpt4: output, claude: output, domestic: output }
}

function mockClusteringGenerator() {
  return { generate: jest.fn().mockResolvedValue(makeClusteringFixture()) }
}

function mockOrchestrator(responses: string[]) {
  let callIndex = 0
  return {
    generate: jest.fn().mockImplementation(() => {
      const content = responses[Math.min(callIndex, responses.length - 1)] ?? '{}'
      callIndex++
      return Promise.resolve({
        content,
        tokens: { input: 0, output: 0, total: 0 },
        cost: 0,
        model: 'mock',
      })
    }),
  }
}

describe('CrossStandardGenerator', () => {
  const relationResponse = JSON.stringify({
    themes: [
      {
        theme_id: 'cluster-1',
        relation: 'CONFLICT',
        relation_rationale: '留存期限要求矛盾',
        document_positions: [
          { document_id: 'doc-a', summary: '留存6个月' },
          { document_id: 'doc-b', summary: '留存12个月' },
        ],
        conflict_points: [
          {
            aspect: '留存期限',
            severity: 'HIGH',
            positions: [
              { document_id: 'doc-a', position: '6个月' },
              { document_id: 'doc-b', position: '12个月' },
            ],
          },
        ],
        unified_baseline: {
          requirement: '日志留存不少于12个月',
          strictest_source_document_id: 'doc-b',
          implementation_notes: '按工信部要求就高执行',
        },
      },
    ],
  })
  const summaryResponse = JSON.stringify({
    baseline_summary: ['日志留存按12个月执行', '出境申报按网信办要求执行', '建立统一台账'],
  })

  it('should mark single-source clusters UNIQUE without AI calls', async () => {
    const clustering = mockClusteringGenerator()
    const orchestrator = mockOrchestrator([relationResponse, summaryResponse])
    const generator = new CrossStandardGenerator(orchestrator as any, clustering as any)
    const result = await generator.generate({ documents: DOCS })
    const output = result.gpt4

    const uniqueTheme = output.themes.find((t) => t.theme_id === 'cluster-2')
    expect(uniqueTheme?.relation).toBe('UNIQUE')
    expect(uniqueTheme?.unified_baseline.requirement).toBeTruthy()
    // AI 只调了关系分析(1) + 汇总(1)，UNIQUE 簇零调用
    expect(orchestrator.generate).toHaveBeenCalledTimes(2)
    // 强制 ai 聚类模式
    expect(clustering.generate.mock.calls[0][0].clusteringMode).toBe('ai')
  })

  it('should analyze multi-source clusters via AI with conflict detail', async () => {
    const orchestrator = mockOrchestrator([relationResponse, summaryResponse])
    const generator = new CrossStandardGenerator(
      orchestrator as any,
      mockClusteringGenerator() as any,
    )
    const result = await generator.generate({ documents: DOCS })
    const output = result.gpt4

    const conflictTheme = output.themes.find((t) => t.theme_id === 'cluster-1')
    expect(conflictTheme?.relation).toBe('CONFLICT')
    expect(conflictTheme?.conflict_detail?.conflict_points[0].aspect).toBe('留存期限')
    expect(conflictTheme?.unified_baseline.strictest_source_document_id).toBe('doc-b')
    expect(conflictTheme?.requirements_by_document.length).toBe(2)
    expect(output.baseline_summary.length).toBeGreaterThanOrEqual(3)
  })

  it('should fall back to conservative OVERLAP when AI batch fails', async () => {
    const orchestrator = mockOrchestrator(['不是JSON', '也不是JSON'])
    const generator = new CrossStandardGenerator(
      orchestrator as any,
      mockClusteringGenerator() as any,
    )
    const result = await generator.generate({ documents: DOCS })
    const output = result.gpt4

    const theme = output.themes.find((t) => t.theme_id === 'cluster-1')
    expect(theme?.relation).toBe('OVERLAP')
    expect(theme?.relation_rationale).toContain('人工复核')
    expect(output.statistics.ai_batch_failures).toBeGreaterThan(0)
    expect(output.baseline_summary.length).toBeGreaterThan(0)
  })

  it('should compute statistics programmatically', async () => {
    const orchestrator = mockOrchestrator([relationResponse, summaryResponse])
    const generator = new CrossStandardGenerator(
      orchestrator as any,
      mockClusteringGenerator() as any,
    )
    const result = await generator.generate({ documents: DOCS })
    const stats = result.gpt4.statistics

    expect(stats.total_themes).toBe(2)
    expect(stats.conflict_count).toBe(1)
    expect(stats.unique_count).toBe(1)
    expect(stats.overlap_count).toBe(0)
    expect(stats.complement_count).toBe(0)
    expect(stats.documents_count).toBe(2)
  })

  it('should reject when fewer than 2 documents provided', async () => {
    const generator = new CrossStandardGenerator(
      mockOrchestrator([]) as any,
      mockClusteringGenerator() as any,
    )
    await expect(generator.generate({ documents: [DOCS[0]] })).rejects.toThrow('至少')
  })

  it('should return same object on all three model slots', async () => {
    const orchestrator = mockOrchestrator([relationResponse, summaryResponse])
    const generator = new CrossStandardGenerator(
      orchestrator as any,
      mockClusteringGenerator() as any,
    )
    const result = await generator.generate({ documents: DOCS })
    expect(result.claude).toBe(result.gpt4)
    expect(result.domestic).toBe(result.gpt4)
    expect(result.gpt4.documents.map((d) => d.id)).toEqual(['doc-a', 'doc-b'])
  })
})
