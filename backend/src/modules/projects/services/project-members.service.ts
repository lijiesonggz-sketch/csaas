import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ProjectMember, ProjectMemberRole } from '@/database/entities'
import { AddProjectMemberDto } from '../dto/add-project-member.dto'
import { UpdateProjectMemberDto } from '../dto/update-project-member.dto'

@Injectable()
export class ProjectMembersService {
  private readonly logger = new Logger(ProjectMembersService.name)

  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
  ) {}

  async addMember(
    projectId: string,
    dto: AddProjectMemberDto,
    addedBy: string,
  ): Promise<ProjectMember> {
    // 检查成员是否已存在
    const existing = await this.projectMemberRepo.findOne({
      where: { projectId, userId: dto.userId },
    })

    if (existing) {
      throw new ForbiddenException('用户已是项目成员')
    }

    const member = this.projectMemberRepo.create({
      projectId,
      userId: dto.userId,
      role: dto.role,
      addedAt: new Date(),
      addedBy,
    })

    await this.projectMemberRepo.save(member)
    this.logger.log(`Added member ${dto.userId} to project ${projectId} as ${dto.role}`)

    return member
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    dto: UpdateProjectMemberDto,
  ): Promise<ProjectMember> {
    const member = await this.projectMemberRepo.findOne({
      where: { projectId, userId },
    })

    if (!member) {
      throw new NotFoundException('成员不存在')
    }

    member.role = dto.role
    await this.projectMemberRepo.save(member)

    this.logger.log(`Updated member ${userId} role to ${dto.role} in project ${projectId}`)

    return member
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const member = await this.projectMemberRepo.findOne({
      where: { projectId, userId },
    })

    if (!member) {
      throw new NotFoundException('成员不存在')
    }

    await this.projectMemberRepo.remove(member)
    this.logger.log(`Removed member ${userId} from project ${projectId}`)
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null> {
    this.logger.log(`🔍 findByProjectAndUser: projectId=${projectId}, userId=${userId}`)

    const member = await this.projectMemberRepo.findOne({
      where: { projectId, userId },
    })

    this.logger.log(`🔍 Query result: ${member ? 'FOUND' : 'NOT FOUND'}, role: ${member?.role}`)

    return member
  }

  async findByProject(projectId: string): Promise<ProjectMember[]> {
    return this.projectMemberRepo.find({
      where: { projectId },
      relations: ['user'],
    })
  }

  async checkPermission(
    projectId: string,
    userId: string,
    allowedRoles: ProjectMemberRole[],
  ): Promise<boolean> {
    const member = await this.findByProjectAndUser(projectId, userId)
    if (!member) {
      return false
    }
    return allowedRoles.includes(member.role)
  }

  // 角色权限检查辅助方法
  canOwner(member: ProjectMember): boolean {
    return member.role === ProjectMemberRole.OWNER
  }

  canEditor(member: ProjectMember): boolean {
    return [ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(member.role)
  }

  canViewer(member: ProjectMember): boolean {
    return [ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR, ProjectMemberRole.VIEWER].includes(
      member.role,
    )
  }
}
