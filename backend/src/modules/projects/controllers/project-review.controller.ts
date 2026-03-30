import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { ProjectReviewBulkApproveDto } from '../dto/project-review-bulk-approve.dto'
import { ProjectReviewQueryDto } from '../dto/project-review-query.dto'
import { AuditLogService } from '../services/audit-log.service'
import { ProjectReviewService } from '../services/project-review.service'

@ApiTags('Projects - Review Workbench')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/review-items')
export class ProjectReviewController {
  constructor(
    private readonly projectReviewService: ProjectReviewService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取项目审核工作台聚合列表' })
  async getReviewItems(
    @Param('projectId') projectId: string,
    @Query() query: ProjectReviewQueryDto,
    @CurrentUser() user: { id?: string; userId?: string },
    @Req() req: Request,
  ) {
    const userId = user?.id || user?.userId
    const project = await this.projectReviewService.assertAccess(projectId, userId!, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      query,
    })

    const response = await this.projectReviewService.getReviewItems(project, query)

    await this.auditLogService.log({
      userId: userId!,
      organizationId: project.organizationId ?? undefined,
      action: AuditAction.READ,
      entityType: 'ProjectReviewList',
      entityId: projectId,
      details: {
        filtersApplied: response.filtersApplied,
        pagination: response.pagination,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return response
  }

  @Post('bulk-approve')
  @ApiOperation({ summary: '批量通过当前筛选下的审核项' })
  async bulkApprove(
    @Param('projectId') projectId: string,
    @Body() body: ProjectReviewBulkApproveDto,
    @CurrentUser() user: { id?: string; userId?: string },
    @Req() req: Request,
  ) {
    const userId = user?.id || user?.userId
    const project = await this.projectReviewService.assertAccess(projectId, userId!, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return this.projectReviewService.bulkApprove(project, userId!, body, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })
  }
}
