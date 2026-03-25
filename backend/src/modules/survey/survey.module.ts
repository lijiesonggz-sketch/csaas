import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SurveyController } from './survey.controller'
import { SurveyService } from './survey.service'
import { MaturityAnalysisService } from './maturity-analysis.service'
import { ActionPlanService } from './action-plan.service'
import { ActionPlanGenerationService } from './action-plan-generation.service'
import { BinaryGapAnalyzer } from './binary-gap-analyzer.service'
import { ProjectQuestionnaireSnapshotService } from './project-questionnaire-snapshot.service'
import { SurveyResponse } from '../../database/entities/survey-response.entity'
import { AITask } from '../../database/entities/ai-task.entity'
import { AIGenerationResult } from '../../database/entities/ai-generation-result.entity'
import { ActionPlanMeasure } from '../../database/entities/action-plan-measure.entity'
import { Project } from '../../database/entities/project.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { ApplicabilityEngineModule } from '../applicability-engine/applicability-engine.module'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SurveyResponse,
      AITask,
      AIGenerationResult,
      ActionPlanMeasure,
      Project,
      ControlPoint,
    ]),
    AIClientsModule, // 导入AI客户端模块以使用AIOrchestrator
    ApplicabilityEngineModule,
    AuditModule,
    OrganizationsModule,
  ],
  controllers: [SurveyController],
  providers: [
    SurveyService,
    MaturityAnalysisService,
    ActionPlanService,
    ActionPlanGenerationService,
    BinaryGapAnalyzer,
    ProjectQuestionnaireSnapshotService,
  ],
  exports: [
    SurveyService,
    MaturityAnalysisService,
    ActionPlanService,
    ActionPlanGenerationService,
    BinaryGapAnalyzer,
    ProjectQuestionnaireSnapshotService,
  ],
})
export class SurveyModule {}
