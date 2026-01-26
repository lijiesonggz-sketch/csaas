import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { IsString, IsOptional, MinLength, IsEnum, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { CurrentStateService, CreateCurrentStateDto } from './current-state.service'

/**
 * 创建现状描述DTO
 */
export class CreateCurrentStateDtoValidation implements CreateCurrentStateDto {
  @IsString()
  projectId: string

  @IsString()
  @MinLength(500, { message: 'Description must be at least 500 characters' })
  description: string

  @IsOptional()
  @IsEnum(['MANUAL_INPUT', 'DOC_UPLOAD'])
  source?: 'MANUAL_INPUT' | 'DOC_UPLOAD'

  @IsOptional()
  @ValidateNested()
  metadata?: {
    word_count?: number
    extracted_keywords?: string[]
    [key: string]: any
  }
}

/**
 * 更新现状描述DTO
 */
export class UpdateCurrentStateDto {
  @IsOptional()
  @IsString()
  @MinLength(500, { message: 'Description must be at least 500 characters' })
  description?: string

  @IsOptional()
  metadata?: {
    word_count?: number
    extracted_keywords?: string[]
    [key: string]: any
  }
}

/**
 * 现状描述Controller
 */
@Controller('projects/:projectId/current-state')
export class CurrentStateController {
  constructor(private readonly currentStateService: CurrentStateService) {}

  /**
   * 创建现状描述
   * POST /api/projects/:projectId/current-state
   */
  @Post()
  async createCurrentState(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCurrentStateDtoValidation,
  ) {
    try {
      const currentState = await this.currentStateService.createCurrentState({
        projectId,
        description: dto.description,
        source: dto.source,
        metadata: dto.metadata,
      })

      return {
        success: true,
        data: currentState,
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
   * 获取项目的所有现状描述
   * GET /api/projects/:projectId/current-state
   */
  @Get()
  async getProjectCurrentStates(@Param('projectId') projectId: string) {
    try {
      const states = await this.currentStateService.getProjectCurrentStates(projectId)

      return {
        success: true,
        data: states,
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
   * 获取最新的现状描述
   * GET /api/projects/:projectId/current-state/latest
   */
  @Get('latest')
  async getLatestCurrentState(@Param('projectId') projectId: string) {
    try {
      const latestState = await this.currentStateService.getLatestCurrentState(projectId)

      if (!latestState) {
        throw new HttpException(
          {
            success: false,
            error: 'No current state description found for this project',
          },
          HttpStatus.NOT_FOUND,
        )
      }

      return {
        success: true,
        data: latestState,
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
   * 根据ID获取现状描述
   * GET /api/projects/:projectId/current-state/:id
   */
  @Get(':id')
  async getCurrentStateById(@Param('id') id: string) {
    try {
      const currentState = await this.currentStateService.getCurrentStateById(id)

      return {
        success: true,
        data: currentState,
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * 更新现状描述
   * PUT /api/projects/:projectId/current-state/:id
   */
  @Put(':id')
  async updateCurrentState(
    @Param('id') id: string,
    @Body() dto: UpdateCurrentStateDto,
  ) {
    try {
      const updatedState = await this.currentStateService.updateCurrentState(id, dto)

      return {
        success: true,
        data: updatedState,
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
   * 删除现状描述
   * DELETE /api/projects/:projectId/current-state/:id
   */
  @Delete(':id')
  async deleteCurrentState(@Param('id') id: string) {
    try {
      await this.currentStateService.deleteCurrentState(id)

      return {
        success: true,
        message: 'Current state description deleted successfully',
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
