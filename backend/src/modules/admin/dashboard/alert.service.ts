import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AlertRepository } from '../../../database/repositories/alert.repository';
import { Alert } from '../../../database/entities/alert.entity';

/**
 * AlertService
 *
 * Service for managing system alerts.
 * Implements alert deduplication and filtering.
 *
 * @module backend/src/modules/admin/dashboard
 * @story 7-1
 */
@Injectable()
export class AlertService {
  constructor(private readonly alertRepo: AlertRepository) {}

  /**
   * Get alerts with filters
   */
  async getAlerts(filters: {
    status?: 'unresolved' | 'resolved' | 'ignored';
    severity?: 'high' | 'medium' | 'low';
    alertType?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      // Validate filters
      if (filters.status && !['unresolved', 'resolved', 'ignored'].includes(filters.status)) {
        throw new BadRequestException('Invalid status filter');
      }

      if (filters.severity && !['high', 'medium', 'low'].includes(filters.severity)) {
        throw new BadRequestException('Invalid severity filter');
      }

      const { data, total } = await this.alertRepo.findWithFilters(filters);

      // Get unresolved count
      const unresolvedCount = await this.alertRepo.countUnresolved();

      // Get severity breakdown
      const severityCounts = await this.alertRepo.countBySeverity();

      return {
        data,
        meta: {
          total,
          unresolved: unresolvedCount,
          severityCounts,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to get alerts: ${error.message}`,
      );
    }
  }

  /**
   * Create a new alert with deduplication
   * Prevents duplicate alerts within 1 hour
   */
  async createAlert(alertData: {
    alertType:
      | 'crawler_failure'
      | 'ai_cost_exceeded'
      | 'customer_churn_risk'
      | 'push_failure_high'
      | 'system_downtime';
    severity: 'high' | 'medium' | 'low';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<Alert> {
    try {
      // Check for duplicate alert in last hour
      const existing = await this.alertRepo.findRecentDuplicate(alertData.alertType, 1);

      if (existing) {
        // Return existing alert (deduplication)
        return existing;
      }

      // Create new alert
      return await this.alertRepo.create({
        ...alertData,
        status: 'unresolved',
        occurredAt: new Date(),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create alert: ${error.message}`,
      );
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    try {
      const alert = await this.alertRepo.findById(alertId);

      if (!alert) {
        throw new NotFoundException('Alert not found');
      }

      if (alert.status === 'resolved') {
        // Already resolved, return as-is
        return alert;
      }

      return await this.alertRepo.resolve(alertId, userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to resolve alert: ${error.message}`,
      );
    }
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId: string): Promise<Alert> {
    const alert = await this.alertRepo.findById(alertId);

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  /**
   * Get unresolved alert count
   */
  async getUnresolvedCount(): Promise<number> {
    return await this.alertRepo.countUnresolved();
  }
}
