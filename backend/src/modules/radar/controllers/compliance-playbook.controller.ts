import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, UseGuards, HttpException } from '@nestjs/common'
// import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger'
import { CompliancePlaybookService } from '../services/compliance-playbook.service'
import { SubmitChecklistDto } from '../dto/submit-checklist.dto'
import { CompliancePlaybook } from '../../../database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from '../../../database/entities/compliance-checklist-submission.entity'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../auth/decorators/current-user.decorator'

/**
 * CompliancePlaybookController - 合规剧本Controller
 *
 * Story 4.2 - Phase 5.2: CompliancePlaybookController实现
 * AR12 Layer 1 Defense: JWT认证 + 组织验证
 *
 * 提供合规剧本API端点
 */
// @ApiTags('Compliance Radar')
@Controller('api/radar/compliance')
@UseGuards(JwtAuthGuard) // AR12 Layer 1: JWT认证
export class CompliancePlaybookController {
  constructor(private readonly playbookService: CompliancePlaybookService) {}

  /**
   * 获取合规剧本
   *
   * GET /api/radar/compliance/playbooks/:pushId
   *
   * AR12 Layer 1 Defense: 从query参数获取organizationId进行组织验证
   */
  @Get('playbooks/:pushId')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: '获取合规应对剧本',
  //   description: '根据推送ID获取合规应对剧本，包含检查清单、解决方案和报告模板',
  // })
  // @ApiParam({
  //   name: 'pushId',
  //   description: '推送ID',
  //   example: 'push-123',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: '剧本获取成功',
  //   type: CompliancePlaybook,
  // })
  async getPlaybook(
    @Param('pushId') pushId: string,
    @Query('organizationId') organizationId: string, // AR12 Layer 1: 从query参数获取组织ID
  ): Promise<CompliancePlaybook> {
    if (!organizationId) {
      throw new HttpException('organizationId is required', HttpStatus.BAD_REQUEST)
    }
    return this.playbookService.getPlaybookByPushId(pushId, organizationId)
  }

  /**
   * 提交自查清单
   *
   * POST /api/radar/compliance/playbooks/:pushId/checklist
   *
   * AR12 Layer 1 Defense: 从JWT提取userId，从query参数获取organizationId
   */
  @Post('playbooks/:pushId/checklist')
  @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({
  //   summary: '提交自查清单',
  //   description: '提交合规自查清单，记录已勾选和未勾选的检查项',
  // })
  async submitChecklist(
    @Param('pushId') pushId: string,
    @CurrentUser() user: any, // AR12 Layer 1: 从JWT提取用户ID
    @Body() submitDto: SubmitChecklistDto,
    @Body('organizationId') organizationId: string, // AR12 Layer 1: 从body获取组织ID
  ): Promise<{
    message: string
    submission: ComplianceChecklistSubmission
  }> {
    const { id: userId } = user
    if (!organizationId) {
      throw new HttpException('organizationId is required', HttpStatus.BAD_REQUEST)
    }
    const submission = await this.playbookService.submitChecklist(
      pushId,
      userId,
      organizationId,
      submitDto,
    )

    return {
      message: 'Checklist submitted successfully',
      submission,
    }
  }

  /**
   * 获取自查清单提交记录
   *
   * GET /api/radar/compliance/playbooks/:pushId/checklist
   *
   * AR12 Layer 1 Defense: 从JWT提取userId，从query参数获取organizationId
   */
  @Get('playbooks/:pushId/checklist')
  @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: '获取自查清单提交记录',
  //   description: '获取用户对特定推送的自查清单提交记录',
  // })
  async getChecklistSubmission(
    @Param('pushId') pushId: string,
    @CurrentUser() user: any, // AR12 Layer 1: 从JWT提取用户ID
    @Query('organizationId') organizationId: string, // AR12 Layer 1: 从query获取组织ID
  ): Promise<ComplianceChecklistSubmission | null> {
    const { id: userId } = user
    if (!organizationId) {
      throw new HttpException('organizationId is required', HttpStatus.BAD_REQUEST)
    }
    return this.playbookService.getChecklistSubmission(pushId, userId, organizationId)
  }
}
