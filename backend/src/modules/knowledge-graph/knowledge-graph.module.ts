import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CaseControlMap } from '../../database/entities/case-control-map.entity'
import { ClauseControlMap } from '../../database/entities/clause-control-map.entity'
import { ComplianceCase } from '../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { RegulationClause } from '../../database/entities/regulation-clause.entity'
import { RegulationSource } from '../../database/entities/regulation-source.entity'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ComplianceCaseController } from './controllers/compliance-case.controller'
import { ControlPointController } from './controllers/control-point.controller'
import { RegulationController } from './controllers/regulation.controller'
import { TaxonomyController } from './controllers/taxonomy.controller'
import { ComplianceCaseService } from './services/compliance-case.service'
import { ControlPointService } from './services/control-point.service'
import { RegulationService } from './services/regulation.service'
import { TaxonomyService } from './services/taxonomy.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxonomyL1,
      TaxonomyL2,
      ControlPoint,
      RegulationSource,
      RegulationClause,
      ClauseControlMap,
      ComplianceCase,
      CaseControlMap,
    ]),
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [
    TaxonomyController,
    ControlPointController,
    RegulationController,
    ComplianceCaseController,
  ],
  providers: [TaxonomyService, ControlPointService, RegulationService, ComplianceCaseService],
  exports: [TaxonomyService, ControlPointService, RegulationService, ComplianceCaseService],
})
export class KnowledgeGraphModule {}
