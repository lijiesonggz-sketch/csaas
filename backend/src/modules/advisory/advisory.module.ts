import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module'
import { AdvisoryAccessController } from './access/advisory-access.controller'
import { AdvisoryAccessService } from './access/advisory-access.service'

@Module({
  imports: [AuditModule],
  controllers: [AdvisoryAccessController],
  providers: [AdvisoryAccessService],
  exports: [AdvisoryAccessService],
})
export class AdvisoryModule {}
