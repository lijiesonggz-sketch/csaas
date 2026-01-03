/**
 * AITask 到 GenerationResult 的适配器
 * 将后端 AI Tasks 返回的数据转换为前端期望的 GenerationResult 格式
 */

import type { GenerationResult, GenerationType, ConfidenceLevel, SelectedModel } from '@/lib/types/ai-generation'

export interface AITask {
  id: string
  projectId: string
  type: string
  status: string
  input: any
  result: any
  progress: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export class TaskAdapter {
  /**
   * 将 AITask 转换为 GenerationResult
   */
  static toGenerationResult(task: AITask): GenerationResult {
    // 映射任务类型到生成类型
    const typeMapping: Record<string, GenerationType> = {
      'summary': 'summary',
      'clustering': 'clustering',
      'matrix': 'matrix',
      'questionnaire': 'questionnaire',
      'action_plan': 'action_plan',
    }

    const generationType: GenerationType = typeMapping[task.type] || 'summary'

    // 构建 selectedResult
    let selectedResult: Record<string, any> = {}

    switch (task.type) {
      case 'summary':
        // summary 的 result 可能包含 content 字段（AI生成的内容）
        if (task.result?.content) {
          try {
            const content = typeof task.result.content === 'string'
              ? task.result.content
              : JSON.stringify(task.result.content)

            // 移除可能的 markdown 标记
            let cleanedContent = content.trim()
            if (cleanedContent.startsWith('```json')) {
              cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '')
            } else if (cleanedContent.startsWith('```')) {
              cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '')
            }

            // 尝试解析为 JSON
            const parsed = JSON.parse(cleanedContent)
            selectedResult = parsed
          } catch (e) {
            // 解析失败，尝试使用旧格式
            selectedResult = typeof task.result?.selectedResult === 'string'
              ? JSON.parse(task.result.selectedResult)
              : task.result?.selectedResult || task.result
          }
        } else {
          // 使用旧格式
          selectedResult = typeof task.result?.selectedResult === 'string'
            ? JSON.parse(task.result.selectedResult)
            : task.result?.selectedResult || task.result
        }
        break

      case 'clustering':
        // clustering 的 result 直接包含 categories 等字段
        selectedResult = task.result
        break

      case 'matrix':
        // matrix 需要转换数据结构
        // 后端返回 {content: "{\"matrix\":[{...}]}"}
        // 前端期望 {matrix: [...], maturity_model_description: "..."}
        let matrixData: any[] = []
        let modelDescription = 'CMMI成熟度模型'

        // 情况1: task.result.content 是 JSON 字符串（新格式）
        if (task.result?.content && typeof task.result.content === 'string') {
          try {
            const parsedContent = JSON.parse(task.result.content)
            matrixData = parsedContent.matrix || []
            modelDescription = parsedContent.maturity_model_description || modelDescription
          } catch (e) {
            console.error('Failed to parse matrix content:', e)
            matrixData = []
          }
        }
        // 情况2: task.result.content 已经是对象
        else if (task.result?.content && typeof task.result.content === 'object') {
          matrixData = task.result.content.matrix || []
          modelDescription = task.result.content.maturity_model_description || modelDescription
        }
        // 情况3: task.result 包含聚合后的 selectedResult
        else if (task.result?.selectedResult?.matrix) {
          matrixData = task.result.selectedResult.matrix
          modelDescription = task.result.selectedResult.maturity_model_description || modelDescription
        }
        // 情况4: task.result 包含三模型输出（gpt4, claude, domestic）
        else if (task.result?.gpt4?.matrix) {
          matrixData = task.result.gpt4.matrix
          modelDescription = task.result.gpt4.maturity_model_description || modelDescription
        }
        // 情况5: task.result 直接包含 matrix 字段
        else if (task.result?.matrix) {
          matrixData = task.result.matrix
          modelDescription = task.result.maturity_model_description || modelDescription
        }
        // 情况6: 兼容旧格式 dimensions
        else if (task.result?.dimensions) {
          matrixData = task.result.dimensions.map((dim: any) => ({
            cluster_id: dim.id,
            cluster_name: dim.name,
            levels: {
              level_1: {
                name: dim.levels[0] || '初始级',
                description: `${dim.name} - 初始级描述`,
                key_practices: []
              },
              level_2: {
                name: dim.levels[1] || '可重复级',
                description: `${dim.name} - 可重复级描述`,
                key_practices: []
              },
              level_3: {
                name: dim.levels[2] || '已定义级',
                description: `${dim.name} - 已定义级描述`,
                key_practices: []
              },
              level_4: {
                name: dim.levels[3] || '可管理级',
                description: `${dim.name} - 可管理级描述`,
                key_practices: []
              },
              level_5: {
                name: dim.levels[4] || '优化级',
                description: `${dim.name} - 优化级描述`,
                key_practices: []
              }
            }
          }))
        }

        selectedResult = {
          matrix: matrixData,
          maturity_model_description: modelDescription
        }
        break

      case 'questionnaire':
        // questionnaire 需要转换数据结构
        // 新格式：task.result.content 包含 {questionnaire: [...], questionnaire_metadata: {...}}
        // 旧格式：task.result.sections [...]
        let questionnaireData: any = null

        // 尝试从 content 字段解析（新格式）
        if (task.result?.content) {
          try {
            const content = typeof task.result.content === 'string'
              ? JSON.parse(task.result.content)
              : task.result.content

            questionnaireData = {
              questionnaire: content.questionnaire || [],
              questionnaire_metadata: content.questionnaire_metadata || {}
            }
          } catch (e) {
            console.warn('Failed to parse questionnaire content:', e)
          }
        }

        // 如果新格式解析失败，尝试旧格式（兼容）
        if (!questionnaireData || !questionnaireData.questionnaire || questionnaireData.questionnaire.length === 0) {
          const questions: any[] = []
          task.result?.sections?.forEach((section: any, sectionIdx: number) => {
            section.questions?.forEach((q: any, qIdx: number) => {
              questions.push({
                question_id: q.id,
                cluster_id: section.id,
                cluster_name: section.title,
                question_text: q.text,
                question_type: q.type === 'yes_no' ? 'SINGLE_CHOICE' : 'SINGLE_CHOICE',
                options: q.type === 'yes_no' ? [
                  { option_id: 'yes', text: '是', score: 1 },
                  { option_id: 'no', text: '否', score: 0 },
                  { option_id: 'partial', text: '部分', score: 0.5 }
                ] : [],
                required: true,
                guidance: q.recommendation || ''
              })
            })
          })

          questionnaireData = {
            questionnaire: questions,
            questionnaire_metadata: {
              total_questions: task.result?.totalQuestions || questions.length,
              estimated_time_minutes: Math.ceil((task.result?.totalQuestions || 0) / 3),
              coverage_map: {}
            }
          }
        }

        selectedResult = questionnaireData
        break

      case 'action_plan':
        // action_plan 的 result 可能包含简单格式或详细格式
        // 尝试解析 content 中的 JSON
        if (task.result?.content) {
          try {
            const content = typeof task.result.content === 'string'
              ? task.result.content
              : JSON.stringify(task.result.content)

            // 移除可能的 markdown 标记
            let cleanedContent = content.trim()
            if (cleanedContent.startsWith('```json')) {
              cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '')
            } else if (cleanedContent.startsWith('```')) {
              cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '')
            }

            // 尝试解析为 JSON
            const parsed = JSON.parse(cleanedContent)

            // 检查是否包含 measures 字段（详细格式）
            if (parsed.measures && Array.isArray(parsed.measures)) {
              // 详细格式：转换为简化的 improvements 格式以兼容现有组件
              selectedResult = {
                summary: `数据安全改进措施计划（共${parsed.measures.length}项措施）`,
                metadata: {
                  timeline: '12-18个月（长期规划）',
                  generatedAt: new Date().toISOString(),
                  clusterCount: new Set(parsed.measures.map((m: any) => m.clusterName || m.area)).size,
                  totalMeasures: parsed.measures.length,
                },
                improvements: parsed.measures.map((measure: any, index: number) => ({
                  area: measure.clusterName || measure.area || `聚类领域${index + 1}`,
                  actions: measure.implementationSteps?.map((step: any) => step.description || step.title) || measure.actions || [],
                  priority: measure.priority === 'high' ? '高' : measure.priority === 'medium' ? '中' : '低',
                  timeline: measure.timeline || '-',
                  resources: measure.resourcesNeeded?.budget || measure.resources || '-',
                  targetLevel: `Level ${measure.targetLevel || '-'}`,
                  currentLevel: `Level ${measure.currentLevel || '-'}`,
                  expectedOutcome: measure.description || '-',
                  // 保留详细字段用于完整显示
                  _detail: {
                    title: measure.title,
                    description: measure.description,
                    implementationSteps: measure.implementationSteps,
                    responsibleDepartment: measure.responsibleDepartment,
                    expectedImprovement: measure.expectedImprovement,
                    resourcesNeeded: measure.resourcesNeeded,
                    dependencies: measure.dependencies,
                    risks: measure.risks,
                    kpiMetrics: measure.kpiMetrics,
                  }
                })),
                totalMeasures: parsed.measures.length,
              }
            } else {
              // 简单格式，直接使用
              selectedResult = task.result
            }
          } catch (e) {
            // 解析失败，使用原始数据
            console.warn('Failed to parse action_plan content:', e)
            selectedResult = task.result
          }
        } else {
          // 没有 content 字段，直接使用
          selectedResult = task.result
        }
        break

      default:
        selectedResult = task.result
    }

    // 提取质量评分（从实际结果中获取，如果不存在则使用默认值）
    const actualQualityScores = task.result?.qualityScores || {
      structural: 0.85,
      semantic: 0.80,
      detail: 0.75,
    }

    return {
      id: task.id,
      taskId: task.id,
      projectId: task.projectId, // ✅ 添加 projectId
      generationType,
      selectedResult,
      selectedModel: (task.result?.selectedModel || 'gpt4') as SelectedModel,
      confidenceLevel: (task.result?.confidenceLevel || 'MEDIUM') as ConfidenceLevel,
      qualityScores: actualQualityScores,
      consistencyReport: task.result?.consistencyReport || {
        agreements: [],
        disagreements: [],
        highRiskDisagreements: [],
      },
      coverageReport: task.type === 'clustering' ? {
        totalClauses: task.result?.coverage_summary?.overall?.total_clauses || 0,
        coveredClauses: [],
        missingClauses: [],
        coverageRate: task.result?.coverage_summary?.overall?.coverage_rate || 0,
      } : undefined,
      reviewStatus: 'APPROVED',
      version: 1,
      createdAt: task.createdAt,
    }
  }
}
