import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Repository } from 'typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import {
  REMEDIATION_ACTION_PRIORITIES,
  RemediationAction,
} from '../../../database/entities/remediation-action.entity'
import {
  CreateRemediationActionDto,
  QueryRemediationActionDto,
  UpdateRemediationActionDto,
} from '../dto/remediation-action.dto'

type RemediationActionView = {
  actionId: string
  controlId: string
  actionCode: string
  actionTitle: string
  actionDesc: string | null
  priorityDefault: string
  effortLevel: string | null
  expectedBenefit: string | null
  outputTemplate: Record<string, unknown> | null
  status: string
}

@Injectable()
export class RemediationActionService {
  constructor(
    @InjectRepository(RemediationAction)
    private readonly remediationActionRepository: Repository<RemediationAction>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
  ) {}

  async findAll(query: QueryRemediationActionDto) {
    const where: Record<string, unknown> = {}

    if (query.controlId) {
      where.controlId = query.controlId
    }

    if (query.priorityDefault) {
      where.priorityDefault = query.priorityDefault
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      const [items, total] = await this.remediationActionRepository.findAndCount({
        where: [
          { ...where, actionCode: keyword },
          { ...where, actionTitle: keyword },
          { ...where, actionDesc: keyword },
        ],
        order: { actionCode: 'ASC' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      })

      return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
    }

    const [items, total] = await this.remediationActionRepository.findAndCount({
      where,
      order: { actionCode: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async create(dto: CreateRemediationActionDto): Promise<RemediationAction> {
    await this.assertControlPointExists(dto.controlId)
    await this.assertUniqueActionCode(dto.actionCode)

    return this.remediationActionRepository.save(
      this.remediationActionRepository.create({
        controlId: dto.controlId,
        actionCode: dto.actionCode,
        actionTitle: dto.actionTitle,
        actionDesc: dto.actionDesc ?? null,
        priorityDefault: dto.priorityDefault ?? 'MEDIUM',
        effortLevel: dto.effortLevel ?? null,
        expectedBenefit: dto.expectedBenefit ?? null,
        ownerRoleHint: dto.ownerRoleHint ?? null,
        outputTemplate: dto.outputTemplate ?? null,
        status: dto.status ?? 'ACTIVE',
      }),
    )
  }

  async update(actionId: string, dto: UpdateRemediationActionDto): Promise<RemediationAction> {
    this.assertNoNullUpdates(dto, ['controlId', 'actionCode', 'actionTitle', 'priorityDefault', 'status'])

    const existing = await this.findRemediationAction(actionId)
    const nextControlId = dto.controlId ?? existing.controlId
    const nextActionCode = dto.actionCode ?? existing.actionCode

    await this.assertControlPointExists(nextControlId)
    await this.assertUniqueActionCode(nextActionCode, actionId)

    Object.assign(existing, {
      controlId: nextControlId,
      actionCode: nextActionCode,
      actionTitle: dto.actionTitle ?? existing.actionTitle,
      actionDesc: dto.actionDesc ?? existing.actionDesc,
      priorityDefault: dto.priorityDefault ?? existing.priorityDefault,
      effortLevel: dto.effortLevel ?? existing.effortLevel,
      expectedBenefit: dto.expectedBenefit ?? existing.expectedBenefit,
      ownerRoleHint: dto.ownerRoleHint ?? existing.ownerRoleHint,
      outputTemplate: dto.outputTemplate ?? existing.outputTemplate,
      status: dto.status ?? existing.status,
    })

    return this.remediationActionRepository.save(existing)
  }

  async findByControlId(controlId: string): Promise<{
    controlId: string
    remediations: RemediationActionView[]
  }> {
    await this.findControlPoint(controlId)

    const items = await this.remediationActionRepository
      .createQueryBuilder('remediation')
      .where('remediation.control_id = :controlId', { controlId })
      .andWhere('remediation.status = :status', { status: 'ACTIVE' })
      .getMany()

    const priorityRank = new Map(
      REMEDIATION_ACTION_PRIORITIES.map((value, index) => [value, index] as const),
    )

    const remediations = items
      .slice()
      .sort((left, right) => {
        const priorityDiff =
          (priorityRank.get(left.priorityDefault) ?? Number.MAX_SAFE_INTEGER) -
          (priorityRank.get(right.priorityDefault) ?? Number.MAX_SAFE_INTEGER)

        if (priorityDiff !== 0) {
          return priorityDiff
        }

        return left.actionCode.localeCompare(right.actionCode)
      })
      .map((item) => ({
        actionId: item.actionId,
        controlId: item.controlId,
        actionCode: item.actionCode,
        actionTitle: item.actionTitle,
        actionDesc: item.actionDesc ?? null,
        priorityDefault: item.priorityDefault,
        effortLevel: item.effortLevel ?? null,
        expectedBenefit: item.expectedBenefit ?? null,
        outputTemplate: item.outputTemplate ?? null,
        status: item.status,
      }))

    return {
      controlId,
      remediations,
    }
  }

  private async findRemediationAction(actionId: string): Promise<RemediationAction> {
    const remediationAction = await this.remediationActionRepository.findOne({
      where: { actionId },
    })

    if (!remediationAction) {
      throw new NotFoundException(`remediation_action ${actionId} not found`)
    }

    return remediationAction
  }

  private async findControlPoint(controlId: string): Promise<ControlPoint> {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    return controlPoint
  }

  private async assertControlPointExists(controlId: string) {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new BadRequestException(`control_point ${controlId} does not exist`)
    }
  }

  private async assertUniqueActionCode(actionCode: string, currentActionId?: string) {
    const existing = await this.remediationActionRepository.findOne({ where: { actionCode } })

    if (existing && existing.actionId !== currentActionId) {
      throw new ConflictException(`action_code ${actionCode} already exists`)
    }
  }

  private assertNoNullUpdates(dto: object, nonNullableFields: readonly string[]) {
    const record = dto as Record<string, unknown>

    for (const field of nonNullableFields) {
      if (record[field] === null) {
        throw new BadRequestException(`${field} cannot be null`)
      }
    }
  }
}
