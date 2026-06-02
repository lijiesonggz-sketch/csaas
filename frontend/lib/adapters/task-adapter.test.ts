import { TaskAdapter } from './task-adapter'

describe('TaskAdapter matrix result metadata', () => {
  it('preserves original maturity model extraction metadata from matrix content', () => {
    const task = {
      id: 'matrix-task-1',
      projectId: 'project-1',
      type: 'matrix',
      status: 'completed',
      input: {},
      progress: 100,
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
      result: {
        content: JSON.stringify({
          matrix: [
            {
              cluster_id: 'category_5_1',
              cluster_name: '5.1 战略规划',
              levels: {
                level_1: { name: '初始级', description: '原文要求', key_practices: ['要求1'] },
                level_2: { name: '受管理级', description: '原文要求', key_practices: ['要求2'] },
                level_3: { name: '稳健级', description: '原文要求', key_practices: ['要求3'] },
                level_4: { name: '量化管理级', description: '原文要求', key_practices: ['要求4'] },
                level_5: { name: '优化级', description: '原文要求', key_practices: ['要求5'] },
              },
            },
          ],
          maturity_model_description: '按原文结构提取成熟度模型',
          generation_mode: 'original_maturity_model',
          extraction_summary: {
            detected: true,
            row_count: 1,
            skipped_process_description_clusters: 1,
          },
        }),
      },
    }

    const result = TaskAdapter.toGenerationResult(task)

    expect(result.selectedResult.matrix).toHaveLength(1)
    expect(result.selectedResult.maturity_model_description).toBe('按原文结构提取成熟度模型')
    expect(result.selectedResult.generation_mode).toBe('original_maturity_model')
    expect(result.selectedResult.extraction_summary).toEqual(
      expect.objectContaining({
        detected: true,
        row_count: 1,
        skipped_process_description_clusters: 1,
      })
    )
  })
})
