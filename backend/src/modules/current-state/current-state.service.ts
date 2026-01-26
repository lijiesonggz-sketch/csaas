import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CurrentStateDescription } from '../../database/entities/current-state-description.entity'

/**
 * 创建现状描述DTO
 */
export interface CreateCurrentStateDto {
  projectId: string
  description: string
  source?: 'MANUAL_INPUT' | 'DOC_UPLOAD'
  metadata?: {
    word_count?: number
    extracted_keywords?: string[]
    [key: string]: any
  }
}

/**
 * 现状描述服务
 */
@Injectable()
export class CurrentStateService {
  private readonly logger = new Logger(CurrentStateService.name)

  constructor(
    @InjectRepository(CurrentStateDescription)
    private readonly currentStateRepository: Repository<CurrentStateDescription>,
  ) {}

  /**
   * 创建现状描述
   */
  async createCurrentState(dto: CreateCurrentStateDto): Promise<CurrentStateDescription> {
    this.logger.log(`Creating current state description for project: ${dto.projectId}`)

    const currentState = this.currentStateRepository.create({
      projectId: dto.projectId,
      description: dto.description,
      metadata: {
        source: dto.source || 'MANUAL_INPUT',
        word_count: dto.metadata?.word_count || dto.description.length,
        extracted_keywords: dto.metadata?.extracted_keywords,
        ...dto.metadata,
      },
    })

    const saved = await this.currentStateRepository.save(currentState)

    this.logger.log(`Current state description created with ID: ${saved.id}`)

    return saved
  }

  /**
   * 获取项目的现状描述
   */
  async getProjectCurrentStates(projectId: string): Promise<CurrentStateDescription[]> {
    return this.currentStateRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * 获取最新的现状描述
   */
  async getLatestCurrentState(projectId: string): Promise<CurrentStateDescription | null> {
    const states = await this.getProjectCurrentStates(projectId)
    return states.length > 0 ? states[0] : null
  }

  /**
   * 根据ID获取现状描述
   */
  async getCurrentStateById(id: string): Promise<CurrentStateDescription> {
    const currentState = await this.currentStateRepository.findOne({
      where: { id },
    })

    if (!currentState) {
      throw new NotFoundException(`Current state description with ID ${id} not found`)
    }

    return currentState
  }

  /**
   * 更新现状描述
   */
  async updateCurrentState(
    id: string,
    updates: Partial<Pick<CurrentStateDescription, 'description' | 'metadata'>>,
  ): Promise<CurrentStateDescription> {
    const currentState = await this.getCurrentStateById(id)

    Object.assign(currentState, updates)

    const updated = await this.currentStateRepository.save(currentState)

    this.logger.log(`Current state description updated: ${id}`)

    return updated
  }

  /**
   * 删除现状描述
   */
  async deleteCurrentState(id: string): Promise<void> {
    const currentState = await this.getCurrentStateById(id)

    await this.currentStateRepository.remove(currentState)

    this.logger.log(`Current state description deleted: ${id}`)
  }
}
