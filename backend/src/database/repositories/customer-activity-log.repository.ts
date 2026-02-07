import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { CustomerActivityLog } from '../entities/customer-activity-log.entity';

/**
 * CustomerActivityLogRepository
 *
 * Repository for customer activity logs.
 * Platform-level repository for tracking customer engagement.
 *
 * @module backend/src/database/repositories
 * @story 7-3
 */
@Injectable()
export class CustomerActivityLogRepository {
  constructor(
    @InjectRepository(CustomerActivityLog)
    private readonly repository: Repository<CustomerActivityLog>,
  ) {}

  /**
   * Create a new activity log entry
   */
  async create(data: Partial<CustomerActivityLog>): Promise<CustomerActivityLog> {
    const log = this.repository.create(data);
    return this.repository.save(log);
  }

  /**
   * Find activity log by organization, type, and date
   */
  async findByOrganizationAndDate(
    organizationId: string,
    activityType: string,
    activityDate: string,
  ): Promise<CustomerActivityLog | null> {
    return this.repository.findOne({
      where: {
        organizationId,
        activityType: activityType as any,
        activityDate,
      },
    });
  }

  /**
   * Get activity summary for an organization over a date range
   */
  async getActivitySummary(
    organizationId: string,
    days: number = 30,
  ): Promise<{
    loginDays: number;
    pushViewDays: number;
    feedbackDays: number;
    settingsDays: number;
    totalActiveDays: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get activity counts by type
    const logs = await this.repository
      .createQueryBuilder('log')
      .select('log.activityType', 'type')
      .addSelect('COUNT(DISTINCT log.activityDate)', 'days')
      .where('log.organizationId = :orgId', { orgId: organizationId })
      .andWhere('log.activityDate >= :startDate', { startDate: startDateStr })
      .groupBy('log.activityType')
      .getRawMany();

    const summary = {
      loginDays: 0,
      pushViewDays: 0,
      feedbackDays: 0,
      settingsDays: 0,
      totalActiveDays: 0,
    };

    for (const log of logs) {
      const days = parseInt(log.days, 10);
      switch (log.type) {
        case 'login':
          summary.loginDays = days;
          break;
        case 'push_view':
          summary.pushViewDays = days;
          break;
        case 'feedback_submit':
          summary.feedbackDays = days;
          break;
        case 'settings_update':
          summary.settingsDays = days;
          break;
      }
    }

    // Calculate total active days (union of all activity types)
    const activeDaysResult = await this.repository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.activityDate)', 'count')
      .where('log.organizationId = :orgId', { orgId: organizationId })
      .andWhere('log.activityDate >= :startDate', { startDate: startDateStr })
      .getRawOne();

    summary.totalActiveDays = parseInt(activeDaysResult?.count || '0', 10);

    return summary;
  }

  /**
   * Get daily activity trend for an organization
   */
  async getActivityTrend(
    organizationId: string,
    days: number = 30,
  ): Promise<Array<{ date: string; rate: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const logs = await this.repository
      .createQueryBuilder('log')
      .select('log.activityDate', 'date')
      .addSelect('SUM(log.activityCount)', 'count')
      .where('log.organizationId = :orgId', { orgId: organizationId })
      .andWhere('log.activityDate >= :startDate', { startDate: startDateStr })
      .groupBy('log.activityDate')
      .orderBy('log.activityDate', 'ASC')
      .getRawMany();

    // Fill in missing dates with 0
    const trend: Array<{ date: string; rate: number }> = [];
    const dateMap = new Map(logs.map((l) => [l.date, parseInt(l.count, 10)]));

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trend.push({
        date: dateStr,
        rate: dateMap.has(dateStr) ? 1 : 0, // 1 if active, 0 if not
      });
    }

    return trend;
  }

  /**
   * Increment activity count for existing log or create new one
   */
  async upsertActivity(
    organizationId: string,
    activityType: 'login' | 'push_view' | 'feedback_submit' | 'settings_update',
    activityDate: string,
    metadata?: Record<string, any>,
  ): Promise<CustomerActivityLog> {
    const existing = await this.findByOrganizationAndDate(
      organizationId,
      activityType,
      activityDate,
    );

    if (existing) {
      existing.activityCount += 1;
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      return this.repository.save(existing);
    } else {
      return this.create({
        organizationId,
        activityType,
        activityDate,
        activityCount: 1,
        metadata,
      });
    }
  }

  /**
   * Get recent activity count for a specific activity type
   */
  async getRecentActivityCount(
    organizationId: string,
    activityType: string,
    days: number = 30,
  ): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const result = await this.repository
      .createQueryBuilder('log')
      .select('COUNT(*)', 'count')
      .where('log.organizationId = :orgId', { orgId: organizationId })
      .andWhere('log.activityType = :type', { type: activityType })
      .andWhere('log.activityDate >= :startDate', { startDate: startDateStr })
      .getRawOne();

    return parseInt(result?.count || '0', 10);
  }

  /**
   * Get all activity logs for an organization
   */
  async findByOrganization(
    organizationId: string,
    limit: number = 100,
  ): Promise<CustomerActivityLog[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Delete old activity logs (for data retention)
   */
  async deleteOldLogs(daysAgo: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('activityDate < :date', { date: cutoffDateStr })
      .execute();

    return result.affected || 0;
  }
}
