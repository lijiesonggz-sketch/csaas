import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CaseControlMap } from '../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../database/entities/compliance-case.entity'
import { ComplianceCaseClassificationRun } from '../../database/entities/compliance-case-classification-run.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { KgTaxonomyDomainRolloutPolicy } from '../../database/entities/kg-taxonomy-domain-rollout-policy.entity'
import { RawContent } from '../../database/entities/raw-content.entity'
import { RegulationClause } from '../../database/entities/regulation-clause.entity'
import { TaxonomyL2RuntimeProfile } from '../../database/entities/taxonomy-l2-runtime-profile.entity'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { AuditModule } from '../audit/audit.module'
import { AIClientsModule } from '../ai-clients/ai-clients.module'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { KG_CASE_IMPORT_QUEUE } from './constants/case-import.constants'
import { CaseImportController } from './controllers/case-import.controller'
import { CaseHumanReviewController } from './controllers/case-human-review.controller'
import { TaxonomyGovernanceController } from './controllers/taxonomy-governance.controller'
import { TaxonomyRolloutController } from './controllers/taxonomy-rollout.controller'
import { CaseImportAuditFilter } from './filters/case-import-audit.filter'
import { CaseImportProcessor } from './processors/case-import.processor'
import { CaseClusteringChainService } from './services/case-clustering-chain.service'
import { CaseClusteringService } from './services/case-clustering.service'
import { CaseExtractionService } from './services/case-extraction.service'
import { ClassificationTelemetryService } from './services/classification-telemetry.service'
import { CaseHumanReviewService } from './services/case-human-review.service'
import { ComplianceCaseClassificationRunService } from './services/compliance-case-classification-run.service'
import { ComplianceCaseReclassificationService } from './services/compliance-case-reclassification.service'
import { CaseImportService } from './services/case-import.service'
import { CaseImportQueueService } from './services/case-import-queue.service'
import { It04TaxonomyClassifierService } from './services/it04-taxonomy-classifier.service'
import { CaseThemeIntelligenceService } from './services/case-theme-intelligence.service'
import { ComplianceCaseBackfillService } from './services/compliance-case-backfill.service'
import { LegacyCaseThemeFallbackService } from './services/legacy-case-theme-fallback.service'
import { RuntimeDomainSelectorService } from './services/runtime-domain-selector.service'
import { TaxonomyDomainGateService } from './services/taxonomy-domain-gate.service'
import {
  DomainLegacyPathManagerService,
  DomainRetirementPrerequisiteVerifierService,
  DomainRetirementReleaseGuardService,
  DomainRetirementSmokeVerifierService,
  TaxonomyDomainRetirementService,
} from './services/taxonomy-domain-retirement.service'
import { CaseNormalizationService } from './services/taxonomy-classification/case-normalization.service'
import {
  CSV_BACKED_MAPPING_REPOSITORY_OPTIONS,
  CsvBackedMappingRepository,
} from './services/taxonomy-classification/csv-backed-mapping.repository'
import { DomainRolloutPolicyService } from './services/taxonomy-classification/domain-rollout-policy.service'
import { TaxonomyGovernanceService } from './services/taxonomy-classification/taxonomy-governance.service'
import { TypeOrmBackedMappingRepository } from './services/taxonomy-classification/typeorm-backed-mapping.repository'
import { TAXONOMY_MAPPING_REPOSITORY } from './services/taxonomy-classification/mapping-repository.interface'
import { TaxonomyClassifierEngine } from './services/taxonomy-classification/taxonomy-classifier.engine'
import { TaxonomyClassifierService } from './services/taxonomy-classification/taxonomy-classifier.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RawContent,
      ComplianceCase,
      ComplianceCaseClassificationRun,
      KgTaxonomyDomainRolloutPolicy,
      TaxonomyL1,
      TaxonomyL2,
      TaxonomyL2RuntimeProfile,
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
  controllers: [
    CaseImportController,
    CaseHumanReviewController,
    TaxonomyGovernanceController,
    TaxonomyRolloutController,
  ],
  providers: [
    CaseHumanReviewService,
    CaseClusteringChainService,
    CaseClusteringService,
    CaseExtractionService,
    CaseImportService,
    CaseImportQueueService,
    ComplianceCaseReclassificationService,
    RuntimeDomainSelectorService,
    DomainRolloutPolicyService,
    TaxonomyDomainGateService,
    DomainRetirementPrerequisiteVerifierService,
    DomainLegacyPathManagerService,
    DomainRetirementSmokeVerifierService,
    DomainRetirementReleaseGuardService,
    TaxonomyDomainRetirementService,
    TaxonomyGovernanceService,
    ComplianceCaseClassificationRunService,
    ClassificationTelemetryService,
    CaseNormalizationService,
    {
      provide: CSV_BACKED_MAPPING_REPOSITORY_OPTIONS,
      useValue: {},
    },
    CsvBackedMappingRepository,
    TypeOrmBackedMappingRepository,
    TaxonomyClassifierEngine,
    TaxonomyClassifierService,
    It04TaxonomyClassifierService,
    CaseThemeIntelligenceService,
    LegacyCaseThemeFallbackService,
    ComplianceCaseBackfillService,
    CaseImportProcessor,
    CaseImportAuditFilter,
    {
      provide: TAXONOMY_MAPPING_REPOSITORY,
      useExisting: TypeOrmBackedMappingRepository,
    },
  ],
  exports: [
    CaseImportService,
    CaseImportQueueService,
    ComplianceCaseBackfillService,
    ComplianceCaseReclassificationService,
    TaxonomyDomainRetirementService,
  ],
})
export class CaseImportOrchestratorModule {}
