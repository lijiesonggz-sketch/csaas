import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerInterventionRepository } from '../../../database/repositories/customer-intervention.repository';
import { Organization } from '../../../database/entities/organization.entity';
import { CustomerIntervention } from '../../../database/entities/customer-intervention.entity';

/**
 * CustomerInterventionService
 *
 * Service for managing customer interventions to prevent churn.
 * Tracks contact attempts, surveys, training, and configuration adjustments.
 *
 * @module backend/src/modules/admin/clients
 * @story 7-3
 */
@Injectable()
export class CustomerInterventionService {
  private readonly logger = new Logger(CustomerInterventionService.name);

  constructor(
    private readonly interventionRepo: CustomerInterventionRepository,
    @InjectRepository(Organization)
    private readonly organizationRawRepo: Repository<Organization>,
  ) {}

  /**
   * Create a new intervention record
   */
  async createIntervention(data: {
    organizationId: string;
    interventionType: 'contact' | 'survey' | 'training' | 'config_adjustment';
    result: 'contacted' | 'resolved' | 'churned' | 'pending';
    notes?: string;
    createdBy: string;
  }): Promise<CustomerIntervention> {
    // Verify organization exists
    const organization = await this.organizationRawRepo.findOne({
      where: { id: data.organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organization ${data.organizationId} not found`);
    }

    const intervention = await this.interventionRepo.create({
      organizationId: data.organizationId,
      interventionType: data.interventionType,
      result: data.result,
      notes: data.notes,
      createdBy: data.createdBy,
    });

    this.logger.log(
      `Created ${data.interventionType} intervention for organization ${data.organizationId}`,
    );

    return intervention;
  }

  /**
   * Get interventions for an organization
   */
  async getInterventions(organizationId: string): Promise<CustomerIntervention[]> {
    // Verify organization exists
    const organization = await this.organizationRawRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }

    return this.interventionRepo.findByOrganization(organizationId);
  }

  /**
   * Get intervention by ID
   */
  async getInterventionById(id: string): Promise<CustomerIntervention> {
    const intervention = await this.interventionRepo.findById(id);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${id} not found`);
    }
    return intervention;
  }

  /**
   * Update intervention result
   */
  async updateInterventionResult(
    id: string,
    result: 'contacted' | 'resolved' | 'churned' | 'pending',
    notes?: string,
  ): Promise<CustomerIntervention> {
    const intervention = await this.interventionRepo.updateResult(id, result, notes);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${id} not found`);
    }

    this.logger.log(`Updated intervention ${id} result to ${result}`);
    return intervention;
  }

  /**
   * Get intervention suggestions based on activity rate and risk factors
   */
  getInterventionSuggestions(
    activityRate: number,
    factors: string[],
  ): Array<{
    type: 'contact' | 'survey' | 'training' | 'config_adjustment';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const suggestions: Array<{
      type: 'contact' | 'survey' | 'training' | 'config_adjustment';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Always suggest contact for churn risk
    if (activityRate < 60) {
      suggestions.push({
        type: 'contact',
        title: '主动联系客户',
        description: '客户月活率低于60%，建议主动联系了解使用情况',
        priority: 'high',
      });
    }

    // Suggest based on risk factors
    if (factors.includes('推送内容不相关')) {
      suggestions.push({
        type: 'config_adjustment',
        title: '调整关注领域',
        description: '客户反馈推送内容不够相关，建议协助调整关注领域设置',
        priority: 'high',
      });
    }

    if (factors.includes('推送频率过高')) {
      suggestions.push({
        type: 'config_adjustment',
        title: '调整推送频率',
        description: '客户可能因推送过多而感到困扰，建议降低推送频率',
        priority: 'medium',
      });
    }

    if (factors.includes('功能不满足需求')) {
      suggestions.push({
        type: 'training',
        title: '提供功能培训',
        description: '客户可能不了解系统功能，建议安排产品培训',
        priority: 'medium',
      });
    }

    if (factors.includes('登录频率过低')) {
      suggestions.push({
        type: 'survey',
        title: '发送使用调研',
        description: '了解客户登录频率低的原因，收集改进建议',
        priority: 'medium',
      });
    }

    // General suggestions
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'contact',
        title: '定期客户回访',
        description: '保持与客户的定期沟通，了解使用情况和需求',
        priority: 'low',
      });
    }

    return suggestions;
  }

  /**
   * Get intervention statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    byResult: Record<string, number>;
  }> {
    return this.interventionRepo.getStatistics();
  }

  /**
   * Get intervention success rate for an organization
   */
  async getOrganizationSuccessRate(organizationId: string): Promise<{
    total: number;
    resolved: number;
    churned: number;
    successRate: number;
  }> {
    return this.interventionRepo.getSuccessRate(organizationId);
  }
}
