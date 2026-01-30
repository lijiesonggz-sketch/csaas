import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from '../../../database/entities/audit-log.entity'

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async logPlaybookView(
    userId: string,
    organizationId: string,
    pushId: string,
    playbookStatus: string,
  ): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      userId,
      organizationId,
      action: 'playbook_view',
      entityType: 'compliance_playbook',
      entityId: pushId,
      details: { playbookStatus, timestamp: new Date().toISOString() },
    })

    await this.auditLogRepo.save(auditLog)
    this.logger.log(`Audit: User ${userId} viewed playbook ${pushId}`)
  }

  async logChecklistSubmit(
    userId: string,
    organizationId: string,
    pushId: string,
    checkedItems: string[],
    uncheckedItems: string[],
    notes?: string,
  ): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      userId,
      organizationId,
      action: 'checklist_submit',
      entityType: 'checklist_submission',
      entityId: pushId,
      details: {
        checkedItemsCount: checkedItems.length,
        uncheckedItemsCount: uncheckedItems.length,
        totalItemsCount: checkedItems.length + uncheckedItems.length,
        notes,
        timestamp: new Date().toISOString(),
      },
    })

    await this.auditLogRepo.save(auditLog)
    this.logger.log(
      `Audit: User ${userId} submitted checklist for push ${pushId} (${checkedItems.length} checked)`,
    )
  }

  async logChecklistUpdate(
    userId: string,
    organizationId: string,
    pushId: string,
    checkedItems: string[],
    uncheckedItems: string[],
  ): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      userId,
      organizationId,
      action: 'checklist_update',
      entityType: 'checklist_submission',
      entityId: pushId,
      details: {
        checkedItemsCount: checkedItems.length,
        uncheckedItemsCount: uncheckedItems.length,
        timestamp: new Date().toISOString(),
      },
    })

    await this.auditLogRepo.save(auditLog)
    this.logger.log(`Audit: User ${userId} updated checklist for push ${pushId}`)
  }
}
