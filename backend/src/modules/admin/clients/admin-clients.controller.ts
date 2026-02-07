import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Header,
  Res,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { AdminClientsService } from './admin-clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { BulkConfigDto } from './dto/bulk-config.dto'
import { CsvParserService } from './csv-parser.service'
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard'
import { TenantGuard } from '../../../modules/organizations/guards/tenant.guard'
import { RolesGuard } from '../../../modules/auth/guards/roles.guard'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../database/entities'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger'

/**
 * Admin Clients Controller
 *
 * REST API controller for managing client organizations from the admin perspective.
 *
 * @story 6-2
 * @route /api/v1/admin/clients
 */
@ApiTags('Admin - Clients')
@ApiBearerAuth()
@Controller('api/v1/admin/clients')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminClientsController {
  constructor(
    private readonly adminClientsService: AdminClientsService,
    private readonly csvParserService: CsvParserService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取客户列表', description: '获取当前租户的所有客户组织' })
  @ApiResponse({ status: 200, description: '成功返回客户列表' })
  async findAll(@Request() req) {
    const tenantId = req.tenantId
    return this.adminClientsService.findAll(tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取客户详情', description: '获取单个客户的详细信息和统计数据' })
  @ApiResponse({ status: 200, description: '成功返回客户详情' })
  @ApiResponse({ status: 404, description: '客户不存在' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenantId = req.tenantId
    return this.adminClientsService.findOne(tenantId, id)
  }

  @Post()
  @ApiOperation({ summary: '创建客户', description: '创建新的客户组织并发送欢迎邮件' })
  @ApiResponse({ status: 201, description: '客户创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  async create(@Request() req, @Body() dto: CreateClientDto) {
    const tenantId = req.tenantId
    return this.adminClientsService.create(tenantId, dto)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新客户', description: '更新客户组织信息' })
  @ApiResponse({ status: 200, description: '客户更新成功' })
  @ApiResponse({ status: 404, description: '客户不存在' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const tenantId = req.tenantId
    return this.adminClientsService.update(tenantId, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除客户', description: '软删除客户组织' })
  @ApiResponse({ status: 204, description: '客户删除成功' })
  @ApiResponse({ status: 404, description: '客户不存在' })
  async remove(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tenantId = req.tenantId
    return this.adminClientsService.remove(tenantId, id)
  }

  @Post('bulk')
  @ApiOperation({ summary: '批量创建客户', description: '从 JSON 数组批量创建客户' })
  @ApiResponse({ status: 201, description: '批量创建完成，返回成功和失败列表' })
  async bulkCreate(
    @Request() req,
    @Body() clients: CreateClientDto[],
  ) {
    const tenantId = req.tenantId
    return this.adminClientsService.bulkCreate(tenantId, clients)
  }

  @Post('bulk-csv')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'CSV 批量导入客户', description: '通过上传 CSV 文件批量导入客户' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV 文件 (name,contactPerson,contactEmail,industryType,scale)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'CSV 导入完成，返回成功和失败列表' })
  @ApiResponse({ status: 400, description: 'CSV 文件格式错误' })
  async bulkCreateFromCsv(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required')
    }

    const tenantId = req.tenantId

    // Parse CSV
    const clients = this.csvParserService.parseClientsCsv(file.buffer)

    // Bulk create
    const result = await this.adminClientsService.bulkCreate(tenantId, clients)

    return {
      total: clients.length,
      success: result.success.length,
      failed: result.failed.length,
      successList: result.success,
      failedList: result.failed,
    }
  }

  @Get('csv-template/download')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="client-import-template.csv"')
  @ApiOperation({ summary: '下载 CSV 模板', description: '下载客户导入 CSV 模板文件' })
  @ApiResponse({ status: 200, description: '成功返回 CSV 模板' })
  async downloadCsvTemplate(@Res() res: Response) {
    const template = this.csvParserService.generateCsvTemplate()
    res.send(template)
  }

  @Post('bulk-config')
  @ApiOperation({ summary: '批量配置客户', description: '批量更新多个客户的推送配置' })
  @ApiResponse({ status: 200, description: '批量配置成功' })
  @ApiResponse({ status: 404, description: '部分客户不存在' })
  async bulkConfig(@Request() req, @Body() dto: BulkConfigDto) {
    const tenantId = req.tenantId
    const updatedCount = await this.adminClientsService.bulkConfig(tenantId, dto)
    return { updatedCount }
  }

  @Get('statistics/overview')
  @ApiOperation({ summary: '获取客户统计', description: '获取客户总数和各状态分布' })
  @ApiResponse({ status: 200, description: '成功返回统计数据' })
  async getStatistics(@Request() req) {
    const tenantId = req.tenantId
    return this.adminClientsService.getStatistics(tenantId)
  }
}
