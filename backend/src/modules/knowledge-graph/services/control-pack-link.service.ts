import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, Repository } from 'typeorm'
import { ControlPack } from '../../../database/entities/control-pack.entity'
import { ControlPackItem } from '../../../database/entities/control-pack-item.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { PackResolverService } from '../../applicability-engine/services/pack-resolver.service'
import {
  CreateControlPackItemDto,
  QueryControlApplicabilityContextDto,
  QueryControlPackItemDto,
  UpdateControlPackItemDto,
} from '../dto/control-pack-link.dto'

type ControlPackLinkView = {
  id: string
  packId: string
  packCode: string
  packName: string | null
  packType: string | null
  packVersion: string | null
  itemRole: string
  priority: number
}

type ControlPackCatalogView = {
  packId: string
  packCode: string
  packName: string | null
  packType: string | null
  packVersion: string | null
}

type ControlApplicabilityContextView = {
  controlId: string
  organizationId: string
  matched: boolean
  linkedPacks: ControlPackLinkView[]
  matchedPacks: Array<{
    packCode: string
    packName: string | null
    packType: string | null
  }>
  matchedRules: string[]
  priority: string | null
  mandatory: boolean
  reasons: string[]
  questionPackCodes: string[]
  evidencePackCodes: string[]
  remediationPackCodes: string[]
}

@Injectable()
export class ControlPackLinkService {
  constructor(
    @InjectRepository(ControlPackItem)
    private readonly controlPackItemRepository: Repository<ControlPackItem>,
    @InjectRepository(ControlPack)
    private readonly controlPackRepository: Repository<ControlPack>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    private readonly packResolverService: PackResolverService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryControlPackItemDto) {
    const where: Record<string, unknown> = {}

    if (query.packId) {
      where.packId = query.packId
    }

    if (query.controlId) {
      where.controlId = query.controlId
    }

    if (query.itemRole) {
      where.itemRole = query.itemRole
    }

    const [items, total] = await this.controlPackItemRepository.findAndCount({
      where,
      order: { priority: 'ASC', id: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async findAllPacks(): Promise<ControlPackCatalogView[]> {
    const items = await this.controlPackRepository.find({
      where: { status: 'ACTIVE' },
      order: { priority: 'ASC', packCode: 'ASC' },
    })

    return items.map((item) => ({
      packId: item.packId,
      packCode: item.packCode,
      packName: item.packName ?? null,
      packType: item.packType ?? null,
      packVersion: item.maturityLevel ?? null,
    }))
  }

  async create(dto: CreateControlPackItemDto): Promise<ControlPackItem> {
    await this.assertPackIsActive(dto.packId)
    await this.assertControlPointExists(dto.controlId)
    await this.assertUniqueControlPackItem(dto.packId, dto.controlId)

    const entity = this.controlPackItemRepository.create({
      packId: dto.packId,
      controlId: dto.controlId,
      itemRole: dto.itemRole ?? 'INCLUDE',
      priority: dto.priority ?? 100,
    })

    return this.controlPackItemRepository.save(entity)
  }

  async update(id: string, dto: UpdateControlPackItemDto): Promise<ControlPackItem> {
    this.assertNoNullUpdates(dto)
    return this.dataSource.transaction(async (manager) => {
      const packItemRepository = manager.getRepository(ControlPackItem)
      const existing = await this.findControlPackItemByRepository(packItemRepository, id)
      const nextPackId = dto.packId ?? existing.packId
      const nextControlId = dto.controlId ?? existing.controlId

      await this.assertPackIsActive(nextPackId)
      await this.assertControlPointExists(nextControlId)
      await this.assertUniqueControlPackItem(nextPackId, nextControlId, id)

      if (existing.controlId !== nextControlId) {
        await this.assertHardControlRetainsPack(manager, existing.controlId)
      }

      Object.assign(existing, {
        packId: nextPackId,
        controlId: nextControlId,
        itemRole: dto.itemRole ?? existing.itemRole,
        priority: dto.priority ?? existing.priority,
      })

      return packItemRepository.save(existing)
    })
  }

  async delete(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const packItemRepository = manager.getRepository(ControlPackItem)
      const existing = await this.findControlPackItemByRepository(packItemRepository, id)

      await this.assertHardControlRetainsPack(manager, existing.controlId)

      await packItemRepository.delete({ id })
      return { success: true as const, id }
    })
  }

  async findPackLinksByControlId(controlId: string): Promise<{
    controlId: string
    items: ControlPackLinkView[]
  }> {
    await this.findControlPoint(controlId)

    const items = await this.controlPackItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.controlPack', 'pack')
      .where('item.control_id = :controlId', { controlId })
      .orderBy('item.priority', 'ASC')
      .addOrderBy('pack.pack_code', 'ASC')
      .getMany()

    return {
      controlId,
      items: items.map((item) => ({
        id: item.id,
        packId: item.packId,
        packCode: item.controlPack?.packCode ?? '',
        packName: item.controlPack?.packName ?? null,
        packType: item.controlPack?.packType ?? null,
        packVersion: item.controlPack?.maturityLevel ?? null,
        itemRole: item.itemRole,
        priority: item.priority,
      })),
    }
  }

  async buildApplicabilityContext(
    controlId: string,
    query: QueryControlApplicabilityContextDto,
  ): Promise<ControlApplicabilityContextView> {
    const linkedPacks = await this.findPackLinksByControlId(controlId)
    const resolved = await this.packResolverService.resolveByOrganizationId(query.organizationId)
    const matchedControl = resolved.controls.find((control) => control.controlId === controlId)

    if (!matchedControl) {
      return {
        controlId,
        organizationId: query.organizationId,
        matched: false,
        linkedPacks: linkedPacks.items,
        matchedPacks: [],
        matchedRules: [],
        priority: null,
        mandatory: false,
        reasons: [],
        questionPackCodes: [],
        evidencePackCodes: [],
        remediationPackCodes: [],
      }
    }

    const matchedPackRecords = await this.findPacksByCodes(matchedControl.matchedPacks)
    const matchedPackMap = new Map(
      matchedPackRecords.map((pack) => [pack.packCode, pack] as const),
    )

    return {
      controlId,
      organizationId: query.organizationId,
      matched: true,
      linkedPacks: linkedPacks.items,
      matchedPacks: matchedControl.matchedPacks.map((packCode) => ({
        packCode,
        packName: matchedPackMap.get(packCode)?.packName ?? null,
        packType: matchedPackMap.get(packCode)?.packType ?? null,
      })),
      matchedRules: [...matchedControl.matchedRules],
      priority: matchedControl.priority,
      mandatory: matchedControl.mandatory,
      reasons: [...matchedControl.reasons],
      questionPackCodes: [...matchedControl.questionPackCodes],
      evidencePackCodes: [...matchedControl.evidencePackCodes],
      remediationPackCodes: [...matchedControl.remediationPackCodes],
    }
  }

  private async findPacksByCodes(packCodes: string[]): Promise<ControlPack[]> {
    if (packCodes.length === 0) {
      return []
    }

    return this.controlPackRepository.find({
      where: packCodes.map((packCode) => ({ packCode })),
    })
  }

  private async findControlPackItem(id: string): Promise<ControlPackItem> {
    const item = await this.controlPackItemRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException(`control_pack_item ${id} not found`)
    }

    return item
  }

  private async findControlPoint(controlId: string): Promise<ControlPoint> {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    return controlPoint
  }

  private async assertPackIsActive(packId: string): Promise<void> {
    const pack = await this.controlPackRepository.findOne({ where: { packId } })

    if (!pack) {
      throw new BadRequestException(`control_pack ${packId} does not exist`)
    }

    if (pack.status !== 'ACTIVE') {
      throw new BadRequestException(`control_pack ${packId} is not active`)
    }
  }

  private async assertControlPointExists(controlId: string): Promise<void> {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new BadRequestException(`control_point ${controlId} does not exist`)
    }
  }

  private async assertUniqueControlPackItem(
    packId: string,
    controlId: string,
    currentId?: string,
  ): Promise<void> {
    const existing = await this.controlPackItemRepository.findOne({
      where: { packId, controlId },
    })

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`control_pack_item ${packId}/${controlId} already exists`)
    }
  }

  private async assertHardControlRetainsPack(
    manager: EntityManager,
    controlId: string,
  ): Promise<void> {
    const controlPointRepository = manager.getRepository(ControlPoint)
    const controlPackItemRepository = manager.getRepository(ControlPackItem)

    const controlPoint = await controlPointRepository.findOne({
      where: { controlId },
      lock: { mode: 'pessimistic_write' },
    })

    if (!controlPoint) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    if (controlPoint.maturityLevel !== 'hard') {
      return
    }

    const packCount = await controlPackItemRepository.count({
      where: { controlId },
    })

    if (packCount <= 1) {
      throw new BadRequestException('hard control point 必须关联至少一个 control_pack')
    }
  }

  private async findControlPackItemByRepository(
    repository: Repository<ControlPackItem>,
    id: string,
  ): Promise<ControlPackItem> {
    const item = await repository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException(`control_pack_item ${id} not found`)
    }

    return item
  }

  private assertNoNullUpdates(dto: UpdateControlPackItemDto): void {
    const nonNullableFields = ['packId', 'controlId', 'itemRole', 'priority'] as const

    for (const field of nonNullableFields) {
      if (dto[field] === null) {
        throw new BadRequestException(`${field} cannot be null`)
      }
    }
  }
}
