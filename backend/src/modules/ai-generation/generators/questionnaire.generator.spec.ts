import { QuestionnaireGenerator } from './questionnaire.generator'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'

describe('QuestionnaireGenerator', () => {
  function createQuestionnaireResponse(clusterId = 'category_5_1', clusterName = '5.1 战略规划') {
    return JSON.stringify({
      questions: Array.from({ length: 5 }, (_, index) => ({
        question_id: `Q${index + 1}`,
        cluster_id: clusterId,
        cluster_name: clusterName,
        dimension: [
          '政策与制度层面',
          '执行与实施层面',
          '监控与度量层面',
          '持续改进层面',
          '证据与合规层面',
        ][index],
        question_text: `问题 ${index + 1}`,
        question_type: index === 1 || index === 4 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE',
        options: [
          { option_id: 'A', text: '初始级实践', score: 1, level: 'level_1' },
          { option_id: 'B', text: '受管理级实践', score: 2, level: 'level_2' },
          { option_id: 'C', text: '稳健级实践', score: 3, level: 'level_3' },
          { option_id: 'D', text: '量化管理级实践', score: 4, level: 'level_4' },
          { option_id: 'E', text: '优化级实践', score: 5, level: 'level_5' },
        ],
        required: true,
        guidance: '请选择最符合当前状态的选项。',
      })),
    })
  }

  const cluster = {
    cluster_id: 'category_5_1',
    cluster_name: '5.1 战略规划',
    levels: {
      level_1: {
        name: '初始级',
        description: '原文第 1 级要求：利益相关者分析。',
        key_practices: ['利益相关者分析。'],
      },
      level_2: {
        name: '受管理级',
        description: '原文第 2 级要求：战略需求评估。',
        key_practices: ['战略需求评估。'],
      },
      level_3: {
        name: '稳健级',
        description: '原文第 3 级要求：战略制定。',
        key_practices: ['战略制定。'],
      },
      level_4: {
        name: '量化管理级',
        description: '原文第 4 级要求：战略发布和宣贯。',
        key_practices: ['战略发布和宣贯。'],
      },
      level_5: {
        name: '优化级',
        description: '原文未明确提供第 5 级要求。',
        key_practices: ['原文未明确提供第 5 级要求。'],
      },
    },
  }

  it('should keep generating a cluster when one model provider fails', async () => {
    const aiOrchestrator = {
      generate: jest.fn((_request, model: AIModel) => {
        if (model === AIModel.DOMESTIC) {
          return Promise.reject(new Error('Tongyi API failed: 403 quota exhausted'))
        }

        return Promise.resolve({
          content: createQuestionnaireResponse(),
          tokens: { total: 100, prompt: 40, completion: 60 },
          cost: 0,
        })
      }),
    }
    const generator = new QuestionnaireGenerator(aiOrchestrator as unknown as AIOrchestrator)

    const result = await generator.generateSingleCluster(cluster, 0, 1)

    expect(aiOrchestrator.generate).toHaveBeenCalledTimes(3)
    expect(result.gpt4).toHaveLength(5)
    expect(result.claude).toHaveLength(5)
    expect(result.domestic).toHaveLength(5)
    expect(result.domestic).toEqual(result.gpt4)
  })
})
