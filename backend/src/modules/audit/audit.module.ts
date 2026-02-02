import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogProcessor } from './processors/audit-log.processor';
import { OrganizationsModule } from '../organizations/organizations.module';

/**
 * AuditModule
 *
 * Provides audit logging functionality for the application.
 * Audit logs are immutable and retained for 1 year.
 *
 * Uses BullMQ for reliable audit log processing:
 * - Audit logs are queued and processed asynchronously
 * - Failed jobs are automatically retried
 * - Logs are not lost even if the process crashes
 *
 * @module backend/src/modules/audit/audit.module
 * @story 6-1B
 * @phase Phase 2: Audit Layer Implementation
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({
      name: 'audit-log',
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1 second delay
        },
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      },
    }),
    OrganizationsModule, // Import OrganizationsModule for TenantGuard dependency
  ],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditLogProcessor],
  exports: [AuditLogService],
})
export class AuditModule {}
