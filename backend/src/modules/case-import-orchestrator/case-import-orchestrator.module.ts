import { BullModule } from '@nestjs/bullmq'
import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CaseControlMap } from '../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { RawContent } from '../../database/entities/raw-content.entity'
import { RegulationClause } from '../../database/entities/regulation-clause.entity'
import { AuditModule } from '../audit/audit.module'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { KG_CASE_IMPORT_QUEUE } from './constants/case-import.constants'
import { CaseImportController } from './controllers/case-import.controller'
import { CaseHumanReviewController } from './controllers/case-human-review.controller'
import { CaseImportAuditFilter } from './filters/case-import-audit.filter'
import { CaseImportProcessor } from './processors/case-import.processor'
import { CaseClusteringChainService } from './services/case-clustering-chain.service'
import { CaseClusteringService } from './services/case-clustering.service'
import { CaseExtractionService } from './services/case-extraction.service'
import { CaseHumanReviewService } from './services/case-human-review.service'
import { CaseImportService } from './services/case-import.service'
import { CaseImportQueueService } from './services/case-import-queue.service'
import { It04TaxonomyClassifierService } from './services/it04-taxonomy-classifier.service'
import { CaseThemeIntelligenceService } from './services/case-theme-intelligence.service'
import { ComplianceCaseBackfillService } from './services/compliance-case-backfill.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RawContent,
      ComplianceCase,
      RegulationClause,
      ControlPoint,
      CaseControlMap,
    ]),
    BullModule.registerQueue({
      name: KG_CASE_IMPORT_QUEUE,
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
    AIClientsModule,
    KnowledgeGraphModule,
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [CaseImportController, CaseHumanReviewController],
  providers: [
    CaseHumanReviewService,
    CaseClusteringChainService,
    CaseClusteringService,
    CaseExtractionService,
    CaseImportService,
    CaseImportQueueService,
    It04TaxonomyClassifierService,
    CaseThemeIntelligenceService,
    ComplianceCaseBackfillService,
    CaseImportProcessor,
    CaseImportAuditFilter,
  ],
  exports: [CaseImportService, CaseImportQueueService, ComplianceCaseBackfillService],
})
export class CaseImportOrchestratorModule {}
