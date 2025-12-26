import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { IsString, IsNumber, IsOptional, MinLength } from 'class-validator'
import { AIGenerationService } from './ai-generation.service'
import { ResultAggregatorService } from '../result-aggregation/result-aggregator.service'
import { AITaskType } from '../../database/entities/ai-task.entity'

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
 * AI生成Controller
 * 提供AI生成功能的HTTP API接口
 */
@Controller('ai-generation')
export class AIGenerationController {
  constructor(
    private readonly aiGenerationService: AIGenerationService,
    private readonly resultAggregator: ResultAggregatorService,
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
   * 获取生成结果
   * GET /api/ai-generation/result/:taskId
   */
  @Get('result/:taskId')
  async getResult(@Param('taskId') taskId: string) {
    try {
      const result = await this.resultAggregator.getResultByTaskId(taskId)

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
        data: {
          id: result.id,
          taskId: result.taskId,
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
