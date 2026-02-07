import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SystemHealthLogRepository } from '../../../database/repositories/system-health-log.repository';
import { AlertService } from './alert.service';
import { DashboardService } from './dashboard.service';

/**
 * HealthMonitorService
 *
 * Service for monitoring system health with cron jobs.
 * Records heartbeats every minute and monitors health metrics every 5 minutes.
 *
 * @module backend/src/modules/admin/dashboard
 * @story 7-1
 */
@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);

  constructor(
    private readonly systemHealthLogRepo: SystemHealthLogRepository,
    private readonly alertService: AlertService,
    private readonly dashboardService: DashboardService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Record system heartbeat every 1 minute
   * Detects downtime when response > 10s or 5xx error
   */
  @Cron('* * * * *') // Every 1 minute
  async recordHeartbeat() {
    try {
      const start = Date.now();
      const healthEndpoint = process.env.HEALTH_CHECK_URL || 'http://localhost:3000/health';

      try {
        // Make health check request with 15s timeout
        const response = await firstValueFrom(
          this.httpService.get(healthEndpoint, {
            timeout: 15000,
          }),
        );

        const responseTime = Date.now() - start;

        if (responseTime > 10000) {
          // Downtime: response > 10s
          await this.systemHealthLogRepo.create({
            metricType: 'availability',
            metricValue: 0,
            targetValue: 99.5,
            status: 'critical',
            metadata: {
              downtime: true,
              responseTime,
              reason: 'slow_response',
            },
          });

          // Create alert for slow response
          await this.alertService.createAlert({
            alertType: 'system_downtime',
            severity: 'high',
            message: `System response time exceeded 10 seconds (${responseTime}ms)`,
            metadata: { responseTime },
          });

          this.logger.warn(`Slow response detected: ${responseTime}ms`);
        } else {
          // Uptime: normal response
          await this.systemHealthLogRepo.create({
            metricType: 'availability',
            metricValue: 1,
            targetValue: 99.5,
            status: 'healthy',
            metadata: {
              uptime: true,
              responseTime,
            },
          });
        }
      } catch (error) {
        // 5xx error or connection timeout = downtime
        const responseTime = Date.now() - start;

        await this.systemHealthLogRepo.create({
          metricType: 'availability',
          metricValue: 0,
          targetValue: 99.5,
          status: 'critical',
          metadata: {
            downtime: true,
            error: error.message,
            responseTime,
          },
        });

        // Create alert for downtime
        await this.alertService.createAlert({
          alertType: 'system_downtime',
          severity: 'high',
          message: `System health check failed: ${error.message}`,
          metadata: { error: error.message, responseTime },
        });

        this.logger.error(`Health check failed: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to record heartbeat: ${error.message}`);
    }
  }

  /**
   * Monitor health metrics every 5 minutes
   * Records metrics and checks for alerts
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async monitorHealth() {
    try {
      this.logger.log('Running health monitoring...');

      // Calculate and record availability
      const availability = await this.dashboardService.calculateAvailability();
      await this.recordHealthMetric('availability', availability.current, availability.target);

      // Check availability alert
      if (availability.current < availability.target) {
        await this.alertService.createAlert({
          alertType: 'system_downtime',
          severity: 'high',
          message: `System availability (${availability.current}%) is below target (${availability.target}%)`,
          metadata: { availability },
        });
      }

      // Calculate and record push success rate
      const pushSuccessRate = await this.dashboardService.calculatePushSuccessRate();
      await this.recordHealthMetric(
        'push_success_rate',
        pushSuccessRate.current,
        pushSuccessRate.target,
      );

      // Check push success rate alert
      if (pushSuccessRate.current < pushSuccessRate.target) {
        await this.alertService.createAlert({
          alertType: 'push_failure_high',
          severity: 'high',
          message: `Push success rate (${pushSuccessRate.current}%) is below target (${pushSuccessRate.target}%)`,
          metadata: { pushSuccessRate },
        });
      }

      // Calculate and record AI cost
      const aiCost = await this.dashboardService.calculateAICost();
      await this.recordHealthMetric('ai_cost', aiCost.avgPerClient, aiCost.target);

      // Check AI cost alert
      if (aiCost.avgPerClient > aiCost.target) {
        await this.alertService.createAlert({
          alertType: 'ai_cost_exceeded',
          severity: 'medium',
          message: `AI cost per client (${aiCost.avgPerClient}元) exceeded target (${aiCost.target}元)`,
          metadata: { aiCost },
        });
      }

      // Calculate and record customer activity
      const customerActivity = await this.dashboardService.calculateCustomerActivity();
      await this.recordHealthMetric(
        'customer_activity',
        customerActivity.activityRate,
        customerActivity.target,
      );

      // Check customer activity alert
      if (customerActivity.activityRate < 60) {
        await this.alertService.createAlert({
          alertType: 'customer_churn_risk',
          severity: 'medium',
          message: `Customer activity rate (${customerActivity.activityRate}%) is below 60% - churn risk detected`,
          metadata: { customerActivity },
        });
      }

      this.logger.log('Health monitoring completed successfully');
    } catch (error) {
      this.logger.error(`Failed to monitor health: ${error.message}`);
    }
  }

  /**
   * Record a health metric
   */
  async recordHealthMetric(
    metricType: 'availability' | 'push_success_rate' | 'ai_cost' | 'customer_activity',
    value: number,
    target: number,
  ) {
    try {
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Determine status based on metric type
      if (metricType === 'availability' || metricType === 'push_success_rate') {
        // Higher is better
        if (value < target) {
          status = 'critical';
        } else if (value < target + 1) {
          status = 'warning';
        }
      } else if (metricType === 'ai_cost') {
        // Lower is better
        if (value > target) {
          status = 'critical';
        } else if (value > target * 0.9) {
          status = 'warning';
        }
      } else if (metricType === 'customer_activity') {
        // Higher is better
        if (value < 60) {
          status = 'critical';
        } else if (value < target) {
          status = 'warning';
        }
      }

      await this.systemHealthLogRepo.create({
        metricType,
        metricValue: value,
        targetValue: target,
        status,
        metadata: {
          recordedBy: 'health_monitor_cron',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record health metric: ${error.message}`);
    }
  }

  /**
   * Get trend data for a metric
   */
  async getTrendData(metric: string, range: string) {
    return await this.dashboardService.getTrendData(metric, range);
  }
}
