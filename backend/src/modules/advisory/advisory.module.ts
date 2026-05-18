import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdvisoryModuleConfig } from '../../database/entities/advisory-module-config.entity'
import { AuditModule } from '../audit/audit.module'
import { AdvisoryAccessController } from './access/advisory-access.controller'
import { AdvisoryAccessService } from './access/advisory-access.service'
import { AdvisoryModuleConfigRepository } from './admin/advisory-module-config.repository'
import { AdvisoryAdminController } from './admin/advisory-admin.controller'
import { AdvisoryAdminService } from './admin/advisory-admin.service'

@Module({
  imports: [AuditModule, TypeOrmModule.forFeature([AdvisoryModuleConfig])],
  controllers: [AdvisoryAccessController, AdvisoryAdminController],
  providers: [AdvisoryAccessService, AdvisoryAdminService, AdvisoryModuleConfigRepository],
  exports: [AdvisoryAccessService, AdvisoryAdminService],
})
export class AdvisoryModule {}
