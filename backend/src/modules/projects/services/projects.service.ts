import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Project, ProjectStatus, ProjectMember, ProjectMemberRole, AITask, AITaskType, TaskStatus } from '@/database/entities'
import { CreateProjectDto } from '../dto/create-project.dto'
import { UpdateProjectDto } from '../dto/update-project.dto'

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name)

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
    @InjectRepository(AITask)
    private readonly aiTaskRepo: Repository<AITask>,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepo.create({
      name: dto.name,
      description: dto.description,
      clientName: dto.clientName,
      standardName: dto.standardName,
      ownerId: userId,
      status: ProjectStatus.DRAFT,
      metadata: {},
    })

    await this.projectRepo.save(project)

    // 创建者自动成为OWNER
    const member = this.projectMemberRepo.create({
      projectId: project.id,
      userId: userId,
      role: ProjectMemberRole.OWNER,
      addedAt: new Date(),
      addedBy: userId,
    })
    await this.projectMemberRepo.save(member)

    this.logger.log(`Created project ${project.id} for user ${userId}`)

    return project
  }

  async findAll(userId: string): Promise<Project[]> {
    // 简化权限检查：返回用户拥有的所有项目
    const projects = await this.projectRepo
      .createQueryBuilder('project')
      .where('project.owner_id = :userId', { userId })
      .andWhere('project.deleted_at IS NULL')
      .leftJoinAndSelect('project.owner', 'owner')
      .orderBy('project.updated_at', 'DESC')
      .getMany()

    // 为每个项目添加进度信息
    for (const project of projects) {
      ;(project as any).progress = await this.calculateProgress(project.id)
    }

    return projects
  }

  async findOne(projectId: string, userId: string): Promise<Project> {
    this.logger.log(`🔍 ProjectsService.findOne: projectId=${projectId}, userId=${userId}`)

    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['owner'],
    })

    if (!project) {
      throw new NotFoundException('项目不存在')
    }

    this.logger.log(`✅ Project found: ${project.name}`)

    // 计算并添加进度信息
    ;(project as any).progress = await this.calculateProgress(project.id)

    // 简化权限检查：只检查用户是否登录（userId不为空）
    // TODO: 后续可以添加项目成员权限检查
    // const membership = await this.projectMemberRepo.findOne({
    //   where: { projectId, userId },
    // })

    return project
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(projectId, userId)

    // 简化权限检查：暂时允许所有已登录用户编辑
    // TODO: 后续添加OWNER/EDITOR权限检查

    // 如果更新包含 metadata，合并而不是替换
    if (dto.metadata) {
      project.metadata = {
        ...(project.metadata || {}),
        ...dto.metadata,
      }
      // 移除 dto.metadata 以避免 Object.assign 重复处理
      const { metadata, ...dtoWithoutMetadata } = dto as any
      Object.assign(project, dtoWithoutMetadata)
    } else {
      Object.assign(project, dto)
    }

    await this.projectRepo.save(project)

    this.logger.log(`Updated project ${projectId}`)

    return project
  }

  async remove(projectId: string, userId: string): Promise<void> {
    const project = await this.findOne(projectId, userId)

    // 简化权限检查：暂时允许所有已登录用户删除
    // TODO: 后续添加OWNER权限检查
    await this.projectRepo.softRemove(project)
    this.logger.log(`Deleted project ${projectId}`)
  }

  async updateStatus(projectId: string, status: ProjectStatus): Promise<void> {
    await this.projectRepo.update(projectId, { status })
    this.logger.log(`Updated project ${projectId} status to ${status}`)
  }

  async calculateProgress(projectId: string): Promise<number> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    })

    if (!project) {
      return 0
    }

    const tasks = await this.aiTaskRepo.find({
      where: { projectId },
    })

    if (tasks.length === 0) {
      // 如果没有任何任务，但有上传文档，进度为20% (1/5步骤完成)
      const uploadedDocs = (project.metadata as any)?.uploadedDocuments
      if (uploadedDocs && uploadedDocs.length > 0) {
        return Math.round((1 / 6) * 100) // 上传文档占1/6
      }
      return 0
    }

    const completedTasks = tasks.filter((task) => task.status === TaskStatus.COMPLETED)

    // 计算各个步骤的完成情况
    const stepTypes = [
      AITaskType.SUMMARY,
      AITaskType.CLUSTERING,
      AITaskType.MATRIX,
      AITaskType.QUESTIONNAIRE,
      AITaskType.ACTION_PLAN,
    ]

    const completedSteps = stepTypes.filter((type) =>
      completedTasks.some((task) => task.type === type),
    ).length

    // 检查是否上传了文档
    const uploadedDocs = (project.metadata as any)?.uploadedDocuments
    const hasUploadedDocs = uploadedDocs && uploadedDocs.length > 0

    // 总步骤数 = 上传文档(1) + 5个AI任务步骤 = 6
    const totalSteps = 6
    const completedCount = completedSteps + (hasUploadedDocs ? 1 : 0)

    return Math.round((completedCount / totalSteps) * 100)
  }

  async autoUpdateStatus(projectId: string): Promise<void> {
    const tasks = await this.aiTaskRepo.find({
      where: { projectId },
    })

    if (tasks.length === 0) {
      return
    }

    const completedTasks = tasks.filter((task) => task.status === TaskStatus.COMPLETED)

    const stepTypes = [
      AITaskType.SUMMARY,
      AITaskType.CLUSTERING,
      AITaskType.MATRIX,
      AITaskType.QUESTIONNAIRE,
      AITaskType.ACTION_PLAN,
    ]

    const completedSteps = stepTypes.filter((type) =>
      completedTasks.some((task) => task.type === type),
    ).length

    // 更新项目状态
    if (completedSteps === stepTypes.length) {
      await this.updateStatus(projectId, ProjectStatus.COMPLETED)
    } else if (completedSteps > 0) {
      await this.updateStatus(projectId, ProjectStatus.ACTIVE)
    }
  }

  async getTasksByType(projectId: string, taskType: AITaskType): Promise<AITask[]> {
    return this.aiTaskRepo.find({
      where: { projectId, type: taskType },
      order: { createdAt: 'DESC' },
    })
  }

  async getLatestTask(projectId: string, taskType: AITaskType): Promise<AITask | null> {
    return this.aiTaskRepo.findOne({
      where: { projectId, type: taskType },
      order: { createdAt: 'DESC' },
    })
  }
}
