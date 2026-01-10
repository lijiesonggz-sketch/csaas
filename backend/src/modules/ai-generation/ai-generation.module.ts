import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIGenerationService } from './ai-generation.service'
import { AIGenerationController } from './ai-generation.controller'
import { SummaryGenerator } from './generators/summary.generator'
import { ClusteringGenerator } from './generators/clustering.generator'
import { MatrixGenerator } from './generators/matrix.generator'
import { QuestionnaireGenerator } from './generators/questionnaire.generator'
import { ActionPlanGenerator } from './generators/action-plan.generator'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { QualityValidationModule } from '../quality-validation/quality-validation.module'
import { ResultAggregationModule } from '../result-aggregation/result-aggregation.module'
import { AITasksModule } from '../ai-tasks/ai-tasks.module'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationEvent } from '../../database/entities/ai-generation-event.entity'
import { Project } from '../../database/entities/project.entity'
import { User } from '../../database/entities/user.entity'
import { SurveyResponse } from '../../database/entities/survey-response.entity'

/**
 * AI生成模块
 * 提供各种AI生成功能（综述、聚类、矩阵、问卷、措施）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AITask, AIGenerationEvent, Project, User, SurveyResponse]),
    AIClientsModule,
    QualityValidationModule,
    ResultAggregationModule,
    forwardRef(() => AITasksModule),
  ],
  controllers: [AIGenerationController],
  providers: [
    AIGenerationService,
    SummaryGenerator,
    ClusteringGenerator,
    MatrixGenerator,
    QuestionnaireGenerator,
    ActionPlanGenerator,
  ],
  exports: [AIGenerationService, ClusteringGenerator, MatrixGenerator, QuestionnaireGenerator],
})
export class AIGenerationModule {}
