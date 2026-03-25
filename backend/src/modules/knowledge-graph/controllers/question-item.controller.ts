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
  CreateQuestionItemDto,
  QueryQuestionItemDto,
  UpdateQuestionItemDto,
} from '../dto/question-item.dto'
import { QuestionItemService } from '../services/question-item.service'

@ApiTags('Knowledge Graph - Question Items')
@ApiBearerAuth()
@Controller('api/admin/knowledge-graph')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONSULTANT)
export class QuestionItemController {
  constructor(
    private readonly questionItemService: QuestionItemService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('question-items')
  @ApiOperation({ summary: '获取 question item 列表' })
  async findAll(@Query() query: QueryQuestionItemDto) {
    return this.questionItemService.findAll(query)
  }

  @Post('question-items')
  @ApiOperation({ summary: '创建 question item' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Body() dto: CreateQuestionItemDto,
    @Req() req: Request,
  ) {
    const result = await this.questionItemService.create(dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.CREATE,
      entityType: 'QuestionItem',
      entityId: result.questionId,
      details: {
        controlId: result.controlId,
        questionCode: result.questionCode,
        questionType: result.questionType,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Put('question-items/:questionId')
  @ApiOperation({ summary: '更新 question item' })
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id?: string; userId?: string },
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionItemDto,
    @Req() req: Request,
  ) {
    const result = await this.questionItemService.update(questionId, dto)

    await this.auditLogService.log({
      userId: user.id || user.userId,
      tenantId,
      action: AuditAction.UPDATE,
      entityType: 'QuestionItem',
      entityId: result.questionId,
      details: {
        controlId: result.controlId,
        questionCode: result.questionCode,
        questionType: result.questionType,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    })

    return result
  }

  @Get('control-points/:controlId/questions')
  @ApiOperation({ summary: '按控制点获取题库' })
  async findByControlId(@Param('controlId') controlId: string) {
    return this.questionItemService.findByControlId(controlId)
  }
}
