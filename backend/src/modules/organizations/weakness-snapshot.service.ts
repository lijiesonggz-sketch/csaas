import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WeaknessSnapshot } from '../../database/entities/weakness-snapshot.entity'
import { TasksGateway } from '../ai-tasks/gateways/tasks.gateway'

/**
 * Assessment result interface for weakness detection
 *
 * Expected structure from AI generation results (Matrix, Questionnaire, etc.)
 */
export interface AssessmentResult {
  categories: Array<{
    name: string // WeaknessCategory enum value
    level: number // Maturity level 1-5
    cluster_id?: string
    cluster_name?: string
  }>
}

/**
 * Weakness snapshot statistics
 */
export interface WeaknessStats {
  totalWeaknesses: number
  topCategories: Array<{ category: string; count: number }>
}

/**
 * WeaknessSnapshotService
 *
 * Service for automatically detecting, creating, and managing weakness snapshots.
 * Triggered by assessment completion via WebSocket events.
 *
 * AC 1.1 & 1.2 - Weakness detection and organization-level aggregation
 *
 * @module backend/src/modules/organizations
 */
@Injectable()
export class WeaknessSnapshotService {
  private readonly logger = new Logger(WeaknessSnapshotService.name)

  constructor(
    @InjectRepository(WeaknessSnapshot)
    private readonly snapshotRepository: Repository<WeaknessSnapshot>,
    private readonly tasksGateway: TasksGateway,
  ) {}

  /**
   * Create weakness snapshots from assessment results
   *
   * Automatically detects categories with maturity level < 3 and creates snapshots.
   * Aggregates with existing snapshots for organization-level view.
   * Emits WebSocket event to notify clients.
   *
   * @param organizationId - Organization ID
   * @param projectId - Project ID (optional, for project-level tracking)
   * @param assessmentResult - Assessment result with categories and levels
   * @returns Created or updated weakness snapshots
   */
  async createSnapshotFromAssessment(
    organizationId: string,
    projectId: string,
    assessmentResult: AssessmentResult,
  ): Promise<WeaknessSnapshot[]> {
    this.logger.log(`Creating weakness snapshots for org ${organizationId}, project ${projectId}`)

    if (!assessmentResult?.categories || !Array.isArray(assessmentResult.categories)) {
      throw new BadRequestException('Invalid assessment result format')
    }

    const createdSnapshots: WeaknessSnapshot[] = []

    // Filter categories with level < 3 (weaknesses)
    const weaknesses = assessmentResult.categories.filter((cat) => cat.level < 3)

    if (weaknesses.length === 0) {
      this.logger.log('No weaknesses detected (all levels >= 3)')
      return []
    }

    for (const weakness of weaknesses) {
      const { name: category, level } = weakness

      // Check if snapshot already exists for this org + category
      const existingSnapshot = await this.snapshotRepository.findOne({
        where: {
          organizationId,
          category: category as any,
        },
      })

      if (existingSnapshot) {
        // Aggregate: add project ID to existing snapshot
        const projectIds = existingSnapshot.projectIds || []
        if (projectId && !projectIds.includes(projectId)) {
          projectIds.push(projectId)
        }

        existingSnapshot.projectIds = projectIds
        existingSnapshot.level = Math.min(existingSnapshot.level, level) // Keep lowest level
        existingSnapshot.description = this.generateDescription(level)

        const updated = await this.snapshotRepository.save(existingSnapshot)
        createdSnapshots.push(updated)

        this.logger.log(`Updated weakness snapshot: ${category} for org ${organizationId}`)
      } else {
        // Create new snapshot
        const newSnapshot = this.snapshotRepository.create({
          organizationId,
          projectId,
          category: category as any,
          level,
          description: this.generateDescription(level),
          projectIds: projectId ? [projectId] : [],
        })

        const saved = await this.snapshotRepository.save(newSnapshot)
        createdSnapshots.push(saved)

        this.logger.log(
          `Created weakness snapshot: ${category} (level ${level}) for org ${organizationId}`,
        )
      }
    }

    // Emit WebSocket event
    if (createdSnapshots.length > 0) {
      this.emitWeaknessDetected(organizationId, createdSnapshots)
    }

    return createdSnapshots
  }

  /**
   * Get all weakness snapshots for an organization
   *
   * @param organizationId - Organization ID
   * @returns Array of weakness snapshots ordered by creation date (newest first)
   */
  async getWeaknessesByOrganization(organizationId: string): Promise<WeaknessSnapshot[]> {
    return this.snapshotRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * Get aggregated weakness statistics for an organization
   *
   * @param organizationId - Organization ID
   * @returns Weakness statistics including total count and top categories
   */
  async getWeaknessStats(organizationId: string): Promise<WeaknessStats> {
    // Count total weaknesses
    const totalWeaknesses = await this.snapshotRepository.count({
      where: { organizationId },
    })

    // Get top weakness categories
    const topCategories = await this.snapshotRepository
      .createQueryBuilder('snapshot')
      .select('snapshot.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('snapshot.organizationId = :organizationId', { organizationId })
      .groupBy('snapshot.category')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany()

    return {
      totalWeaknesses,
      topCategories: topCategories.map((row: any) => ({
        category: row.category,
        count: parseInt(row.count),
      })),
    }
  }

  /**
   * Delete a weakness snapshot
   *
   * @param snapshotId - Snapshot ID
   * @throws NotFoundException if snapshot not found
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.snapshotRepository.findOne({
      where: { id: snapshotId },
    })

    if (!snapshot) {
      throw new NotFoundException(`Weakness snapshot not found: ${snapshotId}`)
    }

    await this.snapshotRepository.remove(snapshot)
    this.logger.log(`Deleted weakness snapshot: ${snapshotId}`)
  }

  /**
   * Generate human-readable description for weakness level
   *
   * @param level - Maturity level (1-5)
   * @returns Description string
   */
  private generateDescription(level: number): string {
    const descriptions = {
      1: '成熟度等级 1，初始阶段，亟需改进',
      2: '成熟度等级 2，低于行业平均水平',
      3: '成熟度等级 3，达到行业平均水平',
      4: '成熟度等级 4，高于行业平均水平',
      5: '成熟度等级 5，行业领先水平',
    }

    return descriptions[level] || `成熟度等级 ${level}`
  }

  /**
   * Aggregate weaknesses by category, taking lowest level
   *
   * AC 1.4: 薄弱项聚合逻辑
   * - 按category分组
   * - 取最低level（边界情况：空数组返回空）
   * - 记录projectIds数组（去重）
   *
   * @param organizationId - Organization ID
   * @param projectId - Optional project ID filter
   * @returns Aggregated weaknesses with min level per category
   */
  async aggregateWeaknesses(
    organizationId: string,
    projectId?: string,
  ): Promise<
    Array<{ category: string; level: number; description: string; projectIds: string[] }>
  > {
    const query = this.snapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.organizationId = :organizationId', { organizationId })

    if (projectId) {
      query.andWhere('snapshot.projectId = :projectId', { projectId })
    }

    const weaknesses = await query.getMany()

    // Edge case: Empty array
    if (weaknesses.length === 0) {
      this.logger.log(`No weaknesses found for organization ${organizationId}`)
      return []
    }

    // Aggregate by category, taking the lowest level
    const aggregated = new Map<string, any>()

    weaknesses.forEach((weakness) => {
      const key = weakness.category
      const existing = aggregated.get(key)

      if (!existing || weakness.level < existing.level) {
        // New category or found lower level
        aggregated.set(key, {
          category: weakness.category,
          level: weakness.level,
          description: weakness.description,
          projectIds: weakness.projectIds || [weakness.projectId],
        })
      } else if (
        existing &&
        (!existing.projectIds || !existing.projectIds.includes(weakness.projectId))
      ) {
        // Same category, add project if not already present
        if (!existing.projectIds) {
          existing.projectIds = []
        }
        if (weakness.projectId && !existing.projectIds.includes(weakness.projectId)) {
          existing.projectIds.push(weakness.projectId)
        }
      }
    })

    const result = Array.from(aggregated.values())

    this.logger.log(
      `Aggregated ${weaknesses.length} weaknesses into ${result.length} categories for org ${organizationId}`,
    )

    return result
  }

  /**
   * Emit WebSocket event when weaknesses are detected
   *
   * @param organizationId - Organization ID
   * @param snapshots - Created/updated weakness snapshots
   */
  private emitWeaknessDetected(organizationId: string, snapshots: WeaknessSnapshot[]): void {
    try {
      this.tasksGateway.server.emit('weaknesses:updated', {
        organizationId,
        weaknesses: snapshots.map((s) => ({
          id: s.id,
          category: s.category,
          level: s.level,
          description: s.description,
          projectId: s.projectId,
        })),
        timestamp: new Date(),
      })

      this.logger.log(
        `Emitted weaknesses:updated event for org ${organizationId} with ${snapshots.length} weaknesses`,
      )
    } catch (error) {
      this.logger.error(`Failed to emit WebSocket event: ${error.message}`)
    }
  }
}
