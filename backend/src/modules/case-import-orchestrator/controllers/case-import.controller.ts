import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { Request } from 'express'
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
import {
  KG_CASE_IMPORT_ALLOWED_EXTENSIONS,
  KG_CASE_IMPORT_MAX_FILE_SIZE,
  KG_CASE_IMPORT_UPLOAD_DIR,
} from '../constants/case-import.constants'
import {
  ComplianceCaseImportEnqueueResult,
  ImportComplianceCasesDto,
  UploadComplianceCasesDto,
} from '../dto/import-compliance-cases.dto'
import { CaseImportAuditFilter } from '../filters/case-import-audit.filter'
import { CaseImportQueueService } from '../services/case-import-queue.service'

@ApiTags('Knowledge Graph - Case Import')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@UseFilters(CaseImportAuditFilter)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class CaseImportController {
  constructor(
    private readonly caseImportQueueService: CaseImportQueueService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('cases/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: KG_CASE_IMPORT_MAX_FILE_SIZE,
      },
    }),
  )
  @ApiOperation({ summary: '创建处罚案例导入任务' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'regulatorCode'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '处罚案例导入文件，支持 .xlsx、.xls、.csv',
        },
        regulatorCode: {
          type: 'string',
          example: 'PBOC',
        },
        batchId: {
          type: 'string',
          example: 'PBOC-batch-001',
        },
      },
    },
  })
  async createImportJob(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadComplianceCasesDto,
    @Req() req: Request,
  ) {
    this.validateImportFile(file)
    const filePath = await this.persistUploadedFile(file)
    let result: ComplianceCaseImportEnqueueResult

    try {
      const importDto: ImportComplianceCasesDto = {
        filePath,
        sourceFileName: file.originalname,
        regulatorCode: dto.regulatorCode,
        batchId: dto.batchId,
      }
      result = await this.caseImportQueueService.enqueueImport(importDto)
    } catch (error) {
      await this.cleanupUploadedFile(filePath)
      throw error
    }

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'ComplianceCaseImportJob',
      entityId: result.jobId,
      details: {
        batchId: result.batchId,
        fileName: result.fileName,
        regulatorCode: result.regulatorCode,
        status: result.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  private validateImportFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException('请上传案例导入文件')
    }

    const extension = extname(file.originalname).toLowerCase()
    if (!KG_CASE_IMPORT_ALLOWED_EXTENSIONS.includes(extension as (typeof KG_CASE_IMPORT_ALLOWED_EXTENSIONS)[number])) {
      throw new BadRequestException('仅支持 .xlsx、.xls、.csv 文件')
    }
  }

  private async persistUploadedFile(file: Express.Multer.File): Promise<string> {
    await mkdir(KG_CASE_IMPORT_UPLOAD_DIR, { recursive: true })

    const extension = extname(file.originalname).toLowerCase() || '.xlsx'
    const storedFilePath = join(
      KG_CASE_IMPORT_UPLOAD_DIR,
      `${Date.now()}-${randomUUID()}${extension}`,
    )

    await writeFile(storedFilePath, file.buffer)
    return storedFilePath
  }

  private async cleanupUploadedFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath)
    } catch {
      // Ignore cleanup failures so the original queue error is preserved.
    }
  }
}
