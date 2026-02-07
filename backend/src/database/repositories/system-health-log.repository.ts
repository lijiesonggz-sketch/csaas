import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { SystemHealthLog } from '../entities/system-health-log.entity';

/**
 * SystemHealthLogRepository
 *
 * Repository for system health logs.
 * Platform-level repository (no tenant filtering) - tracks system-wide health metrics.
 *
 * @module backend/src/database/repositories
 * @story 7-1
 */
@Injectable()
export class SystemHealthLogRepository {
  constructor(
    @InjectRepository(SystemHealthLog)
    private readonly repository: Repository<SystemHealthLog>,
  ) {}

  /**
   * Create a new health log entry
   */
  async create(data: Partial<SystemHealthLog>): Promise<SystemHealthLog> {
    const log = this.repository.create(data);
    return this.repository.save(log);
  }

  /**
   * Find logs by metric type within a date range
   */
  async findByMetricType(
    metricType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SystemHealthLog[]> {
    return this.repository.find({
      where: {
        metricType: metricType as any,
        recordedAt: Between(startDate, endDate),
      },
      order: {
        recordedAt: 'ASC',
      },
    });
  }

  /**
   * Find recent logs by metric type
   */
  async findRecentByMetricType(
    metricType: string,
    limit: number = 100,
  ): Promise<SystemHealthLog[]> {
    return this.repository.find({
      where: {
        metricType: metricType as any,
      },
      order: {
        recordedAt: 'DESC',
      },
      take: limit,
    });
  }

  /**
   * Find logs by status
   */
  async findByStatus(
    status: 'healthy' | 'warning' | 'critical',
    startDate?: Date,
  ): Promise<SystemHealthLog[]> {
    const where: any = { status };
    if (startDate) {
      where.recordedAt = MoreThan(startDate);
    }

    return this.repository.find({
      where,
      order: {
        recordedAt: 'DESC',
      },
    });
  }

  /**
   * Calculate uptime percentage for a date range
   */
  async calculateUptime(startDate: Date, endDate: Date): Promise<number> {
    const logs = await this.repository.find({
      where: {
        metricType: 'availability',
        recordedAt: Between(startDate, endDate),
      },
    });

    if (logs.length === 0) return 100;

    const uptimeCount = logs.filter((log) => log.metricValue === 1).length;
    return (uptimeCount / logs.length) * 100;
  }

  /**
   * Get latest log by metric type
   */
  async getLatestByMetricType(metricType: string): Promise<SystemHealthLog | null> {
    return this.repository.findOne({
      where: {
        metricType: metricType as any,
      },
      order: {
        recordedAt: 'DESC',
      },
    });
  }

  /**
   * Delete old logs (for data retention)
   */
  async deleteOlderThan(date: Date): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .where('recorded_at < :date', { date })
      .execute();
  }
}
