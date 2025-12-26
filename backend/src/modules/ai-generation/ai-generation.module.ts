import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIGenerationService } from './ai-generation.service'
import { AIGenerationController } from './ai-generation.controller'
import { SummaryGenerator } from './generators/summary.generator'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { QualityValidationModule } from '../quality-validation/quality-validation.module'
import { ResultAggregationModule } from '../result-aggregation/result-aggregation.module'
import { AITasksModule } from '../ai-tasks/ai-tasks.module'
import { AITask } from '../../database/entities/ai-task.entity'
import { Project } from '../../database/entities/project.entity'
import { User } from '../../database/entities/user.entity'

/**
 * AI生成模块
 * 提供各种AI生成功能（综述、聚类、矩阵、问卷、措施）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AITask, Project, User]),
    AIClientsModule,
    QualityValidationModule,
    ResultAggregationModule,
    AITasksModule,
  ],
  controllers: [AIGenerationController],
  providers: [
    AIGenerationService,
    SummaryGenerator,
    // TODO: 添加其他生成器
    // ClusteringGenerator,
    // MatrixGenerator,
    // QuestionnaireGenerator,
    // ActionPlanGenerator,
  ],
  exports: [AIGenerationService],
})
export class AIGenerationModule {}
