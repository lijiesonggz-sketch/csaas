import { Body, Controller, Get, Post, Put, Param, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
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
  CreateTaxonomyL1Dto,
  CreateTaxonomyL2Dto,
  QueryTaxonomyTreeDto,
  UpdateTaxonomyL1Dto,
  UpdateTaxonomyL2Dto,
} from '../dto/taxonomy.dto'
import { TaxonomyService } from '../services/taxonomy.service'

@ApiTags('Knowledge Graph - Taxonomy')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/taxonomy')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class TaxonomyController {
  constructor(
    private readonly taxonomyService: TaxonomyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('tree')
  @ApiOperation({ summary: '获取 taxonomy 树' })
  @ApiResponse({ status: 200, description: '成功返回 taxonomy 树' })
  async getTree(@Query() query: QueryTaxonomyTreeDto) {
    return this.taxonomyService.getTree(query)
  }

  @Post('l1')
  @ApiOperation({ summary: '创建一级 taxonomy' })
  async createL1(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateTaxonomyL1Dto,
    @Req() req: Request,
  ) {
    const result = await this.taxonomyService.createL1(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'TaxonomyL1',
      entityId: result.l1Code,
      details: {
        l1Code: result.l1Code,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('l1/:l1Code')
  @ApiOperation({ summary: '更新一级 taxonomy' })
  async updateL1(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('l1Code') l1Code: string,
    @Body() dto: UpdateTaxonomyL1Dto,
    @Req() req: Request,
  ) {
    const result = await this.taxonomyService.updateL1(l1Code, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'TaxonomyL1',
      entityId: result.l1Code,
      details: {
        l1Code: result.l1Code,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Post('l2')
  @ApiOperation({ summary: '创建二级 taxonomy' })
  async createL2(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateTaxonomyL2Dto,
    @Req() req: Request,
  ) {
    const result = await this.taxonomyService.createL2(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'TaxonomyL2',
      entityId: result.l2Code,
      details: {
        l2Code: result.l2Code,
        l1Code: result.l1Code,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('l2/:l2Code')
  @ApiOperation({ summary: '更新二级 taxonomy' })
  async updateL2(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('l2Code') l2Code: string,
    @Body() dto: UpdateTaxonomyL2Dto,
    @Req() req: Request,
  ) {
    const result = await this.taxonomyService.updateL2(l2Code, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'TaxonomyL2',
      entityId: result.l2Code,
      details: {
        l2Code: result.l2Code,
        l1Code: result.l1Code,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }
}
