import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { IsString, IsNumber, IsOptional, MinLength, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AIGenerationService } from './ai-generation.service'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { AITaskType } from '../../database/entities/ai-task.entity'
import { AITask } from '../../database/entities/ai-task.entity'

export class GenerateSummaryDto {
  @IsString()
  taskId: string

  @IsString()
  @MinLength(100, { message: 'Standard document must be at least 100 characters' })
  standardDocument: string

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 标准文档DTO（用于聚类）
 */
export class StandardDocumentDto {
  @IsString()
  id: string

  @IsString()
  name: string

  @IsString()
  @MinLength(100, { message: 'Document content must be at least 100 characters' })
  content: string
}

/**
 * 生成聚类DTO
 */
export class GenerateClusteringDto {
  @IsString()
  taskId: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandardDocumentDto)
  documents: StandardDocumentDto[]

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成矩阵DTO
 */
export class GenerateMatrixDto {
  @IsString()
  taskId: string

  @IsOptional()
  clusteringResult: any // ClusteringGenerationOutput

  @IsOptional()
  @IsString()
  clusteringTaskId?: string // 聚类任务ID（从数据库自动加载聚类结果）

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成问卷DTO
 */
export class GenerateQuestionnaireDto {
  @IsString()
  taskId: string

  @IsString()
  matrixTaskId: string // 矩阵任务ID（从数据库获取矩阵结果，避免HTTP请求体过大）

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成判断题问卷DTO
 */
export class GenerateBinaryQuestionnaireDto {
  @IsString()
  taskId: string

  @IsString()
  clusteringTaskId: string // 聚类任务ID（从数据库获取聚类结果）

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成超简版差距分析DTO
 */
export class GenerateQuickGapAnalysisDto {
  @IsString()
  taskId: string

  @IsString()
  @MinLength(500, { message: 'Current state description must be at least 500 characters' })
  currentStateDescription: string

  @ValidateNested()
  @Type(() => StandardDocumentDto)
  standardDocument: StandardDocumentDto

  @IsOptional()
  @IsString()
  clusteringTaskId?: string // 聚类任务ID（可选，用于更精准的差距分析）

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成标准解读DTO
 */
export class GenerateStandardInterpretationDto {
  @IsString()
  taskId: string

  @ValidateNested()
  @Type(() => StandardDocumentDto)
  standardDocument: StandardDocumentDto

  @IsOptional()
  @IsString()
  interpretationMode?: 'basic' | 'detailed' | 'enterprise'

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成标准解读DTO（两阶段模式）
 */
export class GenerateStandardInterpretationTwoPhaseDto {
  @IsString()
  taskId: string

  @ValidateNested()
  @Type(() => StandardDocumentDto)
  standardDocument: StandardDocumentDto

  @IsOptional()
  @IsString()
  interpretationMode?: 'basic' | 'detailed' | 'enterprise'

  @IsOptional()
  @IsNumber()
  batchSize?: number

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number

  @IsOptional()
  @IsString()
  projectId?: string
}

/**
 * 生成关联标准搜索DTO
 */
export class GenerateRelatedStandardSearchDto {
  @IsString()
  taskId: string

  @ValidateNested()
  @Type(() => StandardDocumentDto)
  standardDocument: StandardDocumentDto

  @IsOptional()
  @IsString()
  interpretationTaskId?: string // 解读任务ID（可选，用于更精准的关联搜索）

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成版本比对DTO
 */
export class GenerateVersionCompareDto {
  @IsString()
  taskId: string

  @ValidateNested()
  @Type(() => StandardDocumentDto)
  oldVersion: StandardDocumentDto

  @ValidateNested()
  @Type(() => StandardDocumentDto)
  newVersion: StandardDocumentDto

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * 生成落地措施DTO
 */
export class GenerateActionPlanDto {
  @IsString()
  taskId: string

  @IsString()
  matrixTaskId: string // 矩阵任务ID

  @IsString()
  surveyResponseId: string // 问卷填写记录ID（包含用户答案）

  @IsOptional()
  @IsNumber()
  temperature?: number

  @IsOptional()
  @IsNumber()
  maxTokens?: number
}

/**
 * AI生成Controller
 * 提供AI生成功能的HTTP API接口
 */
@Controller('ai-generation')
export class AIGenerationController {
  constructor(
    private readonly aiGenerationService: AIGenerationService,
    private readonly resultAggregator: ResultAggregatorService,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
  ) {}

  /**
   * 生成综述
   * POST /api/ai-generation/summary
   */
  @Post('summary')
  async generateSummary(@Body() dto: GenerateSummaryDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.SUMMARY,
        input: {
          standardDocument: dto.standardDocument,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成聚类（多文档合并）
   * POST /api/ai-generation/clustering
   */
  @Post('clustering')
  async generateClustering(@Body() dto: GenerateClusteringDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.CLUSTERING,
        projectId: dto.projectId, // 传递projectId
        input: {
          documents: dto.documents,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 获取生成结果
   * GET /api/ai-generation/result/:taskId
   */
  @Get('result/:taskId')
  async getResult(@Param('taskId') taskId: string) {
    try {
      const result = await this.resultAggregator.getResultByTaskId(taskId)

      // ✅ 如果在 ai_generation_results 表中找不到，尝试从 ai_tasks 表读取（兼容旧任务）
      if (!result) {
        console.log(
          `Result not found in ai_generation_results for task ${taskId}, trying ai_tasks table...`,
        )

        // 从 ai_tasks 表读取
        const task = await this.aiTaskRepository.findOne({
          where: { id: taskId },
        })

        if (!task || !task.result) {
          throw new HttpException(
            {
              success: false,
              error: 'Result not found',
            },
            HttpStatus.NOT_FOUND,
          )
        }

        // 解析 result 字段（可能是 JSON 字符串）
        let resultData: any
        if (typeof task.result === 'string') {
          resultData = JSON.parse(task.result)
        } else {
          resultData = task.result
        }

        // 构造兼容旧格式的响应
        return {
          success: true,
          data: {
            id: task.id,
            taskId: task.id, // ✅ 添加 taskId
            projectId: task.projectId, // ✅ 添加 projectId
            generationType: task.type,
            content: resultData.content || resultData, // ✅ 保留 content 字段
            selectedResult: resultData,
            selectedModel: resultData.selectedModel || 'gpt4',
            confidenceLevel: resultData.confidenceLevel || 'MEDIUM',
            qualityScores: resultData.qualityScores || {
              structural: 0.8,
              semantic: 0.8,
              detail: 0.8,
            },
            consistencyReport: resultData.consistencyReport || {
              agreements: [],
              disagreements: [],
              highRiskDisagreements: [],
            },
            coverageReport: resultData.coverageReport,
            reviewStatus: 'PENDING' as any,
            version: 1,
            createdAt: task.createdAt,
          },
        }
      }

      return {
        success: true,
        data: {
          id: result.id,
          taskId: result.taskId,
          projectId: result.task.projectId, // 添加projectId用于跳转到项目工作台
          generationType: result.generationType,
          selectedResult: result.selectedResult,
          selectedModel: result.selectedModel,
          confidenceLevel: result.confidenceLevel,
          qualityScores: result.qualityScores,
          consistencyReport: result.consistencyReport,
          coverageReport: result.coverageReport,
          reviewStatus: result.reviewStatus,
          version: result.version,
          createdAt: result.createdAt,
        },
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 获取最终结果（考虑人工修改）
   * GET /api/ai-generation/final-result/:taskId
   */
  @Get('final-result/:taskId')
  async getFinalResult(@Param('taskId') taskId: string) {
    try {
      const result = await this.aiGenerationService.getFinalResult(taskId)

      if (!result) {
        throw new HttpException(
          {
            success: false,
            error: 'Result not found',
          },
          HttpStatus.NOT_FOUND,
        )
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成成熟度矩阵
   * POST /api/ai-generation/matrix
   */
  @Post('matrix')
  async generateMatrix(@Body() dto: GenerateMatrixDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.MATRIX,
        input: {
          clusteringResult: dto.clusteringResult,
          clusteringTaskId: dto.clusteringTaskId, // 传递clusteringTaskId
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成调研问卷
   * POST /api/ai-generation/questionnaire
   */
  @Post('questionnaire')
  async generateQuestionnaire(@Body() dto: GenerateQuestionnaireDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.QUESTIONNAIRE,
        input: {
          matrixTaskId: dto.matrixTaskId, // 传递矩阵任务ID，由service层从数据库获取
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成判断题问卷
   * POST /api/ai-generation/binary-questionnaire
   */
  @Post('binary-questionnaire')
  async generateBinaryQuestionnaire(@Body() dto: GenerateBinaryQuestionnaireDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.BINARY_QUESTIONNAIRE,
        input: {
          clusteringTaskId: dto.clusteringTaskId,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成超简版差距分析
   * POST /api/ai-generation/quick-gap-analysis
   */
  @Post('quick-gap-analysis')
  async generateQuickGapAnalysis(@Body() dto: GenerateQuickGapAnalysisDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.QUICK_GAP_ANALYSIS,
        input: {
          currentStateDescription: dto.currentStateDescription,
          standardDocument: dto.standardDocument,
          clusteringTaskId: dto.clusteringTaskId,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成标准解读
   * POST /api/ai-generation/standard-interpretation
   */
  @Post('standard-interpretation')
  async generateStandardInterpretation(@Body() dto: GenerateStandardInterpretationDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.STANDARD_INTERPRETATION,
        input: {
          standardDocument: dto.standardDocument,
          interpretationMode: dto.interpretationMode,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成标准解读（两阶段模式）
   * POST /api/ai-generation/standard-interpretation/two-phase
   *
   * 两阶段模式确保100%条款覆盖：
   * - 阶段1：提取条款清单（使用3个AI模型，正则验证，自动补全）
   * - 阶段2：批量解读条款（默认10条/批，实时进度反馈）
   */
  @Post('standard-interpretation/two-phase')
  async generateStandardInterpretationTwoPhase(
    @Body() dto: GenerateStandardInterpretationTwoPhaseDto,
  ) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.STANDARD_INTERPRETATION,
        input: {
          standardDocument: dto.standardDocument,
          interpretationMode: dto.interpretationMode,
          batchSize: dto.batchSize,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
          useTwoPhaseMode: true, // 启用两阶段模式
        },
        projectId: dto.projectId,
      })

      return {
        success: true,
        data: result,
        message: '标准解读任务已创建（两阶段模式）',
        mode: 'two-phase',
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成关联标准搜索
   * POST /api/ai-generation/related-standards-search
   */
  @Post('related-standards-search')
  async generateRelatedStandardSearch(@Body() dto: GenerateRelatedStandardSearchDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.STANDARD_RELATED_SEARCH,
        input: {
          standardDocument: dto.standardDocument,
          interpretationTaskId: dto.interpretationTaskId,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成版本比对
   * POST /api/ai-generation/version-compare
   */
  @Post('version-compare')
  async generateVersionCompare(@Body() dto: GenerateVersionCompareDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.STANDARD_VERSION_COMPARE,
        input: {
          oldVersion: dto.oldVersion,
          newVersion: dto.newVersion,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 生成落地措施
   * POST /api/ai-generation/action-plan
   */
  @Post('action-plan')
  async generateActionPlan(@Body() dto: GenerateActionPlanDto) {
    try {
      const result = await this.aiGenerationService.generateContent({
        taskId: dto.taskId,
        generationType: AITaskType.ACTION_PLAN,
        input: {
          matrixTaskId: dto.matrixTaskId,
          surveyResponseId: dto.surveyResponseId,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 更新聚类结果（用户手工添加缺失条款）
   * PATCH /api/ai-generation/clustering/:taskId
   */
  @Patch('clustering/:taskId')
  async updateClusteringResult(
    @Param('taskId') taskId: string,
    @Body()
    body: {
      categories: any[] // 更新后的categories（包含用户手工添加的条款）
    },
  ) {
    try {
      await this.aiGenerationService.updateClusteringResult(taskId, body.categories)

      return {
        success: true,
        message: 'Clustering result updated successfully',
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 更新审核状态
   * POST /api/ai-generation/review/:resultId
   */
  @Post('review/:resultId')
  async updateReviewStatus(
    @Param('resultId') resultId: string,
    @Body()
    body: {
      reviewStatus: 'APPROVED' | 'MODIFIED' | 'REJECTED'
      reviewedBy: string
      modifiedResult?: Record<string, any>
      reviewNotes?: string
    },
  ) {
    try {
      await this.resultAggregator.updateReviewStatus(
        resultId,
        body.reviewStatus,
        body.reviewedBy,
        body.modifiedResult,
        body.reviewNotes,
      )

      return {
        success: true,
        message: 'Review status updated successfully',
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
