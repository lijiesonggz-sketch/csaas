import { Injectable, InternalServerErrorException, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SystemHealthLogRepository } from '../../../database/repositories/system-health-log.repository';
import { AlertRepository } from '../../../database/repositories/alert.repository';

/**
 * DashboardService
 *
 * Service for calculating and retrieving system health metrics.
 * Implements Redis caching for performance optimization.
 *
 * @module backend/src/modules/admin/dashboard
 * @story 7-1
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly systemHealthLogRepo: SystemHealthLogRepository,
    private readonly alertRepo: AlertRepository,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get comprehensive health metrics
   * Uses Redis cache with 5-minute TTL for performance
   */
  async getHealthMetrics() {
    try {
      // Check cache first
      const cached = await this.cacheManager.get('dashboard:health');
      if (cached) {
        return cached;
      }

      // Calculate all metrics
      const metrics = {
        availability: await this.calculateAvailability(),
        pushSuccessRate: await this.calculatePushSuccessRate(),
        aiCost: await this.calculateAICost(),
        customerActivity: await this.calculateCustomerActivity(),
        lastUpdated: new Date().toISOString(), // Add timestamp for cache invalidation
      };

      // Cache for 5 minutes (300 seconds = 300000 milliseconds)
      // Note: cache-manager TTL unit depends on store (Redis: seconds, Memory: milliseconds)
      await this.cacheManager.set('dashboard:health', metrics, 300 * 1000);

      return metrics;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to calculate health metrics: ${error.message}`,
      );
    }
  }

  /**
   * Calculate system availability
   * Availability = (Total uptime - Downtime) / Total time × 100%
   */
  async calculateAvailability() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get availability logs from last 24 hours
      const logs = await this.systemHealthLogRepo.findByMetricType(
        'availability',
        oneDayAgo,
        now,
      );

      if (logs.length === 0) {
        // No data yet, return default healthy state
        return {
          current: 100.0,
          target: 99.5,
          status: 'healthy',
          uptime: 86400, // 24 hours in seconds
          downtime: 0,
        };
      }

      // Calculate uptime percentage
      const uptimeCount = logs.filter((log) => log.metricValue === 1).length;
      const totalCount = logs.length;
      const availabilityPercent = (uptimeCount / totalCount) * 100;

      // Calculate actual uptime/downtime in seconds
      const totalSeconds = 24 * 60 * 60;
      const uptimeSeconds = (uptimeCount / totalCount) * totalSeconds;
      const downtimeSeconds = totalSeconds - uptimeSeconds;

      const target = 99.5;
      const status = availabilityPercent >= target ? 'healthy' : 'critical';

      return {
        current: Number(availabilityPercent.toFixed(2)),
        target,
        status,
        uptime: Number(uptimeSeconds.toFixed(1)),
        downtime: Number(downtimeSeconds.toFixed(1)),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to calculate availability: ${error.message}`,
      );
    }
  }

  /**
   * Calculate push success rate
   * Success Rate = Successful pushes / Total pushes × 100%
   * Platform-level metric: aggregates across all tenants
   */
  async calculatePushSuccessRate() {
    try {
      // Query all tenants' push data (platform-level metric)
      // Note: Column names use camelCase (createdAt) not snake_case
      // Note: radar_pushes table does not have deletedAt column (no soft delete)
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM radar_pushes
        WHERE DATE("createdAt") = CURRENT_DATE
      `);

      const total = parseInt(result[0]?.total || '0', 10);
      const successful = parseInt(result[0]?.successful || '0', 10);
      const failed = parseInt(result[0]?.failed || '0', 10);

      if (total === 0) {
        // No pushes today yet
        return {
          current: 100.0,
          target: 98.0,
          status: 'healthy',
          totalPushes: 0,
          successfulPushes: 0,
          failedPushes: 0,
        };
      }

      const successRate = (successful / total) * 100;
      const target = 98.0;
      const status = successRate >= target ? 'healthy' : 'critical';

      return {
        current: Number(successRate.toFixed(2)),
        target,
        status,
        totalPushes: total,
        successfulPushes: successful,
        failedPushes: failed,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to calculate push success rate: ${error.message}`,
      );
    }
  }

  /**
   * Calculate AI cost metrics
   * Queries placeholder ai_usage_logs table (populated in Story 7.4)
   */
  async calculateAICost() {
    try {
      // Query ai_usage_logs table
      // Note: ai_usage_logs table uses snake_case (created_at) not camelCase
      const result = await this.dataSource.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN cost ELSE 0 END), 0) as today,
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN cost ELSE 0 END), 0) as this_month
        FROM ai_usage_logs
      `);

      const today = parseFloat(result[0]?.today || '0');
      const thisMonth = parseFloat(result[0]?.this_month || '0');

      // Get active customer count
      // Note: organizations table uses snake_case (deleted_at) not camelCase
      const customerCount = await this.dataSource.query(`
        SELECT COUNT(DISTINCT id) as count
        FROM organizations
        WHERE deleted_at IS NULL
          AND status = 'active'
      `);

      const activeCustomers = parseInt(customerCount[0]?.count || '1', 10);
      const avgPerClient = activeCustomers > 0 ? thisMonth / activeCustomers : 0;

      const target = 500.0;
      const status = avgPerClient <= target ? 'healthy' : 'critical';

      return {
        today: Number(today.toFixed(2)),
        thisMonth: Number(thisMonth.toFixed(2)),
        avgPerClient: Number(avgPerClient.toFixed(2)),
        target,
        status,
      };
    } catch (error) {
      // If table doesn't exist yet or query fails, return mock data
      return {
        today: 0,
        thisMonth: 0,
        avgPerClient: 0,
        target: 500.0,
        status: 'healthy',
      };
    }
  }

  /**
   * Calculate customer activity metrics
   * Active = organization with push views in last 7 days
   */
  async calculateCustomerActivity() {
    try {
      // Get total active organizations
      // Note: organizations table uses snake_case (deleted_at) not camelCase
      const totalResult = await this.dataSource.query(`
        SELECT COUNT(DISTINCT id) as count
        FROM organizations
        WHERE deleted_at IS NULL
          AND status = 'active'
      `);

      const totalCustomers = parseInt(totalResult[0]?.count || '0', 10);

      if (totalCustomers === 0) {
        return {
          totalCustomers: 0,
          activeCustomers: 0,
          activityRate: 0,
          target: 70.0,
          status: 'healthy',
        };
      }

      // Get active organizations (with read pushes in last 7 days)
      // Active customer = has at least one push marked as read in last 7 days
      // Note: Column names use camelCase (isRead, readAt) not snake_case
      // Note: radar_pushes table does not have deletedAt column (no soft delete)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activeResult = await this.dataSource.query(
        `
        SELECT COUNT(DISTINCT "organizationId") as count
        FROM radar_pushes
        WHERE "isRead" = true
          AND "readAt" >= $1
      `,
        [sevenDaysAgo],
      );

      const activeCustomers = parseInt(activeResult[0]?.count || '0', 10);
      const activityRate = (activeCustomers / totalCustomers) * 100;

      const target = 70.0;
      const status = activityRate >= target ? 'healthy' : 'warning';

      return {
        totalCustomers,
        activeCustomers,
        activityRate: Number(activityRate.toFixed(2)),
        target,
        status,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to calculate customer activity: ${error.message}`,
      );
    }
  }

  /**
   * Get trend data for a specific metric
   */
  async getTrendData(metric: string, range: string) {
    try {
      // Parse range (7d, 30d, 90d)
      const days = parseInt(range.replace('d', ''), 10);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Get logs for the metric
      const logs = await this.systemHealthLogRepo.findByMetricType(
        metric,
        startDate,
        endDate,
      );

      // Group by date and calculate daily average
      const dataByDate = new Map<string, number[]>();

      logs.forEach((log) => {
        const date = log.recordedAt.toISOString().split('T')[0];
        if (!dataByDate.has(date)) {
          dataByDate.set(date, []);
        }
        dataByDate.get(date).push(Number(log.metricValue));
      });

      // Calculate daily averages
      const data = Array.from(dataByDate.entries()).map(([date, values]) => ({
        date,
        value: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      }));

      // Sort by date
      data.sort((a, b) => a.date.localeCompare(b.date));

      return {
        metric,
        range,
        data,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get trend data: ${error.message}`,
      );
    }
  }
}
