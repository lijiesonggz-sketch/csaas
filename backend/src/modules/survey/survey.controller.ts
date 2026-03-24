import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common'
import { SurveyService } from './survey.service'
import { MaturityAnalysisService } from './maturity-analysis.service'
import { ActionPlanGenerationService } from './action-plan-generation.service'
import { BinaryGapAnalyzer, BinaryGapAnalysisInput } from './binary-gap-analyzer.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreateSurveyDto, SaveDraftDto, SubmitSurveyDto, UploadAndAnalyzeDto } from './dto'
import { AITaskType, TaskStatus } from '../../database/entities/ai-task.entity'

/**
 * SurveyController
 *
 * Survey management endpoints.
 * All endpoints require JWT authentication.
 *
 * @module backend/src/modules/survey
 */
@UseGuards(JwtAuthGuard)
@Controller('survey')
export class SurveyController {
  private readonly logger = new Logger(SurveyController.name)

  constructor(
    private readonly surveyService: SurveyService,
    private readonly maturityAnalysisService: MaturityAnalysisService,
    private readonly actionPlanGenerationService: ActionPlanGenerationService,
    private readonly binaryGapAnalyzer: BinaryGapAnalyzer,
  ) {}

  /**
   * 创建新的问卷填写记录
   * POST /survey
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSurvey(@Body() dto: CreateSurveyDto) {
    try {
      this.logger.debug(`[SurveyController] 收到创建问卷请求: ${JSON.stringify(dto)}`)
      const survey = await this.surveyService.createSurvey(dto)
      this.logger.debug(`[SurveyController] 创建成功, survey ID: ${survey.id}`)
      return {
        success: true,
        data: survey,
        message: '问卷填写记录已创建',
      }
    } catch (error) {
      console.error('[SurveyController] 创建失败:', error.message, error.stack)
      throw error
    }
  }

  /**
   * 保存问卷草稿
   * PUT /survey/:id/draft
   */
  @Put(':id/draft')
  async saveDraft(@Param('id') surveyId: string, @Body() dto: SaveDraftDto) {
    const survey = await this.surveyService.saveDraft(surveyId, dto)
    return {
      success: true,
      data: survey,
      message: '草稿已保存',
    }
  }

  /**
   * 提交问卷
   * POST /survey/:id/submit
   */
  @Post(':id/submit')
  async submitSurvey(@Param('id') surveyId: string, @Body() dto: SubmitSurveyDto) {
    const survey = await this.surveyService.submitSurvey(surveyId, dto)
    return {
      success: true,
      data: survey,
      message: '问卷已提交',
    }
  }

  /**
   * 获取问卷填写记录
   * GET /survey/:id
   */
  @Get(':id')
  async getSurvey(@Param('id') surveyId: string) {
    const survey = await this.surveyService.getSurvey(surveyId)
    return {
      success: true,
      data: survey,
    }
  }

  /**
   * 获取问卷任务的所有填写记录
   * GET /survey/by-questionnaire/:questionnaireTaskId
   */
  @Get('by-questionnaire/:questionnaireTaskId')
  async getSurveysByQuestionnaireTask(@Param('questionnaireTaskId') questionnaireTaskId: string) {
    const surveys = await this.surveyService.getSurveysByQuestionnaireTask(questionnaireTaskId)
    return {
      success: true,
      data: surveys,
    }
  }

  /**
   * 删除问卷填写记录
   * DELETE /survey/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSurvey(@Param('id') surveyId: string) {
    await this.surveyService.deleteSurvey(surveyId)
  }

  /**
   * 分析问卷成熟度
   * POST /survey/:id/analyze
   */
  @Post(':id/analyze')
  async analyzeSurvey(@Param('id') surveyId: string) {
    const analysis = await this.maturityAnalysisService.analyzeSurvey(surveyId)
    return {
      success: true,
      data: analysis,
      message: '成熟度分析完成',
    }
  }

  /**
   * 生成落地措施
   * POST /survey/:id/action-plan
   * Body: { targetMaturity: number }
   */
  @Post(':id/action-plan')
  async generateActionPlan(
    @Param('id') surveyId: string,
    @Body() body: { targetMaturity: number },
  ) {
    try {
      const { targetMaturity } = body

      if (!targetMaturity || targetMaturity < 1 || targetMaturity > 5) {
        return {
          success: false,
          message: '目标成熟度必须在1-5之间',
        }
      }

      const result = await this.actionPlanGenerationService.generateActionPlan(
        surveyId,
        targetMaturity,
      )

      return {
        success: true,
        data: result,
        message: '落地措施生成任务已创建，正在后台处理',
      }
    } catch (error) {
      return {
        success: false,
        message: error.message || '生成落地措施失败',
      }
    }
  }

  /**
   * 获取落地措施生成任务状态
   * GET /survey/:id/action-plan/task/:taskId
   */
  @Get(':id/action-plan/task/:taskId')
  async getActionPlanTaskStatus(@Param('id') surveyId: string, @Param('taskId') taskId: string) {
    try {
      const status = await this.actionPlanGenerationService.getTaskStatus(taskId)

      return {
        success: true,
        data: status,
      }
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取任务状态失败',
      }
    }
  }

  /**
   * 获取问卷的所有落地措施
   * GET /survey/:id/action-plan/measures
   */
  @Get(':id/action-plan/measures')
  async getActionPlanMeasures(@Param('id') surveyId: string) {
    try {
      const measures = await this.actionPlanGenerationService.getMeasuresBySurvey(surveyId)

      return {
        success: true,
        data: measures,
        message: `共找到 ${measures.length} 条改进措施`,
      }
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取落地措施失败',
      }
    }
  }

  /**
   * 上传并分析问卷答案（用于差距分析）
   * POST /survey/upload-and-analyze
   */
  @Post('upload-and-analyze')
  async uploadAndAnalyze(@Body() dto: UploadAndAnalyzeDto) {
    try {
      this.logger.debug(`[SurveyController] 收到上传并分析请求: ${dto.projectId}`)

      // 1. 获取项目的问卷任务
      const questionnaireTasks = await this.surveyService['aiTaskRepository'].find({
        where: {
          projectId: dto.projectId,
          type: AITaskType.QUESTIONNAIRE,
          status: TaskStatus.COMPLETED,
        },
        order: {
          createdAt: 'DESC',
        },
        take: 1,
      })

      if (!questionnaireTasks || questionnaireTasks.length === 0) {
        return {
          success: false,
          message: '未找到已完成的问卷任务，请先完成问卷生成',
        }
      }

      const questionnaireTaskId = questionnaireTasks[0].id
      this.logger.debug(`[SurveyController] 使用问卷任务: ${questionnaireTaskId}`)

      // 2. 创建问卷填写记录
      const createSurveyDto: CreateSurveyDto = {
        questionnaireTaskId,
        respondentName: dto.questionnaireData.respondentInfo.name,
        respondentDepartment: dto.questionnaireData.respondentInfo.department,
        respondentPosition: dto.questionnaireData.respondentInfo.position,
      }

      const survey = await this.surveyService.createSurvey(createSurveyDto)

      // 3. 提交问卷
      const submitSurveyDto: SubmitSurveyDto = {
        answers: dto.questionnaireData.answers,
        totalScore: dto.questionnaireData.totalScore,
        maxScore: dto.questionnaireData.maxScore,
      }

      await this.surveyService.submitSurvey(survey.id, submitSurveyDto)

      // 4. 进行成熟度分析
      const analysis = await this.maturityAnalysisService.analyzeSurvey(survey.id)

      this.logger.debug(`[SurveyController] 上传并分析完成, survey ID: ${survey.id}`)

      return {
        success: true,
        data: {
          ...analysis,
          surveyResponseId: survey.id,
        },
        message: '差距分析完成',
      }
    } catch (error) {
      console.error('[SurveyController] 上传并分析失败:', error.message, error.stack)
      return {
        success: false,
        message: error.message || '上传并分析失败',
      }
    }
  }

  /**
   * 判断题差距分析
   * POST /survey/binary-gap-analysis
   */
  @Post('binary-gap-analysis')
  @HttpCode(HttpStatus.OK)
  async analyzeBinaryGap(@Body() dto: BinaryGapAnalysisInput) {
    try {
      this.logger.debug(`[SurveyController] 收到判断题差距分析请求: ${JSON.stringify(dto)}`)
      const result = await this.binaryGapAnalyzer.analyzeGap(dto)
      this.logger.debug('[SurveyController] 差距分析完成')
      return {
        success: true,
        data: result,
        message: '差距分析完成',
      }
    } catch (error) {
      console.error('[SurveyController] 差距分析失败:', error.message, error.stack)
      return {
        success: false,
        message: error.message || '差距分析失败',
      }
    }
  }
}
