import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerActivityLogRepository } from '../../../database/repositories/customer-activity-log.repository';
import { OrganizationRepository } from '../../../database/repositories/organization.repository';
import { AlertService } from '../dashboard/alert.service';
import { EmailService } from './email.service';
import { PushFeedbackRepository } from '../../../database/repositories/push-feedback.repository';
import { RadarPushRepository } from '../../../database/repositories/radar-push.repository';
import { CustomerInterventionRepository } from '../../../database/repositories/customer-intervention.repository';
import { Organization } from '../../../database/entities/organization.entity';

/**
 * UUID validation regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * CustomerActivityService
 *
 * Service for tracking customer activity and calculating monthly active users (MAU).
 * Implements churn risk detection and alerting.
 *
 * @module backend/src/modules/admin/clients
 * @story 7-3
 */
/**
 * Validate UUID format
 * @param id - The ID to validate
 * @param fieldName - The name of the field for error messages
 * @throws BadRequestException if ID is invalid
 */
function validateUUID(id: string, fieldName: string): void {
  if (!id || typeof id !== 'string') {
    throw new BadRequestException(`${fieldName} is required`);
  }
  if (!UUID_REGEX.test(id)) {
    throw new BadRequestException(`${fieldName} must be a valid UUID`);
  }
}

@Injectable()
export class CustomerActivityService {
  private readonly logger = new Logger(CustomerActivityService.name);

  constructor(
    private readonly activityLogRepo: CustomerActivityLogRepository,
    private readonly organizationRepo: OrganizationRepository,
    private readonly alertService: AlertService,
    private readonly emailService: EmailService,
    private readonly pushFeedbackRepo: PushFeedbackRepository,
    private readonly radarPushRepo: RadarPushRepository,
    private readonly interventionRepo: CustomerInterventionRepository,
    @InjectRepository(Organization)
    private readonly organizationRawRepo: Repository<Organization>,
  ) {}

  /**
   * Record a customer activity
   * Uses upsert pattern for daily aggregation
   */
  async recordActivity(
    organizationId: string,
    activityType: 'login' | 'push_view' | 'feedback_submit' | 'settings_update',
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Validate organizationId
    validateUUID(organizationId, 'organizationId');

    try {
      const today = new Date().toISOString().split('T')[0];

      // Upsert activity log for today
      await this.activityLogRepo.upsertActivity(
        organizationId,
        activityType,
        today,
        metadata,
      );

      // Update organization's lastActiveAt using raw repository
      await this.organizationRawRepo.update(organizationId, {
        lastActiveAt: new Date(),
      });

      this.logger.debug(
        `Recorded ${activityType} activity for organization ${organizationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record activity for organization ${organizationId}`,
        error.stack,
      );
      // Don't throw - activity tracking should not block user actions
    }
  }

  /**
   * Calculate monthly activity rate for an organization
   */
  async calculateMonthlyActivityRate(organizationId: string): Promise<{
    monthlyRate: number;
    loginRate: number;
    contentRate: number;
    actionRate: number;
    status: string;
  }> {
    // Validate organizationId
    validateUUID(organizationId, 'organizationId');

    const summary = await this.activityLogRepo.getActivitySummary(organizationId, 30);

    const monthlyRate = (summary.totalActiveDays / 30) * 100;
    const loginRate = (summary.loginDays / 30) * 100;
    const contentRate = (summary.pushViewDays / 30) * 100;
    const actionRate = (summary.feedbackDays / 30) * 100;

    let status: 'high_active' | 'medium_active' | 'low_active' | 'churn_risk' = 'high_active';
    if (monthlyRate < 60) {
      status = 'churn_risk';
    } else if (monthlyRate < 70) {
      status = 'low_active';
    } else if (monthlyRate < 85) {
      status = 'medium_active';
    }

    // Update organization status using raw repository
    await this.organizationRawRepo.update(organizationId, {
      monthlyActivityRate: Math.round(monthlyRate * 100) / 100,
      activityStatus: status,
    });

    // Trigger alert if churn risk
    if (status === 'churn_risk') {
      await this.triggerChurnRiskAlert(organizationId, monthlyRate);
    }

    return {
      monthlyRate: Math.round(monthlyRate * 100) / 100,
      loginRate: Math.round(loginRate * 100) / 100,
      contentRate: Math.round(contentRate * 100) / 100,
      actionRate: Math.round(actionRate * 100) / 100,
      status,
    };
  }

  /**
   * Trigger churn risk alert and send email notification
   */
  private async triggerChurnRiskAlert(
    organizationId: string,
    activityRate: number,
  ): Promise<void> {
    try {
      const organization = await this.organizationRawRepo.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        this.logger.warn(`Organization ${organizationId} not found for churn alert`);
        return;
      }

      // Create alert using AlertService from Story 7.1
      await this.alertService.createAlert({
        alertType: 'customer_churn_risk',
        severity: 'high',
        message: `客户 ${organization.name} 月活率 ${activityRate.toFixed(1)}%，低于 60% 阈值`,
        metadata: {
          organizationId,
          organizationName: organization.name,
          activityRate,
          contactEmail: organization.contactEmail,
        },
      });

      // Send email notification if contact email exists
      if (organization.contactEmail) {
        await this.emailService.sendChurnRiskAlert({
          to: organization.contactEmail,
          organizationName: organization.name,
          activityRate,
        });
      }

      this.logger.log(
        `Churn risk alert triggered for ${organization.name} (${activityRate.toFixed(1)}%)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to trigger churn risk alert for ${organizationId}`,
        error.stack,
      );
    }
  }

  /**
   * Get churn risk factors for an organization
   */
  async getChurnRiskFactors(organizationId: string): Promise<string[]> {
    // Validate organizationId
    validateUUID(organizationId, 'organizationId');

    const factors: string[] = [];

    try {
      // Check push relevance (low feedback scores)
      const feedbackScores = await this.getRecentFeedbackScores(organizationId);
      if (feedbackScores.length > 0) {
        const avgScore =
          feedbackScores.reduce((a, b) => a + b, 0) / feedbackScores.length;
        if (avgScore < 3.0) {
          factors.push('推送内容不相关');
        }
      }

      // Check push frequency (too many unread pushes)
      const unreadPushes = await this.getUnreadPushCount(organizationId);
      if (unreadPushes > 20) {
        factors.push('推送频率过高');
      }

      // Check feature usage (no settings updates)
      const recentSettingsUpdates = await this.activityLogRepo.getRecentActivityCount(
        organizationId,
        'settings_update',
        30,
      );
      if (recentSettingsUpdates === 0) {
        factors.push('功能不满足需求');
      }

      // Check login activity
      const summary = await this.activityLogRepo.getActivitySummary(organizationId, 30);
      if (summary.loginDays < 5) {
        factors.push('登录频率过低');
      }

      return factors;
    } catch (error) {
      this.logger.error(
        `Failed to get churn risk factors for ${organizationId}`,
        error.stack,
      );
      return factors;
    }
  }

  /**
   * Get recent feedback scores for an organization
   */
  private async getRecentFeedbackScores(organizationId: string): Promise<number[]> {
    const feedbacks = await this.pushFeedbackRepo.findRecentByOrganization(
      organizationId,
      30,
    );

    return feedbacks
      .filter((f) => f.rating !== null && f.rating !== undefined)
      .map((f) => f.rating!);
  }

  /**
   * Get count of unread pushes for an organization
   * Optimized: Single query instead of N+1 loop
   */
  private async getUnreadPushCount(organizationId: string): Promise<number> {
    // Get push count and view activity count in parallel
    const [pushes, viewActivityCount] = await Promise.all([
      this.radarPushRepo.findRecentByOrganization(organizationId, 30),
      this.activityLogRepo.getRecentActivityCount(organizationId, 'push_view', 30),
    ]);

    // If no view activity at all and there are pushes, all are unread
    if (viewActivityCount === 0) {
      return pushes.length;
    }

    // Otherwise, estimate unread based on view activity ratio
    // This is a heuristic: if view activity is low relative to pushes, many are unread
    const totalPushes = pushes.length;
    const estimatedUnread = Math.max(0, totalPushes - viewActivityCount);

    return estimatedUnread;
  }

  /**
   * Get client activity list with filters
   * Optimized to reduce N+1 queries by batching operations
   */
  async getClientActivityList(filters: {
    status?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    meta: {
      total: number;
      highActive: number;
      mediumActive: number;
      lowActive: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    // Validate and set pagination defaults
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));

    // Get all organizations with their activity data using raw repository
    const organizations = await this.organizationRawRepo.find({
      select: [
        'id',
        'name',
        'contactEmail',
        'contactPerson',
        'monthlyActivityRate',
        'activityStatus',
        'lastActiveAt',
        'tenantId',
      ],
    });

    // Filter by status if provided
    let filtered = organizations;
    if (filters.status) {
      // Validate status value to prevent injection
      const validStatuses = ['high_active', 'medium_active', 'low_active', 'churn_risk'];
      if (validStatuses.includes(filters.status)) {
        filtered = organizations.filter((o) => o.activityStatus === filters.status);
      }
    }

    // Sort by the specified field
    const sortField = filters.sort || 'monthlyActivityRate';
    const order = filters.order || 'desc';

    // Validate sort field to prevent injection
    const validSortFields = ['monthlyActivityRate', 'name', 'lastActiveAt'];
    const safeSortField = validSortFields.includes(sortField) ? sortField : 'monthlyActivityRate';

    filtered.sort((a, b) => {
      const aVal = (a as any)[safeSortField] || 0;
      const bVal = (b as any)[safeSortField] || 0;
      return order === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });

    // Calculate statistics
    const highActive = organizations.filter((o) =>
      (o.monthlyActivityRate || 0) >= 85,
    ).length;
    const mediumActive = organizations.filter((o) => {
      const rate = o.monthlyActivityRate || 0;
      return rate >= 60 && rate < 85;
    }).length;
    const lowActive = organizations.filter((o) => {
      const rate = o.monthlyActivityRate || 0;
      return rate >= 0 && rate < 60;
    }).length;

    // Apply pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Batch fetch activity summaries for all organizations in parallel
    const activitySummaries = await Promise.all(
      paginated.map((org) =>
        this.activityLogRepo.getActivitySummary(org.id, 30).catch(() => ({
          loginDays: 0,
          pushViewDays: 0,
          feedbackDays: 0,
          settingsDays: 0,
          totalActiveDays: 0,
        })),
      ),
    );

    // Batch fetch churn risk factors only for churn_risk organizations
    const churnRiskOrgIds = paginated
      .filter((org) => org.activityStatus === 'churn_risk')
      .map((org) => org.id);

    const churnRiskFactorsMap = new Map<string, string[]>();
    if (churnRiskOrgIds.length > 0) {
      const factorsResults = await Promise.all(
        churnRiskOrgIds.map(async (orgId) => ({
          orgId,
          factors: await this.getChurnRiskFactors(orgId).catch(() => []),
        })),
      );
      factorsResults.forEach(({ orgId, factors }) => {
        churnRiskFactorsMap.set(orgId, factors);
      });
    }

    // Build response data
    const data = paginated.map((org, index) => {
      const summary = activitySummaries[index];
      const factors = churnRiskFactorsMap.get(org.id) || [];

      return {
        organizationId: org.id,
        name: org.name,
        contactEmail: org.contactEmail,
        contactPerson: org.contactPerson,
        monthlyActivityRate: org.monthlyActivityRate || 0,
        activityStatus: org.activityStatus || 'unknown',
        lastActiveAt: org.lastActiveAt,
        activeDaysLast30: summary.totalActiveDays,
        loginActivityRate: Math.round((summary.loginDays / 30) * 1000) / 10,
        contentActivityRate: Math.round((summary.pushViewDays / 30) * 1000) / 10,
        actionActivityRate: Math.round((summary.feedbackDays / 30) * 1000) / 10,
        churnRiskFactors: factors,
      };
    });

    return {
      data,
      meta: {
        total: organizations.length,
        highActive,
        mediumActive,
        lowActive,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get client activity details
   */
  async getClientActivityDetails(organizationId: string): Promise<{
    organizationId: string;
    monthlyActivityRate: number;
    activityTrend: Array<{ date: string; rate: number }>;
    activityBreakdown: {
      loginDays: number;
      pushViewDays: number;
      feedbackDays: number;
    };
    interventionHistory: any[];
  }> {
    // Validate organizationId
    validateUUID(organizationId, 'organizationId');

    // Calculate current rate
    const rateData = await this.calculateMonthlyActivityRate(organizationId);

    // Get activity trend
    const trend = await this.activityLogRepo.getActivityTrend(organizationId, 30);

    // Get activity breakdown
    const summary = await this.activityLogRepo.getActivitySummary(organizationId, 30);

    // Get intervention history
    const interventions = await this.interventionRepo.findByOrganization(organizationId);
    const interventionHistory = interventions.map((i) => ({
      id: i.id,
      interventionType: i.interventionType,
      result: i.result,
      notes: i.notes,
      createdAt: i.createdAt,
      createdBy: i.createdBy,
    }));

    return {
      organizationId,
      monthlyActivityRate: rateData.monthlyRate,
      activityTrend: trend,
      activityBreakdown: {
        loginDays: summary.loginDays,
        pushViewDays: summary.pushViewDays,
        feedbackDays: summary.feedbackDays,
      },
      interventionHistory,
    };
  }

  /**
   * Get client segmentation statistics
   */
  async getClientSegmentation(): Promise<{
    segments: Array<{
      name: string;
      label: string;
      range: string;
      count: number;
      percentage: number;
      targetPercentage?: number;
      status?: string;
    }>;
    totalCustomers: number;
    averageActivityRate: number;
  }> {
    const organizations = await this.organizationRawRepo.find({
      select: ['id', 'monthlyActivityRate', 'activityStatus'],
    });

    const total = organizations.length;
    if (total === 0) {
      return {
        segments: [
          {
            name: 'high_active',
            label: '高活跃',
            range: '>85%',
            count: 0,
            percentage: 0,
            targetPercentage: 70,
            status: 'below_target',
          },
          {
            name: 'medium_active',
            label: '中活跃',
            range: '60-85%',
            count: 0,
            percentage: 0,
          },
          {
            name: 'low_active',
            label: '低活跃',
            range: '<60%',
            count: 0,
            percentage: 0,
            status: 'at_risk',
          },
        ],
        totalCustomers: 0,
        averageActivityRate: 0,
      };
    }

    const highActive = organizations.filter(
      (o) => (o.monthlyActivityRate || 0) >= 85,
    ).length;
    const mediumActive = organizations.filter((o) => {
      const rate = o.monthlyActivityRate || 0;
      return rate >= 60 && rate <= 85;
    }).length;
    const lowActive = organizations.filter(
      (o) => (o.monthlyActivityRate || 0) < 60,
    ).length;

    const avgRate =
      organizations.reduce((sum, o) => sum + (o.monthlyActivityRate || 0), 0) /
      total;

    const highActivePercentage = Math.round((highActive / total) * 1000) / 10;

    return {
      segments: [
        {
          name: 'high_active',
          label: '高活跃',
          range: '>85%',
          count: highActive,
          percentage: highActivePercentage,
          targetPercentage: 70,
          status: highActivePercentage >= 70 ? 'meeting_target' : 'below_target',
        },
        {
          name: 'medium_active',
          label: '中活跃',
          range: '60-85%',
          count: mediumActive,
          percentage: Math.round((mediumActive / total) * 1000) / 10,
        },
        {
          name: 'low_active',
          label: '低活跃',
          range: '<60%',
          count: lowActive,
          percentage: Math.round((lowActive / total) * 1000) / 10,
          status: 'at_risk',
        },
      ],
      totalCustomers: total,
      averageActivityRate: Math.round(avgRate * 100) / 100,
    };
  }

  /**
   * Batch update activity rates for all organizations
   * Should be called by a scheduled job
   */
  async batchUpdateActivityRates(): Promise<{
    updated: number;
    churnRisks: number;
  }> {
    const organizations = await this.organizationRawRepo.find({
      select: ['id'],
    });

    let updated = 0;
    let churnRisks = 0;

    for (const org of organizations) {
      try {
        const result = await this.calculateMonthlyActivityRate(org.id);
        updated++;
        if (result.status === 'churn_risk') {
          churnRisks++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to update activity rate for ${org.id}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `Batch updated ${updated} organizations, ${churnRisks} churn risks detected`,
    );

    return { updated, churnRisks };
  }
}
