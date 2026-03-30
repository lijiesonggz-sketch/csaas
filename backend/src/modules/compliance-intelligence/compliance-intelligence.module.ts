import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApplicabilityEngineModule } from '../applicability-engine/applicability-engine.module'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { Project } from '../../database/entities/project.entity'
import { SurveyResponse } from '../../database/entities/survey-response.entity'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { AnalyzedContent } from '../../database/entities/analyzed-content.entity'
import { AuditModule } from '../audit/audit.module'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { SurveyModule } from '../survey/survey.module'
import { ControlReportController } from './controllers/control-report.controller'
import { ControlExplainController } from './controllers/control-explain.controller'
import { RadarRelevanceController } from './controllers/radar-relevance.controller'
import { ReportCenterController } from './controllers/report-center.controller'
import { ControlReportCompilerService } from './services/control-report-compiler.service'
import { ControlExplainService } from './services/control-explain.service'
import { RadarRelevanceEnhancedService } from './services/radar-relevance-enhanced.service'
import { ReportCenterService } from './services/report-center.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      SurveyResponse,
      ControlPoint,
      TaxonomyL1,
      TaxonomyL2,
      AnalyzedContent,
    ]),
    KnowledgeGraphModule,
    OrganizationsModule,
    AuditModule,
    ApplicabilityEngineModule,
    SurveyModule,
  ],
  controllers: [
    ControlExplainController,
    RadarRelevanceController,
    ControlReportController,
    ReportCenterController,
  ],
  providers: [
    ControlExplainService,
    RadarRelevanceEnhancedService,
    ControlReportCompilerService,
    ReportCenterService,
  ],
  exports: [
    ControlExplainService,
    RadarRelevanceEnhancedService,
    ControlReportCompilerService,
    ReportCenterService,
  ],
})
export class ComplianceIntelligenceModule {}
