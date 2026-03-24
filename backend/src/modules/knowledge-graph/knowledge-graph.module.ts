import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ControlPointController } from './controllers/control-point.controller'
import { TaxonomyController } from './controllers/taxonomy.controller'
import { ControlPointService } from './services/control-point.service'
import { TaxonomyService } from './services/taxonomy.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([TaxonomyL1, TaxonomyL2, ControlPoint]),
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [TaxonomyController, ControlPointController],
  providers: [TaxonomyService, ControlPointService],
  exports: [TaxonomyService, ControlPointService],
})
export class KnowledgeGraphModule {}
