import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApplicabilityRule } from '../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../database/entities/control-pack.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { OrganizationProfile } from '../../database/entities/organization-profile.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ApplicabilityController } from './controllers/applicability.controller'
import { PackResolverService } from './services/pack-resolver.service'
import { RuleEvaluatorService } from './services/rule-evaluator.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationProfile,
      ApplicabilityRule,
      ControlPack,
      OrganizationMember,
    ]),
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [ApplicabilityController],
  providers: [RuleEvaluatorService, PackResolverService],
  exports: [RuleEvaluatorService, PackResolverService],
})
export class ApplicabilityEngineModule {}
