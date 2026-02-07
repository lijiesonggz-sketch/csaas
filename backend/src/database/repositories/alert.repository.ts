import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, FindManyOptions } from 'typeorm';
import { Alert } from '../entities/alert.entity';

/**
 * AlertRepository
 *
 * Repository for system alerts.
 * Platform-level repository (no tenant filtering) - tracks system-wide alerts.
 *
 * @module backend/src/database/repositories
 * @story 7-1
 */
@Injectable()
export class AlertRepository {
  constructor(
    @InjectRepository(Alert)
    private readonly repository: Repository<Alert>,
  ) {}

  /**
   * Create a new alert
   */
  async create(data: Partial<Alert>): Promise<Alert> {
    const alert = this.repository.create(data);
    return this.repository.save(alert);
  }

  /**
   * Find alert by ID
   */
  async findById(id: string): Promise<Alert | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  /**
   * Find alerts with filters
   */
  async findWithFilters(filters: {
    status?: 'unresolved' | 'resolved' | 'ignored';
    severity?: 'high' | 'medium' | 'low';
    alertType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Alert[]; total: number }> {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.alertType) {
      where.alertType = filters.alertType;
    }

    const options: FindManyOptions<Alert> = {
      where,
      order: {
        occurredAt: 'DESC',
      },
    };

    if (filters.limit) {
      options.take = filters.limit;
    }
    if (filters.offset) {
      options.skip = filters.offset;
    }

    const [data, total] = await this.repository.findAndCount(options);

    return { data, total };
  }

  /**
   * Find recent duplicate alert (for deduplication)
   */
  async findRecentDuplicate(
    alertType: string,
    hoursAgo: number = 1,
  ): Promise<Alert | null> {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    return this.repository.findOne({
      where: {
        alertType: alertType as any,
        occurredAt: MoreThan(cutoffTime),
      },
      order: {
        occurredAt: 'DESC',
      },
    });
  }

  /**
   * Resolve an alert
   */
  async resolve(id: string, resolvedBy: string): Promise<Alert | null> {
    const alert = await this.findById(id);
    if (!alert) return null;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    return this.repository.save(alert);
  }

  /**
   * Count unresolved alerts
   */
  async countUnresolved(): Promise<number> {
    return this.repository.count({
      where: {
        status: 'unresolved',
      },
    });
  }

  /**
   * Count alerts by severity
   */
  async countBySeverity(): Promise<{
    high: number;
    medium: number;
    low: number;
  }> {
    const [high, medium, low] = await Promise.all([
      this.repository.count({
        where: { severity: 'high', status: 'unresolved' },
      }),
      this.repository.count({
        where: { severity: 'medium', status: 'unresolved' },
      }),
      this.repository.count({
        where: { severity: 'low', status: 'unresolved' },
      }),
    ]);

    return { high, medium, low };
  }

  /**
   * Delete old resolved alerts (for data retention)
   */
  async deleteOldResolved(daysAgo: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    await this.repository
      .createQueryBuilder()
      .delete()
      .where('status = :status', { status: 'resolved' })
      .andWhere('resolved_at < :date', { date: cutoffDate })
      .execute();
  }
}
