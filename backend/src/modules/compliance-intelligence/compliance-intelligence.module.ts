import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApplicabilityEngineModule } from '../applicability-engine/applicability-engine.module'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { FailureModeControlMap } from '../../database/entities/failure-mode-control-map.entity'
import { Project } from '../../database/entities/project.entity'
import { ReportPdfJob } from '../../database/entities/report-pdf-job.entity'
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
import { REPORT_PDF_QUEUE } from './constants/report-pdf.constants'
import { ReportPdfProcessor } from './processors/report-pdf.processor'
import { ControlReportCompilerService } from './services/control-report-compiler.service'
import { ControlExplainService } from './services/control-explain.service'
import { RadarRelevanceEnhancedService } from './services/radar-relevance-enhanced.service'
import { ReportPdfRendererService } from './services/report-pdf-renderer.service'
import { ReportPdfService } from './services/report-pdf.service'
import { ReportCenterService } from './services/report-center.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ReportPdfJob,
      SurveyResponse,
      ControlPoint,
      FailureModeControlMap,
      TaxonomyL1,
      TaxonomyL2,
      AnalyzedContent,
    ]),
    BullModule.registerQueue({
      name: REPORT_PDF_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
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
    ReportPdfService,
    ReportPdfRendererService,
    ReportPdfProcessor,
  ],
  exports: [
    ControlExplainService,
    RadarRelevanceEnhancedService,
    ControlReportCompilerService,
    ReportCenterService,
    ReportPdfService,
  ],
})
export class ComplianceIntelligenceModule {}
