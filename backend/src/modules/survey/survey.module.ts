import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SurveyController } from './survey.controller'
import { SurveyService } from './survey.service'
import { MaturityAnalysisService } from './maturity-analysis.service'
import { ActionPlanService } from './action-plan.service'
import { ActionPlanGenerationService } from './action-plan-generation.service'
import { SurveyResponse } from '../../database/entities/survey-response.entity'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { ActionPlanMeasure } from '../../database/entities/action-plan-measure.entity'
import { AIClientsModule } from '../ai-clients/ai-clients.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([SurveyResponse, AITask, AIGenerationResult, ActionPlanMeasure]),
    AIClientsModule, // 导入AI客户端模块以使用AIOrchestrator
  ],
  controllers: [SurveyController],
  providers: [SurveyService, MaturityAnalysisService, ActionPlanService, ActionPlanGenerationService],
  exports: [SurveyService, MaturityAnalysisService, ActionPlanService, ActionPlanGenerationService],
})
export class SurveyModule {}
