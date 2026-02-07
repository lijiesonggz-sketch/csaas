import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerIntervention } from '../entities/customer-intervention.entity';

/**
 * CustomerInterventionRepository
 *
 * Repository for customer interventions.
 * Tracks admin actions taken to prevent customer churn.
 *
 * @module backend/src/database/repositories
 * @story 7-3
 */
@Injectable()
export class CustomerInterventionRepository {
  constructor(
    @InjectRepository(CustomerIntervention)
    private readonly repository: Repository<CustomerIntervention>,
  ) {}

  /**
   * Create a new intervention record
   */
  async create(data: Partial<CustomerIntervention>): Promise<CustomerIntervention> {
    const intervention = this.repository.create(data);
    return this.repository.save(intervention);
  }

  /**
   * Find intervention by ID
   */
  async findById(id: string): Promise<CustomerIntervention | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['organization'],
    });
  }

  /**
   * Get all interventions for an organization
   */
  async findByOrganization(organizationId: string): Promise<CustomerIntervention[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get recent interventions across all organizations
   */
  async findRecent(limit: number = 50): Promise<CustomerIntervention[]> {
    return this.repository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['organization'],
    });
  }

  /**
   * Get intervention statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    byResult: Record<string, number>;
  }> {
    const [total, byTypeRaw, byResultRaw] = await Promise.all([
      this.repository.count(),
      this.repository
        .createQueryBuilder('i')
        .select('i.interventionType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('i.interventionType')
        .getRawMany(),
      this.repository
        .createQueryBuilder('i')
        .select('i.result', 'result')
        .addSelect('COUNT(*)', 'count')
        .groupBy('i.result')
        .getRawMany(),
    ]);

    const byType: Record<string, number> = {};
    byTypeRaw.forEach((item) => {
      byType[item.type] = parseInt(item.count, 10);
    });

    const byResult: Record<string, number> = {};
    byResultRaw.forEach((item) => {
      byResult[item.result] = parseInt(item.count, 10);
    });

    return { total, byType, byResult };
  }

  /**
   * Get intervention success rate for an organization
   */
  async getSuccessRate(organizationId: string): Promise<{
    total: number;
    resolved: number;
    churned: number;
    successRate: number;
  }> {
    const interventions = await this.findByOrganization(organizationId);

    const total = interventions.length;
    const resolved = interventions.filter((i) => i.result === 'resolved').length;
    const churned = interventions.filter((i) => i.result === 'churned').length;
    const successRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { total, resolved, churned, successRate };
  }

  /**
   * Update intervention result
   */
  async updateResult(
    id: string,
    result: 'contacted' | 'resolved' | 'churned' | 'pending',
    notes?: string,
  ): Promise<CustomerIntervention | null> {
    const intervention = await this.findById(id);
    if (!intervention) return null;

    intervention.result = result;
    if (notes) {
      intervention.notes = notes;
    }

    return this.repository.save(intervention);
  }
}
