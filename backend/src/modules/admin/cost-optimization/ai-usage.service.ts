import { Injectable } from '@nestjs/common';
import { AIUsageLogRepository } from '@/database/repositories/ai-usage-log.repository';
import { AIUsageTaskType } from '@/database/entities/ai-usage-log.entity';

/**
 * Qwen Pricing (2026)
 * Input: ¥0.008 / 1000 tokens
 * Output: ¥0.02 / 1000 tokens
 */
const QWEN_PRICING = {
  INPUT_TOKEN_PRICE: 0.008 / 1000, // ¥/token
  OUTPUT_TOKEN_PRICE: 0.02 / 1000, // ¥/token
};

/**
 * AI Usage Service
 *
 * Manages AI usage logging and cost calculation for cost optimization.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization
 */
@Injectable()
export class AIUsageService {
  constructor(private aiUsageLogRepository: AIUsageLogRepository) {}

  /**
   * Log AI usage
   *
   * Records AI API call with token usage and calculated cost.
   *
   * @param params - AI usage parameters
   */
  async logAIUsage(params: {
    organizationId: string;
    taskType: AIUsageTaskType;
    inputTokens: number;
    outputTokens: number;
    modelName?: string;
    requestId?: string;
  }): Promise<void> {
    const cost = this.calculateCost(params.inputTokens, params.outputTokens);

    const log = this.aiUsageLogRepository.create({
      organizationId: params.organizationId,
      taskType: params.taskType,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cost,
      modelName: params.modelName || 'qwen-max',
      requestId: params.requestId,
    });

    await this.aiUsageLogRepository.save(log);
  }

  /**
   * Calculate cost based on token usage
   *
   * Uses Qwen pricing model.
   *
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Cost in CNY, rounded to 2 decimal places
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = inputTokens * QWEN_PRICING.INPUT_TOKEN_PRICE;
    const outputCost = outputTokens * QWEN_PRICING.OUTPUT_TOKEN_PRICE;
    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get organization monthly cost
   *
   * Calculates total AI cost for an organization in the current month.
   *
   * @param organizationId - Organization ID
   * @returns Total cost in CNY
   */
  async getOrganizationMonthlyCost(organizationId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.aiUsageLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.cost)', 'totalCost')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne();

    return parseFloat(result?.totalCost || '0');
  }

  /**
   * Get cost breakdown by task type
   *
   * Returns cost distribution across different AI task types.
   *
   * @param organizationId - Organization ID
   * @returns Array of cost breakdown by task type with percentages
   */
  async getCostBreakdown(
    organizationId: string,
  ): Promise<Array<{ taskType: AIUsageTaskType; cost: number; percentage: number }>> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const results = await this.aiUsageLogRepository
      .createQueryBuilder('log')
      .select('log.taskType', 'taskType')
      .addSelect('SUM(log.cost)', 'cost')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startOfMonth', { startOfMonth })
      .groupBy('log.taskType')
      .getRawMany();

    const totalCost = results.reduce((sum, r) => sum + parseFloat(r.cost), 0);

    return results.map((r) => ({
      taskType: r.taskType,
      cost: parseFloat(r.cost),
      percentage: totalCost > 0 ? (parseFloat(r.cost) / totalCost) * 100 : 0,
    }));
  }

  /**
   * Get top cost organizations
   *
   * Returns organizations with highest AI costs in the current month.
   *
   * @param limit - Number of organizations to return (default: 10)
   * @returns Array of organizations with their costs
   */
  async getTopCostOrganizations(
    limit: number = 10,
  ): Promise<Array<{ organizationId: string; cost: number }>> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const results = await this.aiUsageLogRepository
      .createQueryBuilder('log')
      .select('log.organizationId', 'organizationId')
      .addSelect('SUM(log.cost)', 'cost')
      .where('log.createdAt >= :startOfMonth', { startOfMonth })
      .groupBy('log.organizationId')
      .orderBy('cost', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      organizationId: r.organizationId,
      cost: parseFloat(r.cost || '0'),
    }));
  }
}
