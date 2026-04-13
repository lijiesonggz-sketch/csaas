import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Repository } from 'typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { FailureMode } from '../../../database/entities/failure-mode.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import {
  CreateFailureModeControlMapDto,
  CreateFailureModeDto,
  CreateTaxonomyFailureModeMapDto,
  QueryFailureModeDto,
  UpdateFailureModeDto,
} from '../dto/failure-mode.dto'

@Injectable()
export class FailureModeService {
  constructor(
    @InjectRepository(FailureMode)
    private readonly failureModeRepo: Repository<FailureMode>,
    @InjectRepository(TaxonomyFailureModeMap)
    private readonly taxonomyFailureModeMapRepo: Repository<TaxonomyFailureModeMap>,
    @InjectRepository(FailureModeControlMap)
    private readonly failureModeControlMapRepo: Repository<FailureModeControlMap>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repo: Repository<TaxonomyL2>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepo: Repository<ControlPoint>,
  ) {}

  // ===========================================================================
  // findAll — 分页 + category/status 过滤 + keyword 搜索
  // ===========================================================================

  async findAll(query: QueryFailureModeDto) {
    const where: Record<string, unknown> = {}

    if (query.category) {
      where.category = query.category
    }

    if (query.status) {
      where.status = query.status
    }

    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const findOptions: Record<string, unknown> = {
      order: { failureModeCode: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      findOptions.where = [
        { ...where, failureModeCode: keyword },
        { ...where, name: keyword },
        { ...where, description: keyword },
      ]
    } else {
      findOptions.where = where
    }

    const [items, total] = await this.failureModeRepo.findAndCount(
      findOptions as Parameters<typeof this.failureModeRepo.findAndCount>[0],
    )

    return { items, total, page, limit }
  }

  // ===========================================================================
  // findById — 含 taxonomyMaps + controlMaps 关联数据
  // ===========================================================================

  async findById(failureModeId: string) {
    const entity = await this.failureModeRepo.findOne({
      where: { failureModeId },
      relations: [
        'taxonomyFailureModeMaps',
        'taxonomyFailureModeMaps.taxonomyL2',
        'failureModeControlMaps',
        'failureModeControlMaps.controlPoint',
      ],
    })

    if (!entity) {
      throw new NotFoundException(`failure_mode ${failureModeId} not found`)
    }

    const taxonomyMaps = (entity.taxonomyFailureModeMaps ?? []).map((m) => ({
      id: m.id,
      l2Code: m.l2Code,
      l2Name: m.taxonomyL2?.l2Name ?? null,
      notes: m.notes,
    }))

    const controlMaps = (entity.failureModeControlMaps ?? []).map((m) => ({
      id: m.id,
      controlId: m.controlId,
      controlCode: m.controlPoint?.controlCode ?? '',
      controlName: m.controlPoint?.controlName ?? '',
      relevance: m.relevance,
      maturityLevel: m.controlPoint?.maturityLevel ?? null,
      authoritativeScore: m.controlPoint?.authoritativeScore ?? null,
    }))

    return {
      failureModeId: entity.failureModeId,
      failureModeCode: entity.failureModeCode,
      name: entity.name,
      description: entity.description,
      category: entity.category,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      taxonomyMaps,
      controlMaps,
    }
  }

  // ===========================================================================
  // create — 唯一性校验 (failureModeCode)
  // ===========================================================================

  async create(dto: CreateFailureModeDto): Promise<FailureMode> {
    await this.assertUniqueFailureModeCode(dto.failureModeCode)

    return this.failureModeRepo.save(
      this.failureModeRepo.create({
        failureModeCode: dto.failureModeCode,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        status: dto.status ?? 'ACTIVE',
      }),
    )
  }

  // ===========================================================================
  // update — 唯一性校验 (排除自身) + 空值校验
  // ===========================================================================

  async update(failureModeId: string, dto: UpdateFailureModeDto): Promise<FailureMode> {
    this.assertNoNullUpdates(dto, ['failureModeCode', 'name', 'category', 'status'])

    const existing = await this.findFailureMode(failureModeId)
    const nextCode = dto.failureModeCode ?? existing.failureModeCode

    await this.assertUniqueFailureModeCode(nextCode, failureModeId)

    Object.assign(existing, {
      failureModeCode: nextCode,
      name: dto.name ?? existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      category: dto.category ?? existing.category,
      status: dto.status ?? existing.status,
    })

    return this.failureModeRepo.save(existing)
  }

  // ===========================================================================
  // findByL2Code — JOIN 查询 + l2Code 不存在处理
  // ===========================================================================

  async findByL2Code(l2Code: string, query: QueryFailureModeDto) {
    const l2 = await this.taxonomyL2Repo.findOne({ where: { l2Code } })
    if (!l2) {
      throw new NotFoundException(`taxonomy_l2 ${l2Code} not found`)
    }

    const qb = this.failureModeRepo.createQueryBuilder('fm')
      .innerJoin('fm.taxonomyFailureModeMaps', 'tfm')
      .where('tfm.l2_code = :l2Code', { l2Code })
      .andWhere('fm.status = :status', { status: query.status ?? 'ACTIVE' })

    qb.orderBy('fm.failure_mode_code', 'ASC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 20))
      .take(query.limit ?? 20)

    const [items, total] = await qb.getManyAndCount()

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  // ===========================================================================
  // findControlPointsByFailureMode — 含 relevance + 治理字段
  // ===========================================================================

  async findControlPointsByFailureMode(failureModeId: string, query: QueryFailureModeDto) {
    await this.findFailureMode(failureModeId)

    const qb = this.failureModeControlMapRepo.createQueryBuilder('fcm')
      .leftJoinAndSelect('fcm.controlPoint', 'cp')
      .where('fcm.failure_mode_id = :failureModeId', { failureModeId })
      .andWhere('cp.maturity_level != :retired', { retired: 'retired' })
      .orderBy('fcm.relevance', 'ASC')
      .addOrderBy('cp.authoritative_score', 'DESC')
      .addOrderBy('cp.control_code', 'ASC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 20))
      .take(query.limit ?? 20)

    const [rawItems, total] = await qb.getManyAndCount()

    const items = rawItems.map((item) => ({
      id: item.id,
      controlId: item.controlId,
      controlCode: item.controlPoint?.controlCode ?? '',
      controlName: item.controlPoint?.controlName ?? '',
      relevance: item.relevance,
      maturityLevel: item.controlPoint?.maturityLevel ?? null,
      authoritativeScore: item.controlPoint?.authoritativeScore ?? null,
    }))

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  // ===========================================================================
  // createTaxonomyMap — 为失效模式添加分类映射
  // ===========================================================================

  async createTaxonomyMap(failureModeId: string, dto: CreateTaxonomyFailureModeMapDto) {
    await this.findFailureMode(failureModeId)

    const l2 = await this.taxonomyL2Repo.findOne({ where: { l2Code: dto.l2Code } })
    if (!l2) {
      throw new NotFoundException(`taxonomy_l2 ${dto.l2Code} not found`)
    }

    const existing = await this.taxonomyFailureModeMapRepo.findOne({
      where: { failureModeId, l2Code: dto.l2Code },
    })
    if (existing) {
      throw new ConflictException(
        `taxonomy-failure_mode mapping already exists for failureMode ${failureModeId} + l2Code ${dto.l2Code}`,
      )
    }

    return this.taxonomyFailureModeMapRepo.save(
      this.taxonomyFailureModeMapRepo.create({
        failureModeId,
        l2Code: dto.l2Code,
        notes: dto.notes ?? null,
      }),
    )
  }

  // ===========================================================================
  // createControlMap — 为失效模式添加控制点映射
  // ===========================================================================

  async createControlMap(failureModeId: string, dto: CreateFailureModeControlMapDto) {
    await this.findFailureMode(failureModeId)

    const cp = await this.controlPointRepo.findOne({ where: { controlId: dto.controlId } })
    if (!cp) {
      throw new NotFoundException(`control_point ${dto.controlId} not found`)
    }

    const existing = await this.failureModeControlMapRepo.findOne({
      where: { failureModeId, controlId: dto.controlId },
    })
    if (existing) {
      throw new ConflictException(
        `failure_mode-control mapping already exists for failureMode ${failureModeId} + control ${dto.controlId}`,
      )
    }

    return this.failureModeControlMapRepo.save(
      this.failureModeControlMapRepo.create({
        failureModeId,
        controlId: dto.controlId,
        relevance: dto.relevance,
        notes: dto.notes ?? null,
      }),
    )
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private async findFailureMode(failureModeId: string): Promise<FailureMode> {
    const entity = await this.failureModeRepo.findOne({ where: { failureModeId } })

    if (!entity) {
      throw new NotFoundException(`failure_mode ${failureModeId} not found`)
    }

    return entity
  }

  private async assertUniqueFailureModeCode(
    failureModeCode: string,
    currentId?: string,
  ) {
    const existing = await this.failureModeRepo.findOne({ where: { failureModeCode } })

    if (existing && existing.failureModeId !== currentId) {
      throw new ConflictException(
        `failure_mode_code ${failureModeCode} already exists`,
      )
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
