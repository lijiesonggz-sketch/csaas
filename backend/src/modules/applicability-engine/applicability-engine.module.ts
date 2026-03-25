import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ApplicabilityRule } from '../../database/entities/applicability-rule.entity'
import { ControlPack } from '../../database/entities/control-pack.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { OrganizationProfile } from '../../database/entities/organization-profile.entity'
import { QuestionItem } from '../../database/entities/question-item.entity'
import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ApplicabilityController } from './controllers/applicability.controller'
import { OrganizationQuestionSetService } from './services/organization-question-set.service'
import { PackResolverService } from './services/pack-resolver.service'
import { RuleEvaluatorService } from './services/rule-evaluator.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationProfile,
      ApplicabilityRule,
      ControlPack,
      OrganizationMember,
      QuestionItem,
    ]),
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [ApplicabilityController],
  providers: [RuleEvaluatorService, PackResolverService, OrganizationQuestionSetService],
  exports: [RuleEvaluatorService, PackResolverService, OrganizationQuestionSetService],
})
export class ApplicabilityEngineModule {}
