import { Injectable, NotFoundException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CompliancePlaybook } from '../../../database/entities/compliance-playbook.entity'
import { ComplianceChecklistSubmission } from '../../../database/entities/compliance-checklist-submission.entity'
import { RadarPush } from '../../../database/entities/radar-push.entity'
import { SubmitChecklistDto } from '../dto/submit-checklist.dto'

/**
 * CompliancePlaybookService - 合规剧本Service
 *
 * Story 4.2 - Phase 5.1: CompliancePlaybookService实现
 * AR12 Layer 2 Defense: Service层多租户组织验证
 *
 * 提供合规剧本的查询和提交功能
 */
@Injectable()
export class CompliancePlaybookService {
  constructor(
    @InjectRepository(CompliancePlaybook)
    private readonly playbookRepo: Repository<CompliancePlaybook>,
    @InjectRepository(ComplianceChecklistSubmission)
    private readonly submissionRepo: Repository<ComplianceChecklistSubmission>,
    @InjectRepository(RadarPush)
    private readonly pushRepo: Repository<RadarPush>,
  ) {}

  /**
   * AR12 Layer 2 Defense: 验证push是否属于用户组织
   *
   * 防止跨组织数据访问（Level 2 - Service层防御）
   *
   * @param pushId - 推送ID
   * @param userOrganizationId - 用户组织ID
   * @throws ForbiddenException - push不属于用户组织
   */
  private async validatePushAccess(
    pushId: string,
    userOrganizationId: string,
  ): Promise<void> {
    const push = await this.pushRepo.findOne({
      where: { id: pushId },
      select: ['id', 'organizationId'],
    })

    if (!push) {
      throw new NotFoundException(`Push not found: ${pushId}`)
    }

    if (push.organizationId !== userOrganizationId) {
      throw new ForbiddenException(
        `Access denied: push ${pushId} belongs to organization ${push.organizationId}, not ${userOrganizationId}`,
      )
    }
  }

  /**
   * 根据pushId获取合规剧本
   *
   * AR12 Layer 2 Defense: 验证push属于用户组织
   *
   * @param pushId - 推送ID
   * @param userOrganizationId - 用户组织ID
   * @returns 合规剧本
   * @throws NotFoundException - 剧本不存在
   * @throws ForbiddenException - push不属于用户组织
   * @throws HttpException(202) - 剧本生成中
   * @throws HttpException(500) - 剧本生成失败
   */
  async getPlaybookByPushId(
    pushId: string,
    userOrganizationId: string,
  ): Promise<CompliancePlaybook> {
    // AR12 Layer 2 Defense: 验证push属于用户组织
    await this.validatePushAccess(pushId, userOrganizationId)

    // 1. 尝试获取剧本
    const playbook = await this.playbookRepo.findOne({
      where: { pushId },
    })

    if (playbook) {
      return playbook
    }

    // 2. 剧本不存在，检查push状态
    const push = await this.pushRepo.findOne({
      where: { id: pushId },
    })

    if (!push) {
      throw new NotFoundException(`Playbook not found for pushId: ${pushId}`)
    }

    // 3. 检查剧本生成状态
    if (push.playbookStatus === 'generating') {
      throw new HttpException('Playbook is being generated', HttpStatus.ACCEPTED)
    }

    if (push.playbookStatus === 'failed') {
      throw new HttpException(
        'Playbook generation failed. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }

    // 4. 默认：剧本不存在
    throw new NotFoundException(`Playbook not found for pushId: ${pushId}`)
  }

  /**
   * 提交自查清单
   *
   * AR12 Layer 2 Defense: 验证push属于用户组织
   *
   * @param pushId - 推送ID
   * @param userId - 用户ID
   * @param userOrganizationId - 用户组织ID
   * @param submitDto - 提交数据
   * @returns 提交记录
   * @throws ForbiddenException - push不属于用户组织
   * @throws HttpException - 数据验证失败
   */
  async submitChecklist(
    pushId: string,
    userId: string,
    userOrganizationId: string,
    submitDto: SubmitChecklistDto,
  ): Promise<ComplianceChecklistSubmission> {
    // AR12 Layer 2 Defense: 验证push属于用户组织
    await this.validatePushAccess(pushId, userOrganizationId)

    // 1. 获取剧本进行验证
    const playbook = await this.playbookRepo.findOne({
      where: { pushId },
    })

    if (!playbook) {
      throw new HttpException('Playbook not found', HttpStatus.NOT_FOUND)
    }

    // 2. 验证数据完整性
    this.validateSubmission(playbook, submitDto)

    // 3. 查找现有提交
    let submission = await this.submissionRepo.findOne({
      where: { pushId, userId },
    })

    if (submission) {
      // 3.1 更新现有提交
      submission.checkedItems = submitDto.checkedItems
      submission.uncheckedItems = submitDto.uncheckedItems
      submission.notes = submitDto.notes
      submission.organizationId = userOrganizationId // AR12 Layer 3: 设置组织ID
      submission.updatedAt = new Date()
    } else {
      // 3.2 创建新提交
      submission = this.submissionRepo.create({
        pushId,
        userId,
        organizationId: userOrganizationId, // AR12 Layer 3: 设置组织ID
        checkedItems: submitDto.checkedItems,
        uncheckedItems: submitDto.uncheckedItems,
        notes: submitDto.notes,
        updatedAt: new Date(),
      })
    }

    // 4. 保存提交
    const savedSubmission = await this.submissionRepo.save(submission)

    // 5. 如果所有项都勾选，更新push的checklistCompletedAt
    if (submitDto.uncheckedItems.length === 0) {
      await this.pushRepo.update(
        { id: pushId },
        { checklistCompletedAt: new Date() },
      )
    }

    return savedSubmission
  }

  /**
   * 获取自查清单提交记录
   *
   * AR12 Layer 2 Defense: 验证push属于用户组织
   *
   * @param pushId - 推送ID
   * @param userId - 用户ID
   * @param userOrganizationId - 用户组织ID
   * @returns 提交记录，不存在则返回null
   * @throws ForbiddenException - push不属于用户组织
   */
  async getChecklistSubmission(
    pushId: string,
    userId: string,
    userOrganizationId: string,
  ): Promise<ComplianceChecklistSubmission | null> {
    // AR12 Layer 2 Defense: 验证push属于用户组织
    await this.validatePushAccess(pushId, userOrganizationId)

    return this.submissionRepo.findOne({
      where: { pushId, userId },
    })
  }

  /**
   * 验证提交数据完整性
   *
   * @param playbook - 剧本
   * @param submitDto - 提交数据
   * @throws HttpException - 验证失败
   */
  private validateSubmission(
    playbook: CompliancePlaybook,
    submitDto: SubmitChecklistDto,
  ): void {
    // 1. 检查重复项
    const allItemIds = [...submitDto.checkedItems, ...submitDto.uncheckedItems]
    const uniqueItemIds = new Set(allItemIds)

    if (allItemIds.length !== uniqueItemIds.size) {
      throw new HttpException(
        'Duplicate item IDs across checkedItems and uncheckedItems',
        HttpStatus.BAD_REQUEST,
      )
    }

    // 2. 检查项数量匹配
    const playbookItemIds = playbook.checklistItems.map((item) => item.id)
    const submittedItemIds = new Set(allItemIds)

    const invalidItems = allItemIds.filter((id) => !playbookItemIds.includes(id))

    if (invalidItems.length > 0) {
      throw new HttpException(
        `Invalid item IDs: ${invalidItems.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      )
    }

    // 3. 检查所有playbook项都被提交
    const missingItems = playbookItemIds.filter((id) => !submittedItemIds.has(id))

    if (missingItems.length > 0) {
      throw new HttpException(
        `Missing items: ${missingItems.join(', ')}. All checklist items must be submitted.`,
        HttpStatus.BAD_REQUEST,
      )
    }
  }
}
