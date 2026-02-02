import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AuditLogService } from '../audit-log.service';
import { AuditLog } from '../../../database/entities/audit-log.entity';

/**
 * AuditLogProcessor
 *
 * Processes audit log entries from the queue.
 * This ensures audit logs are not lost even if the main request fails or the process crashes.
 *
 * Queue: audit-log
 * Concurrency: 5 (can process 5 audit logs simultaneously)
 *
 * @module backend/src/modules/audit/processors/audit-log.processor
 * @story 6-1B
 * @phase Phase 2: Audit Layer Implementation - LOW Issue Fix
 */
@Processor('audit-log', {
  concurrency: 5,
})
export class AuditLogProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditLogProcessor.name);

  constructor(private readonly auditLogService: AuditLogService) {
    super();
  }

  /**
   * Process audit log job
   *
   * @param job - BullMQ job containing audit log data
   */
  async process(job: Job<Partial<AuditLog>>): Promise<void> {
    this.logger.debug(`Processing audit log job ${job.id}`);

    try {
      await this.auditLogService.log(job.data);
      this.logger.debug(`Audit log job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process audit log job ${job.id}`, error);
      // Re-throw to trigger BullMQ retry mechanism
      throw error;
    }
  }
}
