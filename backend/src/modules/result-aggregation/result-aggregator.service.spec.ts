import { AITaskType } from '../../database/entities/ai-task.entity'
import { ConfidenceLevel, SelectedModel } from '../../database/entities/ai-generation-result.entity'
import { FullValidationReport } from '../quality-validation/quality-validation.service'
import { ResultAggregatorService } from './result-aggregator.service'

describe('ResultAggregatorService', () => {
  const validationReport: FullValidationReport = {
    qualityScores: {
      structural: 0.9,
      semantic: 0.8,
      detail: 0.85,
    },
    consistencyReport: {
      agreements: [],
      disagreements: [],
      highRiskDisagreements: [],
      structuralScore: 0.9,
      semanticScore: 0.8,
      detailScore: 0.85,
      overallScore: 0.85,
    },
    overallScore: 0.85,
    confidenceLevel: 'HIGH',
    passed: true,
  }

  function createService() {
    const repository = {
      create: jest.fn((value) => ({ id: 'generation-result-1', ...value })),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      update: jest.fn(),
    }

    return {
      service: new ResultAggregatorService(repository as any),
      repository,
    }
  }

  function makeQuestion(
    questionNumber: number,
    clusterId: string,
    clusterName: string,
    modelText: string,
    overrides: Record<string, any> = {},
  ) {
    return {
      question_id: `Q${questionNumber.toString().padStart(3, '0')}`,
      cluster_id: clusterId,
      cluster_name: clusterName,
      question_text: `${clusterName}${modelText}第${questionNumber}题是否达到对应成熟度要求？`,
      question_type: 'SINGLE_CHOICE',
      options: [1, 2, 3, 4, 5].map((score) => ({
        option_id: String.fromCharCode(64 + score),
        text: `${clusterName}${modelText}成熟度${score}级`,
        score,
        level: `level_${score}`,
      })),
      required: true,
      guidance: `请按${clusterName}实际情况选择。`,
      ...overrides,
    }
  }

  function makeQuestionnaire(
    groups: Array<{
      clusterId: string
      clusterName: string
      modelText: string
      poor?: boolean
    }>,
  ) {
    const questionnaire = groups.flatMap((group, groupIndex) =>
      Array.from({ length: 5 }, (_, index) => {
        const questionNumber = groupIndex * 5 + index + 1
        if (group.poor) {
          return makeQuestion(questionNumber, group.clusterId, group.clusterName, group.modelText, {
            question_text: `通用问题${questionNumber}`,
            options: index === 0 ? [] : [{ option_id: 'A', text: '不清楚', score: 0 }],
            guidance: '',
          })
        }

        return makeQuestion(questionNumber, group.clusterId, group.clusterName, group.modelText)
      }),
    )

    return {
      questionnaire,
      questionnaire_metadata: {
        total_questions: questionnaire.length,
        estimated_time_minutes: Math.ceil(questionnaire.length * 0.5),
        coverage_map: questionnaire.reduce<Record<string, number>>((coverage, question) => {
          coverage[question.cluster_id] = (coverage[question.cluster_id] || 0) + 1
          return coverage
        }, {}),
      },
    }
  }

  it('非问卷任务保持原有模型优先级兜底', async () => {
    const { service } = createService()
    const claudeResult = { matrix: [{ cluster_id: 'row-1' }] }
    const domesticResult = { matrix: [{ cluster_id: 'row-2' }] }

    const output = await service.aggregate({
      taskId: 'matrix-task-1',
      generationType: AITaskType.MATRIX,
      gpt4Result: null,
      claudeResult,
      domesticResult,
      validationReport,
    })

    expect(output.selectedModel).toBe(SelectedModel.CLAUDE)
    expect(output.selectedResult).toBe(claudeResult)
    expect(output.confidenceLevel).toBe(ConfidenceLevel.HIGH)
  })

  it('问卷只有两个模型有结果时直接选择 DeepSeek/gpt4 槽位，不做逐行混合打分', async () => {
    const { service } = createService()
    const gpt4Result = makeQuestionnaire([
      { clusterId: 'row-1', clusterName: '数据战略', modelText: 'DeepSeek' },
    ])
    const claudeResult = makeQuestionnaire([
      { clusterId: 'row-1', clusterName: '数据战略', modelText: 'Claude' },
    ])

    const output = await service.aggregate({
      taskId: 'questionnaire-task-1',
      generationType: AITaskType.QUESTIONNAIRE,
      gpt4Result,
      claudeResult,
      domesticResult: null,
      validationReport,
      matrixResult: {
        matrix: [{ cluster_id: 'row-1', cluster_name: '数据战略', levels: {} }],
      },
    })

    expect(output.selectedModel).toBe(SelectedModel.GPT4)
    expect(output.selectedResult).toBe(gpt4Result)
  })

  it('问卷三个模型都有结果时按矩阵行选择质量最高的问题组并重建元数据', async () => {
    const { service } = createService()
    const gpt4Result = makeQuestionnaire([
      { clusterId: 'row-1', clusterName: '数据战略', modelText: 'DeepSeek', poor: true },
      { clusterId: 'row-2', clusterName: '数据治理', modelText: 'DeepSeek' },
    ])
    const claudeResult = makeQuestionnaire([
      { clusterId: 'row-1', clusterName: '数据战略', modelText: 'Claude' },
      { clusterId: 'row-2', clusterName: '数据治理', modelText: 'Claude', poor: true },
    ])
    const domesticResult = makeQuestionnaire([
      { clusterId: 'row-1', clusterName: '数据战略', modelText: 'Domestic' },
      { clusterId: 'row-2', clusterName: '数据治理', modelText: 'Domestic', poor: true },
    ])

    const output = await service.aggregate({
      taskId: 'questionnaire-task-2',
      generationType: AITaskType.QUESTIONNAIRE,
      gpt4Result,
      claudeResult,
      domesticResult,
      validationReport,
      matrixResult: {
        matrix: [
          { cluster_id: 'row-1', cluster_name: '数据战略', levels: {} },
          { cluster_id: 'row-2', cluster_name: '数据治理', levels: {} },
        ],
      },
    })

    expect(output.selectedModel).toBe(SelectedModel.GPT4)
    expect(output.selectedResult.questionnaire).toHaveLength(10)
    expect(output.selectedResult.questionnaire.slice(0, 5)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: 'Q001',
          cluster_id: 'row-1',
          question_text: expect.stringContaining('Claude'),
        }),
      ]),
    )
    expect(output.selectedResult.questionnaire.slice(5, 10)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question_id: 'Q006',
          cluster_id: 'row-2',
          question_text: expect.stringContaining('DeepSeek'),
        }),
      ]),
    )
    expect(output.selectedResult.questionnaire_metadata).toEqual(
      expect.objectContaining({
        total_questions: 10,
        estimated_time_minutes: 5,
        coverage_map: {
          'row-1': 5,
          'row-2': 5,
        },
        model_selection: expect.objectContaining({
          strategy: 'per_matrix_row_quality_scoring',
          selected_group_counts: {
            gpt4: 1,
            claude: 1,
            domestic: 0,
          },
        }),
      }),
    )
  })
})
