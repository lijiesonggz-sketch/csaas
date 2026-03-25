import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { Roles } from '../../../common/decorators/roles.decorator'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import {
  CreateRemediationActionDto,
  QueryRemediationActionDto,
  UpdateRemediationActionDto,
} from '../dto/remediation-action.dto'
import { RemediationActionService } from '../services/remediation-action.service'

@ApiTags('Knowledge Graph - Remediation Actions')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class RemediationActionController {
  constructor(
    private readonly remediationActionService: RemediationActionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('remediation-actions')
  @ApiOperation({ summary: '获取 remediation action 列表' })
  async findAll(@Query() query: QueryRemediationActionDto) {
    return this.remediationActionService.findAll(query)
  }

  @Post('remediation-actions')
  @ApiOperation({ summary: '创建 remediation action' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateRemediationActionDto,
    @Req() req: Request,
  ) {
    const result = await this.remediationActionService.create(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'RemediationAction',
      entityId: result.actionId,
      details: {
        controlId: result.controlId,
        actionCode: result.actionCode,
        priorityDefault: result.priorityDefault,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('remediation-actions/:actionId')
  @ApiOperation({ summary: '更新 remediation action' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('actionId') actionId: string,
    @Body() dto: UpdateRemediationActionDto,
    @Req() req: Request,
  ) {
    const result = await this.remediationActionService.update(actionId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'RemediationAction',
      entityId: result.actionId,
      details: {
        controlId: result.controlId,
        actionCode: result.actionCode,
        priorityDefault: result.priorityDefault,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('control-points/:controlId/remediations')
  @ApiOperation({ summary: '按控制点获取整改建议' })
  async findByControlId(@Param('controlId') controlId: string) {
    return this.remediationActionService.findByControlId(controlId)
  }
}
