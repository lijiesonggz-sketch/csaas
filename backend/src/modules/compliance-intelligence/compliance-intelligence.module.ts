import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ControlPoint } from '../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../database/entities/taxonomy-l2.entity'
import { AuditModule } from '../audit/audit.module'
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ControlExplainController } from './controllers/control-explain.controller'
import { ControlExplainService } from './services/control-explain.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ControlPoint, TaxonomyL1, TaxonomyL2]),
    KnowledgeGraphModule,
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [ControlExplainController],
  providers: [ControlExplainService],
  exports: [ControlExplainService],
})
export class ComplianceIntelligenceModule {}
