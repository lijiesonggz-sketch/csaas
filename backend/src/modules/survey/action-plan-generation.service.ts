import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import {
  ActionPlanMeasure,
  MeasurePriority,
  MeasureStatus,
  AITask,
  AITaskType,
  TaskStatus,
  SurveyResponse,
} from '../../database/entities'
import { ActionPlanService, ClusterGapAnalysis } from './action-plan.service'
import { MaturityAnalysisService } from './maturity-analysis.service'
import { AIOrchestrator } from '../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../database/entities/ai-generation-event.entity'
import { AIClientRequest } from '../ai-clients/interfaces/ai-client.interface'
import { generateClusterMeasurePrompt } from '../ai-generation/prompts/action-plan.prompts'
import JSON5 from 'json5'

/**
 * 落地措施生成服务
 * 基于成熟度分析结果,生成具体的改进措施
 */
@Injectable()
export class ActionPlanGenerationService {
  private readonly logger = new Logger(ActionPlanGenerationService.name)

  constructor(
    @InjectRepository(ActionPlanMeasure)
    private actionPlanMeasureRepository: Repository<ActionPlanMeasure>,
    @InjectRepository(AITask)
    private aiTaskRepository: Repository<AITask>,
    @InjectRepository(SurveyResponse)
    private surveyResponseRepository: Repository<SurveyResponse>,
    private readonly actionPlanService: ActionPlanService,
    private readonly maturityAnalysisService: MaturityAnalysisService,
    private readonly aiOrchestrator: AIOrchestrator,
  ) {}

  /**
   * 生成落地措施(主入口)
   * @param surveyResponseId 问卷响应ID
   * @param targetMaturity 目标成熟度
   * @returns AI任务ID
   */
  async generateActionPlan(
    surveyResponseId: string,
    targetMaturity: number,
  ): Promise<{ taskId: string }> {
    this.logger.log(
      `Starting action plan generation for survey ${surveyResponseId}, target maturity: ${targetMaturity}`,
    )

    // 1. 获取问卷填写记录和关联的任务
    const surveyResponse = await this.surveyResponseRepository.findOne({
      where: { id: surveyResponseId },
      relations: ['questionnaireTask'],
    })

    if (!surveyResponse) {
      throw new Error('问卷填写记录不存在')
    }

    if (!surveyResponse.questionnaireTask) {
      throw new Error('关联的问卷任务不存在')
    }

    const projectId = surveyResponse.questionnaireTask.projectId

    // 2. 获取成熟度分析结果
    const analysisResult = await this.maturityAnalysisService.analyzeSurvey(surveyResponseId)

    if (!analysisResult) {
      throw new Error('成熟度分析结果不存在，请先执行成熟度分析')
    }

    // 3. 验证目标成熟度
    if (targetMaturity <= analysisResult.overall.maturityLevel) {
      throw new Error(
        `目标成熟度(${targetMaturity})应高于当前成熟度(${analysisResult.overall.maturityLevel.toFixed(2)})`,
      )
    }

    // 4. 创建AI任务
    const aiTask = this.aiTaskRepository.create({
      projectId: projectId,
      type: AITaskType.ACTION_PLAN,
      status: TaskStatus.PENDING,
      priority: 1,
      input: {
        survey_response_id: surveyResponseId,
        current_maturity: analysisResult.overall.maturityLevel,
        target_maturity: targetMaturity,
        gap: targetMaturity - analysisResult.overall.maturityLevel,
      },
      progress: 0,
    })

    const savedTask = await this.aiTaskRepository.save(aiTask)

    // 4. 异步执行生成（不阻塞返回）
    this.executeGeneration(savedTask.id, surveyResponseId, targetMaturity, analysisResult).catch(
      (error) => {
        this.logger.error(
          `Failed to generate action plan for task ${savedTask.id}: ${error.message}`,
        )
        this.updateTaskStatus(savedTask.id, TaskStatus.FAILED, error.message)
      },
    )

    return { taskId: savedTask.id }
  }

  /**
   * 执行措施生成（异步）
   */
  private async executeGeneration(
    taskId: string,
    surveyResponseId: string,
    targetMaturity: number,
    analysisResult: any,
  ): Promise<void> {
    try {
      // 更新任务状态为处理中
      await this.updateTaskStatus(taskId, TaskStatus.PROCESSING, null)

      // 1. 执行差距分析
      this.logger.log(`Performing gap analysis for task ${taskId}`)
      const gapAnalysis = this.actionPlanService.generateGapAnalysisReport(
        surveyResponseId,
        analysisResult.clusterMaturity,
        analysisResult.overall.maturityLevel,
        targetMaturity,
      )

      await this.updateTaskProgress(taskId, 20)

      // 2. 为每个聚类生成措施
      this.logger.log(`Generating measures for ${gapAnalysis.cluster_gaps.length} clusters`)
      const allMeasures: ActionPlanMeasure[] = []

      for (let i = 0; i < gapAnalysis.cluster_gaps.length; i++) {
        const clusterGap = gapAnalysis.cluster_gaps[i]

        this.logger.log(
          `Generating measures for cluster ${i + 1}/${gapAnalysis.cluster_gaps.length}: ${clusterGap.cluster_name}`,
        )

        // 找到对应的聚类详情（包含问题信息）
        const clusterDetail = analysisResult.clusterMaturity.find(
          (c: any) => c.cluster_id === clusterGap.cluster_id,
        )

        if (!clusterDetail) {
          this.logger.warn(`Cluster detail not found for ${clusterGap.cluster_id}, skipping`)
          continue
        }

        // 生成该聚类的措施
        const measures = await this.generateMeasuresForCluster(
          taskId,
          surveyResponseId,
          clusterGap,
          clusterDetail.questions,
        )

        allMeasures.push(...measures)

        // 更新进度 (20% - 90%)
        const progress = 20 + ((i + 1) / gapAnalysis.cluster_gaps.length) * 70
        await this.updateTaskProgress(taskId, progress)
      }

      // 3. 保存所有措施到数据库
      this.logger.log(`Saving ${allMeasures.length} measures to database`)
      await this.actionPlanMeasureRepository.save(allMeasures)

      // 4. 更新任务状态为完成
      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, null, {
        total_measures: allMeasures.length,
        cluster_count: gapAnalysis.cluster_gaps.length,
        timeline: gapAnalysis.estimated_timeline,
      })

      await this.updateTaskProgress(taskId, 100)

      this.logger.log(`Action plan generation completed for task ${taskId}`)
    } catch (error) {
      this.logger.error(`Error in executeGeneration for task ${taskId}: ${error.message}`)
      throw error
    }
  }

  /**
   * 为单个聚类生成改进措施
   */
  private async generateMeasuresForCluster(
    taskId: string,
    surveyResponseId: string,
    clusterGap: ClusterGapAnalysis,
    questionDetails: any[],
  ): Promise<ActionPlanMeasure[]> {
    // 准备Prompt数据
    const promptData = {
      cluster_name: clusterGap.cluster_name,
      cluster_id: clusterGap.cluster_id,
      current_level: clusterGap.current_level,
      target_level: clusterGap.target_level,
      gap: clusterGap.gap,
      priority: clusterGap.priority,
      suggested_measure_count: clusterGap.suggested_measure_count,
      improvement_urgency: clusterGap.improvement_urgency,
      question_details: questionDetails.map((q: any) => ({
        question_text: q.question_text,
        score: q.score,
        level: q.level,
        selected_option_text: q.selected_option_text || '',
      })),
    }

    // 生成Prompt
    const prompt = generateClusterMeasurePrompt(promptData)

    // 调用AI模型生成措施
    // 使用通义千问（Tongyi/阿里云）
    const selectedResult = await this.generateWithAI(prompt, AIModel.DOMESTIC)

    // 转换为ActionPlanMeasure实体
    const measures: ActionPlanMeasure[] = selectedResult.measures.map((m: any, index: number) => {
      return this.actionPlanMeasureRepository.create({
        taskId,
        surveyResponseId,
        clusterName: clusterGap.cluster_name,
        clusterId: clusterGap.cluster_id,
        currentLevel: clusterGap.current_level,
        targetLevel: clusterGap.target_level,
        gap: clusterGap.gap,
        priority: clusterGap.priority as MeasurePriority,
        title: m.title,
        description: m.description,
        implementationSteps: m.implementation_steps,
        timeline: m.timeline,
        responsibleDepartment: m.responsible_department,
        expectedImprovement: m.expected_improvement,
        resourcesNeeded: m.resources_needed,
        dependencies: m.dependencies,
        risks: m.risks,
        kpiMetrics: m.kpi_metrics,
        status: MeasureStatus.PLANNED,
        progress: 0,
        aiModel: 'glm-4.7', // 使用智谱AI
        sortOrder: index + 1,
      })
    })

    return measures
  }

  /**
   * 调用AI模型生成措施
   */
  private async generateWithAI(prompt: string, model: AIModel): Promise<{ measures: any[] }> {
    const request: AIClientRequest = {
      prompt,
      temperature: 0.7,
      maxTokens: 8000,
    }

    let rawResponse = ''
    try {
      const response = await this.aiOrchestrator.generate(request, model)
      rawResponse = response.content

      this.logger.debug(`AI response length: ${rawResponse.length} characters`)

      // 解析JSON响应
      let cleanedContent = rawResponse.trim()

      // 移除markdown标记
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/```\s*$/, '')
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/```\s*$/, '')
      }

      this.logger.debug(`After markdown removal: ${cleanedContent.substring(0, 200)}...`)

      // 尝试修复常见的JSON格式问题
      cleanedContent = this.fixJSON(cleanedContent)

      this.logger.debug(`After JSON fix: ${cleanedContent.substring(0, 200)}...`)

      // 尝试多层解析策略
      let parsed
      let parseMethod = 'standard'

      try {
        // 方法1: 标准JSON.parse
        parsed = JSON.parse(cleanedContent)
        this.logger.debug(`Parsed with standard JSON.parse`)
      } catch (standardError) {
        this.logger.warn(`Standard JSON.parse failed: ${standardError.message}`)

        try {
          // 方法2: 使用JSON5 (更宽松的解析器)
          parsed = JSON5.parse(cleanedContent)
          parseMethod = 'json5'
          this.logger.log(`Successfully parsed with JSON5 (more forgiving parser)`)
        } catch (json5Error) {
          // 两种方法都失败，抛出原始错误
          this.logger.error(`JSON5.parse also failed: ${json5Error.message}`)
          throw standardError
        }
      }

      if (!Array.isArray(parsed.measures)) {
        throw new Error('Invalid response: measures field is not an array')
      }

      this.logger.log(
        `✅ AI model ${model} generated ${parsed.measures.length} measures (parsed with ${parseMethod})`,
      )

      return parsed
    } catch (error) {
      this.logger.error(`Failed to generate with AI model ${model}: ${error.message}`)

      // 记录详细的错误信息和原始响应
      if (error.message.includes('JSON')) {
        this.logger.error(`=== AI Raw Response (first 1500 chars) ===`)
        this.logger.error(rawResponse.substring(0, 1500))
        this.logger.error(`=== End of Raw Response ===`)
        this.logger.error(`JSON parsing error at position info: ${error.message}`)

        // 保存完整的原始响应到文件以便调试
        const fs = require('fs')
        const debugDir = './debug-ai-responses'
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true })
        }
        const filename = `${debugDir}/${new Date().getTime()}-error.json`
        fs.writeFileSync(filename, rawResponse, 'utf8')
        this.logger.error(`Full response saved to: ${filename}`)
      }

      throw error
    }
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    errorMessage: string | null,
    result?: any,
  ): Promise<void> {
    await this.aiTaskRepository.update(taskId, {
      status,
      errorMessage,
      result: result || undefined,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : undefined,
    })
  }

  /**
   * 更新任务进度
   */
  private async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    await this.aiTaskRepository.update(taskId, { progress })
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<any> {
    const task = await this.aiTaskRepository.findOne({ where: { id: taskId } })

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // 如果任务完成,获取生成的措施
    let measures: ActionPlanMeasure[] = []
    if (task.status === TaskStatus.COMPLETED) {
      measures = await this.actionPlanMeasureRepository.find({
        where: { taskId },
        order: { priority: 'ASC', sortOrder: 'ASC' },
      })
    }

    return {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      errorMessage: task.errorMessage,
      result: task.result,
      measures,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    }
  }

  /**
   * 获取问卷的所有落地措施
   */
  async getMeasuresBySurvey(surveyResponseId: string): Promise<ActionPlanMeasure[]> {
    return this.actionPlanMeasureRepository.find({
      where: { surveyResponseId },
      order: {
        priority: 'ASC',
        clusterName: 'ASC',
        sortOrder: 'ASC',
      },
    })
  }

  /**
   * 修复AI生成的JSON中的常见格式问题
   */
  private fixJSON(jsonString: string): string {
    let fixed = jsonString

    // 1. 移除BOM标记
    fixed = fixed.replace(/^\uFEFF/, '')

    // 2. 处理双引号字符串内部的单引号（防止破坏JSON结构）
    // 移除双引号字符串内的所有单引号
    fixed = fixed.replace(/"([^"]*)"/g, (match, content) => {
      return '"' + content.replace(/'/g, '') + '"'
    })

    // 3. 修复未加引号的属性名（如 {name: "value"} -> {"name": "value"}）
    // 但要小心不要破坏字符串内容
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    // 4. 修复单引号字符串（如 {'name': 'value'} -> {"name": "value"}）
    fixed = fixed.replace(/'([^']*)'/g, '"$1"')

    // 5. 移除注释（如 // ... 或 /* ... */）
    fixed = fixed.replace(/\/\/.*$/gm, '')
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')

    // 6. 修复尾随逗号（如 {"a": 1,} -> {"a": 1}）
    fixed = fixed.replace(/,\s*([}\]])/g, '$1')

    // 7. 修复未引用的布尔值和null
    fixed = fixed.replace(/\:\s*(true|false|null)\s*([,}])/g, ': $1$2')

    return fixed
  }
}
