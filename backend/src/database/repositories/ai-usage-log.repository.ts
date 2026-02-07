import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AIUsageLog, AIUsageTaskType } from '../entities/ai-usage-log.entity';

/**
 * AI Usage Log Repository
 *
 * Provides data access methods for AI usage logs.
 *
 * @story 7-4
 * @module backend/src/database/repositories
 */
@Injectable()
export class AIUsageLogRepository extends Repository<AIUsageLog> {
  constructor(private dataSource: DataSource) {
    super(AIUsageLog, dataSource.createEntityManager());
  }

  /**
   * Find AI usage logs by organization and month
   *
   * @param organizationId - Organization ID
   * @param startDate - Start date of the month
   * @param endDate - End date of the month
   * @returns Array of AI usage logs
   */
  async findByOrganizationAndMonth(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AIUsageLog[]> {
    return this.createQueryBuilder('log')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startDate', { startDate })
      .andWhere('log.createdAt < :endDate', { endDate })
      .orderBy('log.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Get cost breakdown by task type for an organization
   *
   * @param organizationId - Organization ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of cost breakdown by task type
   */
  async getCostBreakdown(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ taskType: AIUsageTaskType; cost: number; count: number }>> {
    const results = await this.createQueryBuilder('log')
      .select('log.taskType', 'taskType')
      .addSelect('SUM(log.cost)', 'cost')
      .addSelect('COUNT(*)', 'count')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startDate', { startDate })
      .andWhere('log.createdAt < :endDate', { endDate })
      .groupBy('log.taskType')
      .getRawMany();

    return results.map((r) => ({
      taskType: r.taskType as AIUsageTaskType,
      cost: parseFloat(r.cost || '0'),
      count: parseInt(r.count || '0', 10),
    }));
  }

  /**
   * Get total cost for an organization in a date range
   *
   * @param organizationId - Organization ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Total cost
   */
  async getTotalCost(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.createQueryBuilder('log')
      .select('SUM(log.cost)', 'totalCost')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startDate', { startDate })
      .andWhere('log.createdAt < :endDate', { endDate })
      .getRawOne();

    return parseFloat(result?.totalCost || '0');
  }

  /**
   * Get top cost organizations
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @param limit - Number of organizations to return
   * @returns Array of organizations with their costs
   */
  async getTopCostOrganizations(
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<Array<{ organizationId: string; cost: number; count: number }>> {
    const results = await this.createQueryBuilder('log')
      .select('log.organizationId', 'organizationId')
      .addSelect('SUM(log.cost)', 'cost')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt >= :startDate', { startDate })
      .andWhere('log.createdAt < :endDate', { endDate })
      .groupBy('log.organizationId')
      .orderBy('cost', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      organizationId: r.organizationId,
      cost: parseFloat(r.cost || '0'),
      count: parseInt(r.count || '0', 10),
    }));
  }

  /**
   * Get daily cost trend
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of daily costs
   */
  async getDailyCostTrend(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; cost: number; count: number }>> {
    const results = await this.createQueryBuilder('log')
      .select("DATE(log.createdAt AT TIME ZONE 'UTC')", 'date')
      .addSelect('SUM(log.cost)', 'cost')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt >= :startDate', { startDate })
      .andWhere('log.createdAt < :endDate', { endDate })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      cost: parseFloat(r.cost || '0'),
      count: parseInt(r.count || '0', 10),
    }));
  }

  /**
   * Find AI usage logs with filters
   *
   * @param filters - Filter criteria
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Paginated AI usage logs
   */
  async findWithFilters(
    filters: { organizationId?: string },
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ data: AIUsageLog[]; total: number }> {
    const query = this.createQueryBuilder('log');

    if (filters.organizationId) {
      query.andWhere('log.organizationId = :organizationId', {
        organizationId: filters.organizationId,
      });
    }

    if (startDate) {
      query.andWhere('log.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('log.createdAt < :endDate', { endDate });
    }

    query.orderBy('log.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return { data, total };
  }
}
