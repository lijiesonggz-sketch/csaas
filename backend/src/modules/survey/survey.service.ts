import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SurveyResponse, SurveyStatus } from '../../database/entities/survey-response.entity'
import { AITask, AITaskType, TaskStatus } from '../../database/entities/ai-task.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { CreateSurveyDto, SaveDraftDto, SubmitSurveyDto } from './dto'

@Injectable()
export class SurveyService {
  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: Repository<SurveyResponse>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    @InjectRepository(AIGenerationResult)
    private readonly aiGenerationResultRepository: Repository<AIGenerationResult>,
  ) {}

  /**
   * 创建新的问卷填写记录
   */
  async createSurvey(dto: CreateSurveyDto): Promise<SurveyResponse> {
    try {
      console.log(
        '[SurveyService] 开始创建问卷填写记录, questionnaireTaskId:',
        dto.questionnaireTaskId,
      )

      // 验证问卷任务是否存在
      const questionnaireTask = await this.aiTaskRepository.findOne({
        where: { id: dto.questionnaireTaskId },
      })

      console.log('[SurveyService] 问卷任务查询结果:', questionnaireTask ? '找到' : '未找到')

      if (!questionnaireTask) {
        throw new NotFoundException('问卷任务不存在')
      }

      // 支持普通问卷和判断题问卷
      if (
        questionnaireTask.type !== AITaskType.QUESTIONNAIRE &&
        questionnaireTask.type !== AITaskType.BINARY_QUESTIONNAIRE
      ) {
        throw new BadRequestException(
          '任务类型必须是问卷生成任务（QUESTIONNAIRE或BINARY_QUESTIONNAIRE）',
        )
      }

      console.log('[SurveyService] 开始查询生成结果...')

      // 检查是否有生成结果（而不是检查任务状态）
      const generationResult = await this.aiGenerationResultRepository.findOne({
        where: { taskId: dto.questionnaireTaskId },
      })

      console.log('[SurveyService] 生成结果查询结果:', generationResult ? '找到' : '未找到')

      if (!generationResult || !generationResult.selectedResult) {
        throw new BadRequestException('问卷尚未生成或生成失败，请先完成问卷生成')
      }

      console.log('[SurveyService] 开始创建SurveyResponse记录...')

      const surveyResponse = this.surveyResponseRepository.create({
        questionnaireTaskId: dto.questionnaireTaskId,
        respondentName: dto.respondentName,
        respondentEmail: dto.respondentEmail,
        respondentDepartment: dto.respondentDepartment,
        respondentPosition: dto.respondentPosition,
        status: SurveyStatus.DRAFT,
        answers: {},
        progressPercentage: 0,
        startedAt: new Date(),
      })

      console.log('[SurveyService] SurveyResponse记录已创建，开始保存到数据库...')

      const savedResponse = await this.surveyResponseRepository.save(surveyResponse)

      console.log('[SurveyService] 保存成功, ID:', savedResponse.id)

      return savedResponse
    } catch (error) {
      console.error('[SurveyService] 创建问卷填写记录失败:', error)
      throw error
    }
  }

  /**
   * 保存问卷草稿
   */
  async saveDraft(surveyId: string, dto: SaveDraftDto): Promise<SurveyResponse> {
    const survey = await this.surveyResponseRepository.findOne({
      where: { id: surveyId },
    })

    if (!survey) {
      throw new NotFoundException('问卷填写记录不存在')
    }

    if (survey.status === SurveyStatus.SUBMITTED) {
      throw new BadRequestException('问卷已提交，无法修改')
    }

    if (survey.status === SurveyStatus.COMPLETED) {
      throw new BadRequestException('问卷已完成，无法修改')
    }

    // 更新答案和进度
    survey.answers = dto.answers
    if (dto.progressPercentage !== undefined) {
      survey.progressPercentage = dto.progressPercentage
    }
    if (dto.totalScore !== undefined) {
      survey.totalScore = dto.totalScore
    }
    if (dto.maxScore !== undefined) {
      survey.maxScore = dto.maxScore
    }

    return await this.surveyResponseRepository.save(survey)
  }

  /**
   * 提交问卷
   */
  async submitSurvey(surveyId: string, dto: SubmitSurveyDto): Promise<SurveyResponse> {
    const survey = await this.surveyResponseRepository.findOne({
      where: { id: surveyId },
      relations: ['questionnaireTask'],
    })

    if (!survey) {
      throw new NotFoundException('问卷填写记录不存在')
    }

    if (survey.status === SurveyStatus.SUBMITTED) {
      throw new BadRequestException('问卷已提交')
    }

    if (survey.status === SurveyStatus.COMPLETED) {
      throw new BadRequestException('问卷已完成')
    }

    // 更新为已提交状态
    survey.answers = dto.answers
    survey.totalScore = dto.totalScore
    survey.maxScore = dto.maxScore
    survey.progressPercentage = 100
    survey.status = SurveyStatus.SUBMITTED
    survey.submittedAt = new Date()
    if (dto.notes) {
      survey.notes = dto.notes
    }

    // 如果是判断题问卷，自动计算得分（true的数量 / 总题数 * 100）
    if (survey.questionnaireTask?.type === AITaskType.BINARY_QUESTIONNAIRE) {
      const answers = dto.answers
      let trueCount = 0
      let totalCount = 0

      for (const questionId in answers) {
        totalCount++
        if (answers[questionId] === true || answers[questionId]?.answer === true) {
          trueCount++
        }
      }

      survey.totalScore = totalCount > 0 ? (trueCount / totalCount) * 100 : 0
      survey.maxScore = 100
      console.log(
        `[SurveyService] 判断题问卷自动计算得分: ${trueCount}/${totalCount} = ${survey.totalScore}`,
      )
    }

    return await this.surveyResponseRepository.save(survey)
  }

  /**
   * 获取问卷填写记录
   */
  async getSurvey(surveyId: string): Promise<SurveyResponse> {
    const survey = await this.surveyResponseRepository.findOne({
      where: { id: surveyId },
      relations: ['questionnaireTask'],
    })

    if (!survey) {
      throw new NotFoundException('问卷填写记录不存在')
    }

    return survey
  }

  /**
   * 获取问卷任务的所有填写记录
   */
  async getSurveysByQuestionnaireTask(questionnaireTaskId: string): Promise<SurveyResponse[]> {
    return await this.surveyResponseRepository.find({
      where: { questionnaireTaskId },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * 删除问卷填写记录
   */
  async deleteSurvey(surveyId: string): Promise<void> {
    const survey = await this.surveyResponseRepository.findOne({
      where: { id: surveyId },
    })

    if (!survey) {
      throw new NotFoundException('问卷填写记录不存在')
    }

    if (survey.status === SurveyStatus.COMPLETED) {
      throw new BadRequestException('已完成的问卷无法删除')
    }

    await this.surveyResponseRepository.remove(survey)
  }
}
