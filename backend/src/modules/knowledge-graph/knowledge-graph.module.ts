import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApplicabilityEngineModule } from '../applicability-engine/applicability-engine.module'
import { CaseControlMap } from '../../database/entities/case-control-map.entity'
import { ClauseControlMap } from '../../database/entities/clause-control-map.entity'
import { ComplianceCase } from '../../database/entities/compliance-case.entity'
import { ControlPack } from '../../database/entities/control-pack.entity'
import { ControlEvidenceMap } from '../../database/entities/control-evidence-map.entity'
import { ControlPackItem } from '../../database/entities/control-pack-item.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { EvidenceType } from '../../database/entities/evidence-type.entity'
import { QuestionItem } from '../../database/entities/question-item.entity'
import { RegulationClause } from '../../database/entities/regulation-clause.entity'
import { RegulationSource } from '../../database/entities/regulation-source.entity'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ComplianceCaseController } from './controllers/compliance-case.controller'
import { ControlPackLinkController } from './controllers/control-pack-link.controller'
import { ControlPointController } from './controllers/control-point.controller'
import { EvidenceController } from './controllers/evidence.controller'
import { QuestionItemController } from './controllers/question-item.controller'
import { RegulationController } from './controllers/regulation.controller'
import { TaxonomyController } from './controllers/taxonomy.controller'
import { ComplianceCaseService } from './services/compliance-case.service'
import { ControlPackLinkService } from './services/control-pack-link.service'
import { ControlPointService } from './services/control-point.service'
import { EvidenceService } from './services/evidence.service'
import { QuestionItemService } from './services/question-item.service'
import { RegulationService } from './services/regulation.service'
import { TaxonomyService } from './services/taxonomy.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxonomyL1,
      TaxonomyL2,
      ControlPoint,
      ControlPack,
      ControlPackItem,
      RegulationSource,
      RegulationClause,
      ClauseControlMap,
      ComplianceCase,
      CaseControlMap,
      EvidenceType,
      ControlEvidenceMap,
      QuestionItem,
    ]),
    OrganizationsModule,
    AuditModule,
    ApplicabilityEngineModule,
  ],
  controllers: [
    TaxonomyController,
    ControlPointController,
    ControlPackLinkController,
    EvidenceController,
    QuestionItemController,
    RegulationController,
    ComplianceCaseController,
  ],
  providers: [
    TaxonomyService,
    ControlPointService,
    ControlPackLinkService,
    EvidenceService,
    QuestionItemService,
    RegulationService,
    ComplianceCaseService,
  ],
  exports: [
    TaxonomyService,
    ControlPointService,
    ControlPackLinkService,
    EvidenceService,
    QuestionItemService,
    RegulationService,
    ComplianceCaseService,
  ],
})
export class KnowledgeGraphModule {}
