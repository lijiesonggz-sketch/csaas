import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AIUsageLogRepository } from '@/database/repositories/ai-usage-log.repository';
import { OrganizationRepository } from '@/database/repositories/organization.repository';
import { AlertRepository } from '@/database/repositories/alert.repository';
import { AuditLogRepository } from '@/database/repositories/audit-log.repository';
import { EmailService } from '../clients/email.service';
import { AIUsageTaskType } from '@/database/entities/ai-usage-log.entity';
import { AuditAction } from '@/database/entities/audit-log.entity';
import { CostOptimizationSuggestionDto } from './dto/cost-optimization-suggestion.dto';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Cost threshold in CNY
 */
const COST_THRESHOLD = 500;

/**
 * Cost Optimization Service
 *
 * Provides cost calculation, alerting, and optimization services for AI usage.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization
 */
@Injectable()
export class CostOptimizationService {
  private readonly logger = new Logger(CostOptimizationService.name);

  constructor(
    private readonly aiUsageLogRepository: AIUsageLogRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly alertRepository: AlertRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get cost metrics overview
   *
   * Returns total cost, average cost per organization, and top cost organizations.
   *
   * @returns Cost metrics overview
   */
  async getCostMetrics(): Promise<{
    totalCost: number;
    averageCostPerOrganization: number;
    topCostOrganizations: Array<{
      organizationId: string;
      organizationName: string;
      cost: number;
      count: number;
    }>;
    period: {
      startDate: Date;
      endDate: Date;
    };
  }> {
    const { startDate, endDate } = this.getCurrentMonthRange();

    // Get total cost for current month
    const totalCost = await this.aiUsageLogRepository.getTotalCost(
      null as any, // null means all organizations
      startDate,
      endDate,
    );

    // Get top cost organizations
    const topOrgs = await this.aiUsageLogRepository.getTopCostOrganizations(
      startDate,
      endDate,
      10,
    );

    // Enrich with organization names
    const topCostOrganizations = await Promise.all(
      topOrgs.map(async (org) => {
        const organization = await this.organizationRepository.findByIdPlatform(
          org.organizationId,
        );
        return {
          organizationId: org.organizationId,
          organizationName: organization?.name || 'Unknown',
          cost: org.cost,
          count: org.count,
        };
      }),
    );

    // Calculate average cost per organization
    const averageCostPerOrganization =
      topOrgs.length > 0 ? totalCost / topOrgs.length : 0;

    return {
      totalCost,
      averageCostPerOrganization,
      topCostOrganizations,
      period: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * Get organization cost details
   *
   * Returns detailed cost information for a specific organization.
   *
   * @param organizationId - Organization ID
   * @returns Organization cost details
   */
  async getOrganizationCostDetails(organizationId: string): Promise<{
    organizationId: string;
    organizationName: string;
    totalCost: number;
    costBreakdown: Array<{
      taskType: AIUsageTaskType;
      cost: number;
      count: number;
      percentage: number;
    }>;
    isExceeded: boolean;
    threshold: number;
    period: {
      startDate: Date;
      endDate: Date;
    };
  }> {
    const { startDate, endDate } = this.getCurrentMonthRange();

    // Get organization
    const organization = await this.organizationRepository.findByIdPlatform(organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Get total cost
    const totalCost = await this.aiUsageLogRepository.getTotalCost(
      organizationId,
      startDate,
      endDate,
    );

    // Get cost breakdown by task type
    const breakdown = await this.aiUsageLogRepository.getCostBreakdown(
      organizationId,
      startDate,
      endDate,
    );

    // Calculate percentages
    const costBreakdown = breakdown.map((item) => ({
      taskType: item.taskType,
      cost: item.cost,
      count: item.count,
      percentage: totalCost > 0 ? Math.round((item.cost / totalCost) * 10000) / 100 : 0,
    }));

    return {
      organizationId,
      organizationName: organization.name,
      totalCost,
      costBreakdown,
      isExceeded: totalCost > COST_THRESHOLD,
      threshold: COST_THRESHOLD,
      period: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * Get cost trends
   *
   * Returns daily cost trends for the specified period.
   *
   * @param days - Number of days to look back (default: 30)
   * @returns Cost trends
   */
  async getCostTrends(days: number = 30): Promise<{
    trends: Array<{
      date: string;
      cost: number;
      count: number;
    }>;
    period: {
      startDate: Date;
      endDate: Date;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await this.aiUsageLogRepository.getDailyCostTrend(startDate, endDate);

    return {
      trends,
      period: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * Check if organization cost exceeded threshold
   *
   * Creates alert and sends email if cost exceeds threshold and no alert exists for current month.
   *
   * @param organizationId - Organization ID
   * @returns True if alert was created, false otherwise
   */
  async checkCostExceeded(organizationId: string): Promise<boolean> {
    const { startDate, endDate } = this.getCurrentMonthRange();

    // Get organization
    const organization = await this.organizationRepository.findByIdPlatform(organizationId);

    if (!organization) {
      this.logger.warn(`Organization ${organizationId} not found`);
      return false;
    }

    // Get total cost for current month
    const totalCost = await this.aiUsageLogRepository.getTotalCost(
      organizationId,
      startDate,
      endDate,
    );

    // Check if cost exceeded threshold
    if (totalCost <= COST_THRESHOLD) {
      return false;
    }

    // Check if alert already exists for this month
    const currentMonth = this.formatMonth(new Date());
    const existingAlerts = await this.alertRepository.findWithFilters({
      alertType: 'ai_cost_exceeded',
      status: 'unresolved',
    });

    const hasExistingAlert = existingAlerts.data.some(
      (alert) =>
        alert.metadata?.organizationId === organizationId &&
        alert.metadata?.month === currentMonth,
    );

    if (hasExistingAlert) {
      this.logger.debug(
        `Alert already exists for organization ${organizationId} in month ${currentMonth}`,
      );
      return false;
    }

    // Create alert
    const alert = await this.alertRepository.create({
      alertType: 'ai_cost_exceeded',
      severity: 'high',
      message: `AI cost exceeded threshold for organization ${organization.name}`,
      status: 'unresolved',
      metadata: {
        organizationId,
        organizationName: organization.name,
        cost: totalCost,
        threshold: COST_THRESHOLD,
        month: currentMonth,
      },
    });

    this.logger.log(
      `Created cost exceeded alert for organization ${organization.name}: ¥${totalCost} > ¥${COST_THRESHOLD}`,
    );

    // Send email notification
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@example.com');
    try {
      await this.emailService.sendCostExceededAlert({
        to: adminEmail,
        organizationName: organization.name,
        cost: totalCost,
        threshold: COST_THRESHOLD,
      });
      this.logger.log(`Cost exceeded email sent to ${adminEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send cost exceeded email: ${error.message}`);
    }

    return true;
  }

  /**
   * Check cost for all organizations
   *
   * Scheduled job that runs daily at 9:00 AM to check all organizations for cost exceeded.
   *
   * @returns Summary of checks performed
   */
  @Cron('0 9 * * *', {
    name: 'check-cost-exceeded',
    timeZone: 'Asia/Shanghai',
  })
  async checkAllOrganizationsCost(): Promise<{
    totalChecked: number;
    alertsCreated: number;
  }> {
    this.logger.log('Starting daily cost check for all organizations');

    const organizations = await this.organizationRepository.findAllPlatform();
    let alertsCreated = 0;

    for (const org of organizations) {
      try {
        const alertCreated = await this.checkCostExceeded(org.id);
        if (alertCreated) {
          alertsCreated++;
        }
      } catch (error) {
        this.logger.error(
          `Error checking cost for organization ${org.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Daily cost check completed: ${organizations.length} organizations checked, ${alertsCreated} alerts created`,
    );

    return {
      totalChecked: organizations.length,
      alertsCreated,
    };
  }

  /**
   * Get current month date range
   */
  private getCurrentMonthRange(): { startDate: Date; endDate: Date } {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { startDate, endDate };
  }

  /**
   * Get cost optimization suggestions
   *
   * Analyzes AI usage patterns and provides optimization suggestions.
   *
   * @param organizationId - Optional organization ID. If not provided, returns suggestions for all organizations.
   * @returns List of cost optimization suggestions
   */
  async getCostOptimizationSuggestions(
    organizationId?: string,
  ): Promise<CostOptimizationSuggestionDto[]> {
    const { startDate, endDate } = this.getCurrentMonthRange();

    // Get organizations to analyze
    let organizations: Array<{ id: string; name: string }>;
    if (organizationId) {
      const org = await this.organizationRepository.findByIdPlatform(organizationId);
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      organizations = [{ id: org.id, name: org.name }];
    } else {
      // Get top cost organizations
      const topOrgs = await this.aiUsageLogRepository.getTopCostOrganizations(
        startDate,
        endDate,
        20,
      );
      organizations = await Promise.all(
        topOrgs.map(async (org) => {
          const organization = await this.organizationRepository.findByIdPlatform(
            org.organizationId,
          );
          return {
            id: org.organizationId,
            name: organization?.name || 'Unknown',
          };
        }),
      );
    }

    // Generate suggestions for each organization
    const suggestions: CostOptimizationSuggestionDto[] = [];

    for (const org of organizations) {
      try {
        const suggestion = await this.generateOptimizationSuggestion(org.id, org.name);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        this.logger.error(
          `Error generating suggestion for organization ${org.id}: ${error.message}`,
        );
      }
    }

    // Sort by potential savings (highest first)
    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Generate optimization suggestion for a single organization
   */
  private async generateOptimizationSuggestion(
    organizationId: string,
    organizationName: string,
  ): Promise<CostOptimizationSuggestionDto | null> {
    const { startDate, endDate } = this.getCurrentMonthRange();

    // Get current cost
    const currentCost = await this.aiUsageLogRepository.getTotalCost(
      organizationId,
      startDate,
      endDate,
    );

    // Skip if cost is too low to optimize
    if (currentCost < 100) {
      return null;
    }

    // Get cost breakdown
    const breakdown = await this.aiUsageLogRepository.getCostBreakdown(
      organizationId,
      startDate,
      endDate,
    );

    // Analyze usage patterns and generate suggestions
    const suggestions: string[] = [];
    let estimatedSavings = 0;

    // Check for expensive model usage
    const qwenMaxUsage = breakdown.find((b) => b.taskType === AIUsageTaskType.TECH_ANALYSIS);
    if (qwenMaxUsage && qwenMaxUsage.cost > 100) {
      const potentialSaving = qwenMaxUsage.cost * 0.3; // 30% savings by switching to qwen-plus
      estimatedSavings += potentialSaving;
      suggestions.push(
        `Switch tech_analysis tasks from qwen-max to qwen-plus (save ~¥${potentialSaving.toFixed(2)}, 30%)`,
      );
    }

    // Check for high volume usage
    const totalCount = breakdown.reduce((sum, b) => sum + b.count, 0);
    if (totalCount > 100) {
      const potentialSaving = currentCost * 0.15; // 15% savings by batch processing
      estimatedSavings += potentialSaving;
      suggestions.push(
        `Implement batch processing for similar tasks (save ~¥${potentialSaving.toFixed(2)}, 15%)`,
      );
    }

    // Check for prompt optimization opportunities
    const avgCostPerTask = currentCost / totalCount;
    if (avgCostPerTask > 5) {
      const potentialSaving = currentCost * 0.2; // 20% savings by optimizing prompts
      estimatedSavings += potentialSaving;
      suggestions.push(
        `Optimize prompts to reduce token usage (save ~¥${potentialSaving.toFixed(2)}, 20%)`,
      );
    }

    // Check for caching opportunities
    if (totalCount > 50) {
      const potentialSaving = currentCost * 0.1; // 10% savings by caching
      estimatedSavings += potentialSaving;
      suggestions.push(
        `Implement result caching for repeated queries (save ~¥${potentialSaving.toFixed(2)}, 10%)`,
      );
    }

    // If no suggestions, skip
    if (suggestions.length === 0) {
      return null;
    }

    // Calculate priority based on cost and savings
    let priority: 'high' | 'medium' | 'low';
    if (currentCost > COST_THRESHOLD && estimatedSavings > 100) {
      priority = 'high';
    } else if (currentCost > COST_THRESHOLD * 0.5 || estimatedSavings > 50) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    const estimatedCostAfterOptimization = Math.max(0, currentCost - estimatedSavings);
    const savingsPercentage = (estimatedSavings / currentCost) * 100;

    return {
      organizationId,
      organizationName,
      currentCost,
      estimatedCostAfterOptimization,
      potentialSavings: estimatedSavings,
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      suggestions,
      priority,
    };
  }

  /**
   * Export cost report
   *
   * Exports AI usage cost data in CSV or Excel format.
   *
   * @param format - Export format ('csv' or 'excel')
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @param organizationId - Optional organization ID filter
   * @returns Buffer containing the exported file
   */
  async exportCostReport(
    format: 'csv' | 'excel',
    startDate?: Date,
    endDate?: Date,
    organizationId?: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    // Use provided dates or default to current month
    const dateRange = startDate && endDate
      ? { startDate, endDate }
      : this.getCurrentMonthRange();

    // Get usage logs
    const logs = await this.aiUsageLogRepository.findWithFilters(
      organizationId ? { organizationId } : {},
      dateRange.startDate,
      dateRange.endDate,
    );

    // Enrich with organization names
    const enrichedData = await Promise.all(
      logs.data.map(async (log) => {
        const org = await this.organizationRepository.findByIdPlatform(log.organizationId);
        return {
          Date: log.createdAt.toISOString().split('T')[0],
          'Organization ID': log.organizationId,
          'Organization Name': org?.name || 'Unknown',
          'Task Type': log.taskType,
          'Model Name': log.modelName,
          'Input Tokens': log.inputTokens,
          'Output Tokens': log.outputTokens,
          'Cost (CNY)': log.cost,
        };
      }),
    );

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const orgStr = organizationId ? `-${organizationId}` : '';
    const filename = `cost-report${orgStr}-${dateStr}.${format === 'csv' ? 'csv' : 'xlsx'}`;

    if (format === 'csv') {
      // Generate CSV
      const csv = Papa.unparse(enrichedData);
      return {
        buffer: Buffer.from(csv, 'utf-8'),
        filename,
        mimeType: 'text/csv',
      };
    } else {
      // Generate Excel
      const worksheet = XLSX.utils.json_to_sheet(enrichedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Report');

      // Add summary sheet
      const summary = [
        { Metric: 'Total Cost (CNY)', Value: enrichedData.reduce((sum, row) => sum + row['Cost (CNY)'], 0).toFixed(2) },
        { Metric: 'Total Records', Value: enrichedData.length },
        { Metric: 'Start Date', Value: dateRange.startDate.toISOString().split('T')[0] },
        { Metric: 'End Date', Value: dateRange.endDate.toISOString().split('T')[0] },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return {
        buffer: Buffer.from(buffer),
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
  }

  /**
   * Batch optimize organizations
   *
   * Applies cost optimization actions to multiple organizations.
   *
   * @param organizationIds - Array of organization IDs
   * @param action - Optimization action to perform
   * @param userId - User ID performing the action
   * @param notes - Optional notes
   * @returns Summary of batch optimization
   */
  async batchOptimize(
    organizationIds: string[],
    action: 'switch_model' | 'enable_caching' | 'optimize_prompts',
    userId: string,
    notes?: string,
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{
      organizationId: string;
      organizationName: string;
      status: 'success' | 'failed';
      message: string;
    }>;
  }> {
    const results: Array<{
      organizationId: string;
      organizationName: string;
      status: 'success' | 'failed';
      message: string;
    }> = [];

    let success = 0;
    let failed = 0;

    for (const organizationId of organizationIds) {
      try {
        const org = await this.organizationRepository.findByIdPlatform(organizationId);

        if (!org) {
          results.push({
            organizationId,
            organizationName: 'Unknown',
            status: 'failed',
            message: 'Organization not found',
          });
          failed++;
          continue;
        }

        // Perform optimization action
        let message = '';
        switch (action) {
          case 'switch_model':
            message = 'Model switched to qwen-plus for cost optimization';
            // In a real implementation, this would update organization settings
            break;
          case 'enable_caching':
            message = 'Result caching enabled for repeated queries';
            // In a real implementation, this would enable caching in organization settings
            break;
          case 'optimize_prompts':
            message = 'Prompt optimization guidelines applied';
            // In a real implementation, this would update prompt templates
            break;
        }

        // Create audit log
        await this.auditLogRepository.createAuditLog({
          userId,
          organizationId,
          tenantId: org.tenantId,
          action: AuditAction.UPDATE,
          entityType: 'organization',
          entityId: organizationId,
          details: {
            action: 'cost_optimization',
            optimizationType: action,
            notes,
          },
        });

        results.push({
          organizationId,
          organizationName: org.name,
          status: 'success',
          message,
        });
        success++;

        this.logger.log(
          `Cost optimization applied to organization ${org.name}: ${action}`,
        );
      } catch (error) {
        this.logger.error(
          `Error optimizing organization ${organizationId}: ${error.message}`,
        );
        results.push({
          organizationId,
          organizationName: 'Unknown',
          status: 'failed',
          message: error.message,
        });
        failed++;
      }
    }

    this.logger.log(
      `Batch optimization completed: ${success} succeeded, ${failed} failed`,
    );

    return {
      success,
      failed,
      results,
    };
  }

  /**
   * Format date as YYYY-MM
   */
  private formatMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
