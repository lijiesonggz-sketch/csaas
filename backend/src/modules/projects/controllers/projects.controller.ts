import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ProjectsService } from '../services/projects.service'
import { ProjectMembersService } from '../services/project-members.service'
import { TaskRerunService } from '../services/task-rerun.service'
import { ProjectAccessGuard } from '../guards/project-access.guard'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { CreateProjectDto } from '../dto/create-project.dto'
import { UpdateProjectDto } from '../dto/update-project.dto'
import { AddProjectMemberDto } from '../dto/add-project-member.dto'
import { UpdateProjectMemberDto } from '../dto/update-project-member.dto'
import { RerunTaskDto } from '../dto/rerun-task.dto'
import { RollbackTaskDto } from '../dto/rollback-task.dto'
import { ProjectMemberRole } from '@/database/entities'

/**
 * ProjectsController
 *
 * Project management endpoints.
 * All endpoints require JWT authentication.
 * Project-specific endpoints require project membership verification.
 *
 * @module backend/src/modules/projects
 */
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name)

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectMembersService: ProjectMembersService,
    private readonly taskRerunService: TaskRerunService,
  ) {}

  /**
   * 创建项目
   * POST /projects
   */
  @Post()
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: any) {
    const userId = user.userId || user.id

    if (!userId) {
      return {
        success: false,
        message: '未登录，无法创建项目',
      }
    }

    const project = await this.projectsService.create(userId, dto)
    return {
      success: true,
      data: project,
    }
  }

  /**
   * 项目列表（仅返回有权限的项目）
   * GET /projects
   */
  @Get()
  async findAll(@CurrentUser() user: any) {
    const userId = user.userId || user.id

    if (!userId) {
      return {
        success: false,
        message: '未登录',
        data: [],
      }
    }

    const projects = await this.projectsService.findAll(userId)
    return {
      success: true,
      data: projects,
    }
  }

  /**
   * 测试endpoint - 完全绕过权限检查
   * GET /projects/test/:id
   */
  @Get('test/:projectId')
  async testEndpoint(@Param('projectId') projectId: string) {
    return {
      success: true,
      message: 'Test endpoint works!',
      projectId,
    }
  }

  /**
   * 项目详情
   * GET /projects/:id
   */
  @Get(':projectId')
  @UseGuards(ProjectAccessGuard)
  async findOne(@Param('projectId') projectId: string, @CurrentUser() user: any) {
    const userId = user.userId || user.id

    this.logger.log(`🔍 Controller.findOne: projectId=${projectId}, userId=${userId}`)

    const project = await this.projectsService.findOne(projectId, userId)
    const progress = await this.projectsService.calculateProgress(projectId)

    this.logger.log(`✅ Controller: project found, progress=${progress}`)

    return {
      success: true,
      data: {
        ...project,
        progress,
      },
    }
  }

  /**
   * 更新项目
   * PATCH /projects/:id
   */
  @Patch(':projectId')
  @UseGuards(ProjectAccessGuard)
  async update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.headers['x-user-id'] || 'system'
    const project = await this.projectsService.update(projectId, userId, dto)
    return {
      success: true,
      data: project,
    }
  }

  /**
   * 删除项目
   * DELETE /projects/:id
   */
  @Delete(':projectId')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('projectId') projectId: string, @CurrentUser() user: any, @Req() req?: any) {
    const userId = user?.id || req?.headers['x-user-id'] || 'system'
    await this.projectsService.remove(projectId, userId)
  }

  /**
   * 获取项目成员列表
   * GET /projects/:id/members
   */
  @Get(':projectId/members')
  @UseGuards(ProjectAccessGuard)
  async getMembers(@Param('projectId') projectId: string) {
    const members = await this.projectMembersService.findByProject(projectId)
    return {
      success: true,
      data: members,
    }
  }

  /**
   * 添加项目成员
   * POST /projects/:id/members
   */
  @Post(':projectId/members')
  @UseGuards(ProjectAccessGuard)
  async addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user.id
    // 检查权限：只有OWNER可以添加成员
    const membership = await this.projectMembersService.findByProjectAndUser(projectId, userId)

    if (!membership || membership.role !== ProjectMemberRole.OWNER) {
      return {
        success: false,
        message: '只有项目所有者可以添加成员',
      }
    }

    const member = await this.projectMembersService.addMember(projectId, dto, userId)
    return {
      success: true,
      data: member,
    }
  }

  /**
   * 更新成员角色
   * PATCH /projects/:id/members/:userId
   */
  @Patch(':projectId/members/:userId')
  @UseGuards(ProjectAccessGuard)
  async updateMemberRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateProjectMemberDto,
    @Req() req: any,
  ) {
    const currentUserId = req.user?.id || req.headers['x-user-id'] || 'system'
    // 检查权限：只有OWNER可以修改角色
    const membership = await this.projectMembersService.findByProjectAndUser(
      projectId,
      currentUserId,
    )

    if (!membership || membership.role !== ProjectMemberRole.OWNER) {
      return {
        success: false,
        message: '只有项目所有者可以修改成员角色',
      }
    }

    const member = await this.projectMembersService.updateMemberRole(projectId, userId, dto)
    return {
      success: true,
      data: member,
    }
  }

  /**
   * 移除项目成员
   * DELETE /projects/:id/members/:userId
   */
  @Delete(':projectId/members/:userId')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    const currentUserId = user.userId || user.id
    // 检查权限：只有OWNER可以移除成员
    const membership = await this.projectMembersService.findByProjectAndUser(
      projectId,
      currentUserId,
    )

    if (!membership || membership.role !== ProjectMemberRole.OWNER) {
      throw new Error('只有项目所有者可以移除成员')
    }

    await this.projectMembersService.removeMember(projectId, userId)
  }

  /**
   * 重跑任务（with备份）
   * POST /projects/:id/rerun
   */
  @Post(':projectId/rerun')
  @UseGuards(ProjectAccessGuard)
  async rerunTask(
    @Param('projectId') projectId: string,
    @Body() dto: RerunTaskDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user.id
    // 检查权限：OWNER和EDITOR可以重跑任务
    const membership = await this.projectMembersService.findByProjectAndUser(projectId, userId)

    if (
      !membership ||
      ![ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(membership.role)
    ) {
      return {
        success: false,
        message: '只有项目所有者和编辑者可以重跑任务',
      }
    }

    const newTask = await this.taskRerunService.rerunWithBackup(projectId, dto.type)
    return {
      success: true,
      data: newTask,
      message: '任务已重新生成，系统已自动备份当前版本',
    }
  }

  /**
   * 回退到备份版本
   * POST /projects/:id/rollback
   */
  @Post(':projectId/rollback')
  @UseGuards(ProjectAccessGuard)
  async rollbackTask(
    @Param('projectId') projectId: string,
    @Body() dto: RollbackTaskDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user.id
    // 检查权限：OWNER和EDITOR可以回退
    const membership = await this.projectMembersService.findByProjectAndUser(projectId, userId)

    if (
      !membership ||
      ![ProjectMemberRole.OWNER, ProjectMemberRole.EDITOR].includes(membership.role)
    ) {
      return {
        success: false,
        message: '只有项目所有者和编辑者可以回退任务',
      }
    }

    const rollbackTask = await this.taskRerunService.rollbackToBackup(projectId, dto.type)
    return {
      success: true,
      data: rollbackTask,
      message: '已回退到备份版本',
    }
  }

  /**
   * 获取备份信息
   * GET /projects/:id/backup/:taskType
   */
  @Get(':projectId/backup/:taskType')
  @UseGuards(ProjectAccessGuard)
  async getBackupInfo(@Param('projectId') projectId: string, @Param('taskType') taskType: string) {
    const backupInfo = await this.taskRerunService.getBackupInfo(projectId, taskType as any)
    return {
      success: true,
      data: backupInfo,
    }
  }
}
