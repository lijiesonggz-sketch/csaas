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
import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  IsArray,
  ValidateNested,
} from 'class-validator'
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
        console.log(`Result not found in ai_generation_results for task ${taskId}, trying ai_tasks table...`)

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
