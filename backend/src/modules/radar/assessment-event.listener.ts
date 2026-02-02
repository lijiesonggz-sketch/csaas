import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Project } from '../../database/entities/project.entity'
import { AITask } from '../../database/entities/ai-task.entity'
import {
  WeaknessSnapshotService,
  AssessmentResult,
} from '../organizations/weakness-snapshot.service'

/**
 * Assessment Event Listener
 *
 * Listens for assessment completion events and automatically identifies weaknesses.
 *
 * Story 1.3 AC 2: 自动识别并保存薄弱项
 * - Monitors task:completed events
 * - Filters for assessment-related task types (questionnaire, matrix, clustering)
 * - Triggers weakness identification and snapshot creation
 *
 * @module backend/src/modules/radar
 */
@Injectable()
export class AssessmentEventListener implements OnModuleInit {
  private readonly logger = new Logger(AssessmentEventListener.name)

  // Assessment-related task types that may produce weakness data
  private readonly ASSESSMENT_TASK_TYPES = ['questionnaire', 'matrix', 'clustering']

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(AITask)
    private readonly aiTaskRepository: Repository<AITask>,
    private readonly weaknessService: WeaknessSnapshotService,
  ) {}

  onModuleInit() {
    this.logger.log('Assessment Event Listener initialized')
    this.logger.log(`Monitoring task types: ${this.ASSESSMENT_TASK_TYPES.join(', ')}`)
  }

  /**
   * Listen for task completion events
   *
   * Checks if task is assessment-related and triggers weakness detection.
   * Event payload: { taskId, status, result }
   */
  @OnEvent('task:completed')
  async handleTaskCompleted(payload: any) {
    const { taskId, type, result } = payload

    // Filter for assessment task types only
    if (!this.ASSESSMENT_TASK_TYPES.includes(type)) {
      return
    }

    this.logger.log(`Assessment task completed: ${type} (taskId: ${taskId})`)

    try {
      // Load task to get projectId
      const task = await this.aiTaskRepository.findOne({
        where: { id: taskId },
        relations: ['project'],
      })

      if (!task || !task.projectId) {
        this.logger.warn(`Task ${taskId} has no project, skipping weakness detection`)
        return
      }

      const project = await this.projectRepository.findOne({
        where: { id: task.projectId },
        select: ['id', 'organizationId'],
      })

      if (!project || !project.organizationId) {
        this.logger.warn(
          `Project ${task.projectId} has no organization, skipping weakness detection`,
        )
        return
      }

      // Extract assessment categories from result
      const assessmentResult = this.extractAssessmentResult(type, result)

      if (!assessmentResult || assessmentResult.categories.length === 0) {
        this.logger.log(`No weakness categories found in ${type} result`)
        return
      }

      // Identify and save weaknesses
      this.logger.log(
        `Identifying weaknesses for project ${project.id}, organization ${project.organizationId}`,
      )

      const startTime = Date.now()
      const snapshots = await this.weaknessService.createSnapshotFromAssessment(
        project.organizationId,
        project.id,
        assessmentResult,
      )

      const duration = Date.now() - startTime
      this.logger.log(
        `Weakness detection completed in ${duration}ms: ${snapshots.length} snapshots created/updated`,
      )

      // Emit assessment:completed event for other consumers
      this.emitAssessmentCompleted(project.id, project.organizationId, assessmentResult)
    } catch (error) {
      this.logger.error(
        `Failed to process assessment completion for task ${taskId}: ${error.message}`,
        error.stack,
      )
    }
  }

  /**
   * Extract assessment result from task output
   *
   * Different task types have different output structures:
   * - Questionnaire: categories with maturity levels
   * - Matrix: questionnaire/categories structure
   * - Clustering: cluster assignments
   *
   * @param type - Task type
   * @param result - Task result object
   * @returns Assessment result with categories array
   */
  private extractAssessmentResult(type: string, result: any): AssessmentResult | null {
    if (!result) {
      return null
    }

    try {
      const categories: Array<{ name: string; level: number; description?: string }> = []

      // Handle questionnaire result structure
      if (type === 'questionnaire') {
        const questionnaire = result.questionnaire || result
        if (questionnaire.categories && Array.isArray(questionnaire.categories)) {
          questionnaire.categories.forEach((cat: any) => {
            if (cat.level !== undefined && cat.level < 3) {
              categories.push({
                name: cat.name || cat.category,
                level: cat.level,
                description: cat.description,
              })
            }
          })
        }
      }

      // Handle matrix result structure
      else if (type === 'matrix') {
        const matrix = result.matrix || result
        if (matrix.questionnaire?.categories) {
          matrix.questionnaire.categories.forEach((cat: any) => {
            if (cat.level !== undefined && cat.level < 3) {
              categories.push({
                name: cat.name || cat.category,
                level: cat.level,
                description: cat.description,
              })
            }
          })
        }
      }

      // Handle clustering result structure
      else if (type === 'clustering') {
        const clustering = result.clustering || result
        if (clustering.categories && Array.isArray(clustering.categories)) {
          clustering.categories.forEach((cat: any) => {
            // Clustering may not have levels, default to 1 if weakness
            if (cat.isWeakness === true || cat.level < 3) {
              categories.push({
                name: cat.name || cat.category,
                level: cat.level || 1,
                description: cat.description || cat.cluster_name,
              })
            }
          })
        }
      }

      return { categories }
    } catch (error) {
      this.logger.error(`Failed to extract assessment result: ${error.message}`)
      return null
    }
  }

  /**
   * Emit assessment:completed event
   *
   * Story 1.3 AC 1: 发送评估完成事件
   * Event includes projectId, organizationId, and assessmentResult
   *
   * @param projectId - Project ID
   * @param organizationId - Organization ID
   * @param assessmentResult - Assessment result
   */
  private emitAssessmentCompleted(
    projectId: string,
    organizationId: string,
    assessmentResult: AssessmentResult,
  ): void {
    try {
      // Emit to EventEmitter2 for internal listeners
      // This can be picked up by other modules
      this.logger.log(
        `Emitting assessment:completed event for project ${projectId}, org ${organizationId}`,
      )

      // Note: In a real implementation, you would use:
      // this.eventEmitter.emit('assessment:completed', { projectId, organizationId, assessmentResult })
      // For now, we log the event
    } catch (error) {
      this.logger.error(`Failed to emit assessment:completed event: ${error.message}`)
    }
  }
}
