import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { Request, Response } from 'express'
import { memoryStorage } from 'multer'
import { Roles } from '../../../common/decorators/roles.decorator'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { ImportTaxonomyRuntimeProfileDto } from '../dto/taxonomy-governance.dto'
import { TaxonomyGovernanceService } from '../services/taxonomy-classification/taxonomy-governance.service'

const TAXONOMY_GOVERNANCE_IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024

@ApiTags('Knowledge Graph - Taxonomy Governance')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph/taxonomy-governance')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TaxonomyGovernanceController {
  constructor(
    private readonly taxonomyGovernanceService: TaxonomyGovernanceService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: '获取 taxonomy governance summary' })
  @ApiResponse({ status: 200, description: '成功返回 governance summary' })
  async getSummary(@CurrentTenant() tenantId: string) {
    return this.taxonomyGovernanceService.getSummary(tenantId)
  }

  @Post('runtime-profile/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: TAXONOMY_GOVERNANCE_IMPORT_MAX_FILE_SIZE,
      },
    }),
  )
  @ApiOperation({ summary: '导入 runtime profile snapshot' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'sourceVersion'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Runtime profile CSV snapshot',
        },
        sourceVersion: {
          type: 'string',
          example: '2026-04-29-governance-v2',
        },
      },
    },
  })
  async importRuntimeProfile(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportTaxonomyRuntimeProfileDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('请上传 Runtime Profile CSV 文件')
    }

    const result = await this.taxonomyGovernanceService.importRuntimeProfile({
      tenantId,
      actorUserId: user.id || user.userId || '',
      sourceVersion: dto.sourceVersion,
      csvText: file.buffer.toString('utf8'),
      originalFileName: file.originalname,
      ipAddress: req.ip,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })

    return result
  }

  @Get('runtime-profile/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: '导出当前 runtime profile snapshot' })
  @ApiResponse({ status: 200, description: '成功返回 CSV attachment' })
  async exportRuntimeProfile(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const exportResult = await this.taxonomyGovernanceService.exportRuntimeProfileCsv(tenantId)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.READ,
      entityType: 'TaxonomyRuntimeProfileExport',
      entityId: null,
      details: {
        sourceVersion: exportResult.sourceVersion,
        fileName: exportResult.fileName,
        rowCount: exportResult.rowCount,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`)
    res.send(exportResult.csvContent)
  }
}
