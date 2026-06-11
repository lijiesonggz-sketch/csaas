import { VersionCompareGenerator } from './version-compare.generator'

const GB_BASE = [
  '4 数据安全要求',
  '4.1 数据分类分级',
  'a) 应建立数据分类分级制度，明确分类分级标准和方法；',
  'b) 应识别重要数据并形成重要数据目录，定期更新；',
  'c) 应对核心数据实施重点保护，限制访问范围；',
  '4.2 数据备份',
  'a) 应建立数据备份机制，定期开展备份演练验证有效性；',
  'b) 应将备份数据异地存放，确保灾难场景可恢复；',
  '4.3 日志审计',
  'a) 应记录数据访问日志并保存不少于六个月；',
].join('\n')

const GB_CHANGED = [
  '4 数据安全要求',
  '4.1 数据分类分级',
  'a) 应建立数据分类分级制度，明确分类分级标准和方法；',
  'b) 应识别重要数据和核心数据并形成目录，每年至少更新一次；',
  'c) 应对核心数据实施重点保护，限制访问范围；',
  '4.2 数据备份',
  'a) 应建立数据备份机制，定期开展备份演练验证有效性；',
  'b) 应将备份数据异地存放，确保灾难场景可恢复；',
  '4.3 日志审计',
  'a) 应记录数据访问日志并保存不少于十二个月，重要操作实时告警；',
].join('\n')

function makeDoc(id: string, name: string, content: string) {
  return { id, name, content }
}

function mockOrchestrator(responses: string[] = []) {
  let callIndex = 0
  return {
    generate: jest.fn().mockImplementation(() => {
      const content = responses[callIndex] ?? responses[responses.length - 1] ?? '{}'
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

describe('VersionCompareGenerator', () => {
  it('should report all unchanged with zero AI calls for identical documents', async () => {
    const orchestrator = mockOrchestrator()
    const generator = new VersionCompareGenerator(orchestrator as any)
    const result = await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '标准v1', GB_BASE),
      newVersion: makeDoc('d2', '标准v2', GB_BASE),
    })

    expect(orchestrator.generate).not.toHaveBeenCalled()
    expect(result.gpt4.statistics.total_added).toBe(0)
    expect(result.gpt4.statistics.total_modified).toBe(0)
    expect(result.gpt4.statistics.total_deleted).toBe(0)
    expect(result.gpt4.statistics.total_unchanged).toBeGreaterThanOrEqual(6)
    expect(result.gpt4.alignment_meta?.mode).toBe('clause')
    // 三槽位返回同一结果（兼容 processor 聚合管线）
    expect(result.claude).toBe(result.gpt4)
    expect(result.domestic).toBe(result.gpt4)
  })

  it('should analyze modified pairs via AI and merge results', async () => {
    const batchResponse = JSON.stringify({
      results: [
        {
          clause_id: '4.1-b',
          change_type: 'MAJOR',
          change_summary: '更新频率明确为每年',
          impact: '需调整目录管理流程',
          migration_guide: '修订制度文件',
        },
        {
          clause_id: '4.3-a',
          change_type: 'MAJOR',
          change_summary: '日志保存延长至12个月',
          impact: '存储扩容',
          migration_guide: '调整日志策略',
        },
      ],
    })
    const summaryResponse = JSON.stringify({
      comparison_summary: '两处实质性收紧',
      migration_recommendations: ['修订制度', '扩容存储', '开展培训'],
    })
    const orchestrator = mockOrchestrator([batchResponse, summaryResponse])
    const generator = new VersionCompareGenerator(orchestrator as any)
    const result = await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '标准v1', GB_BASE),
      newVersion: makeDoc('d2', '标准v2', GB_CHANGED),
    })

    expect(result.gpt4.modified_clauses.length).toBe(2)
    const modified = result.gpt4.modified_clauses.find((m) => m.clause_id === '4.1-b')
    expect(modified?.change_type).toBe('MAJOR')
    expect(modified?.migration_guide).toBe('修订制度文件')
    expect(result.gpt4.statistics.total_modified).toBe(2)
    expect(result.gpt4.migration_recommendations.length).toBeGreaterThanOrEqual(3)
  })

  it('should fall back to heuristic when AI batch returns garbage', async () => {
    const orchestrator = mockOrchestrator(['完全不是JSON', '也不是JSON'])
    const generator = new VersionCompareGenerator(orchestrator as any)
    const result = await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '标准v1', GB_BASE),
      newVersion: makeDoc('d2', '标准v2', GB_CHANGED),
    })

    expect(result.gpt4.modified_clauses.length).toBe(2)
    result.gpt4.modified_clauses.forEach((m) => {
      expect(['MINOR', 'MAJOR']).toContain(m.change_type)
      expect(m.impact).toContain('人工复核')
    })
    expect(result.gpt4.alignment_meta?.ai_batch_failures).toBeGreaterThan(0)
    // 摘要失败时仍有程序化兜底
    expect(result.gpt4.migration_recommendations.length).toBeGreaterThanOrEqual(3)
  })

  it('should use ai_fallback mode for small unstructured documents', async () => {
    const fallbackResponse = JSON.stringify({
      version_info: { old_version: 'v1', new_version: 'v2', comparison_summary: '整体修订' },
      added_clauses: [],
      modified_clauses: [],
      deleted_clauses: [],
      migration_recommendations: ['建议1', '建议2', '建议3'],
    })
    const orchestrator = mockOrchestrator([fallbackResponse])
    const generator = new VersionCompareGenerator(orchestrator as any)
    const oldDoc =
      '本指南介绍数据安全管理的总体思路与落地路径，适用于各类企业开展自评工作时参考使用。'
    const newDoc =
      '本指南介绍数据安全管理体系的总体思路与实施路径，适用于各行业企业开展评估工作时参考。'
    const result = await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '指南v1', oldDoc),
      newVersion: makeDoc('d2', '指南v2', newDoc),
    })

    expect(orchestrator.generate).toHaveBeenCalledTimes(1)
    expect(result.gpt4.alignment_meta?.mode).toBe('ai_fallback')
    expect(result.gpt4.version_info.comparison_summary).toBe('整体修订')
  })

  it('should analyze added and deleted clauses and compute change_percentage programmatically', async () => {
    const GB_WITH_NEW = GB_BASE + '\nb) 应对日志开展月度审计并留存审计报告备查；'
    const addedDeletedResponse = JSON.stringify({
      added: [{ clause_id: '4.3-b', impact: '新增月度审计义务', action_required: '建立审计流程' }],
      deleted: [],
    })
    const summaryResponse = JSON.stringify({
      comparison_summary: '新增一条审计要求',
      migration_recommendations: ['建立流程', '指定责任人', '准备模板'],
    })
    const orchestrator = mockOrchestrator([addedDeletedResponse, summaryResponse])
    const generator = new VersionCompareGenerator(orchestrator as any)
    const result = await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '标准v1', GB_BASE),
      newVersion: makeDoc('d2', '标准v2', GB_WITH_NEW),
    })

    expect(result.gpt4.added_clauses.length).toBe(1)
    expect(result.gpt4.added_clauses[0].clause_id).toBe('4.3-b')
    expect(result.gpt4.added_clauses[0].action_required).toBe('建立审计流程')
    expect(result.gpt4.statistics.total_added).toBe(1)
    // 程序化变更率：1变更 / 6旧条款
    expect(result.gpt4.statistics.change_percentage).toBeCloseTo(1 / 6, 2)
  })

  it('should report progress through onProgress callback', async () => {
    const orchestrator = mockOrchestrator(['{}', '{}'])
    const generator = new VersionCompareGenerator(orchestrator as any)
    const progressEvents: any[] = []
    await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '标准v1', GB_BASE),
      newVersion: makeDoc('d2', '标准v2', GB_CHANGED),
      onProgress: (p) => progressEvents.push(p),
    })

    expect(progressEvents.length).toBeGreaterThan(0)
    expect(progressEvents[progressEvents.length - 1].current).toBe(100)
  })

  it('should keep all legacy output fields for frontend compatibility', async () => {
    const orchestrator = mockOrchestrator()
    const generator = new VersionCompareGenerator(orchestrator as any)
    const result = await generator.compareVersionsEnhanced({
      oldVersion: makeDoc('d1', '标准v1', GB_BASE),
      newVersion: makeDoc('d2', '标准v2', GB_BASE),
    })
    const output = result.gpt4
    expect(output.version_info).toBeDefined()
    expect(Array.isArray(output.added_clauses)).toBe(true)
    expect(Array.isArray(output.modified_clauses)).toBe(true)
    expect(Array.isArray(output.deleted_clauses)).toBe(true)
    expect(output.statistics.total_added).toBeDefined()
    expect(output.statistics.change_percentage).toBeDefined()
    expect(Array.isArray(output.migration_recommendations)).toBe(true)
  })
})
