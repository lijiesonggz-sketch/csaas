import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository } from 'typeorm'
import { ControlEvidenceMap } from '../../../database/entities/control-evidence-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { ControlPackItem } from '../../../database/entities/control-pack-item.entity'
import { EvidenceType } from '../../../database/entities/evidence-type.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { FailureMode } from '../../../database/entities/failure-mode.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import {
  CreateControlPointDto,
  QueryControlPointDto,
  UpdateControlPointDto,
  UpdateControlPointStatusDto,
} from '../dto/control-point.dto'

/** findByL2CodeWithFullChain 返回的完整链路结构 */
export interface FullChainResult {
  l2Code: string
  l2Name: string
  failureModes: {
    failureModeId: string
    failureModeCode: string
    name: string
    category: string
    controlPoints: {
      controlId: string
      controlCode: string
      controlName: string
      maturityLevel: string
      authoritativeScore: number | null
      relevance: 'PRIMARY' | 'SECONDARY'
      evidenceTypes: {
        evidenceId: string
        evidenceCode: string
        evidenceName: string
        evidenceCategory: string | null
        autoCollectable: boolean
        requiredLevel: string
        frequency: string | null
      }[]
    }[]
  }[]
}

/** maturity_level 排序优先级映射 */
const MATURITY_ORDER: Record<string, number> = {
  hard: 0,
  'draft-hard': 1,
  candidate: 2,
  retired: 3,
}

@Injectable()
export class ControlPointService {
  constructor(
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
    @InjectRepository(FailureModeControlMap)
    private readonly failureModeControlMapRepository: Repository<FailureModeControlMap>,
    @InjectRepository(TaxonomyFailureModeMap)
    private readonly taxonomyFailureModeMapRepository: Repository<TaxonomyFailureModeMap>,
    @InjectRepository(ControlPackItem)
    private readonly controlPackItemRepository: Repository<ControlPackItem>,
  ) {}

  async findAll(query: QueryControlPointDto): Promise<{
    items: ControlPoint[]
    total: number
    page: number
    limit: number
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const builder = this.controlPointRepository.createQueryBuilder('control')

    if (query.status) {
      builder.andWhere('control.status = :status', { status: query.status })
    }

    if (query.l1Code) {
      builder.andWhere('control.l1_code = :l1Code', { l1Code: query.l1Code })
    }

    if (query.l2Code) {
      builder.andWhere('control.l2_code = :l2Code', { l2Code: query.l2Code })
    }

    if (query.controlFamily) {
      builder.andWhere('control.control_family = :controlFamily', {
        controlFamily: query.controlFamily,
      })
    }

    if (query.keyword) {
      const keyword = `%${query.keyword}%`
      builder.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where('control.control_name ILIKE :keyword', { keyword })
            .orWhere('control.control_code ILIKE :keyword', { keyword })
            .orWhere('control.control_desc ILIKE :keyword', { keyword })
            .orWhere('control.canonical_theme ILIKE :keyword', { keyword })
            .orWhere(
              `EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(COALESCE(control.aliases, '[]'::jsonb)) alias
                WHERE alias ILIKE :keyword
              )`,
              { keyword },
            )
            .orWhere(
              `EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(COALESCE(control.keywords, '[]'::jsonb)) keyword_item
                WHERE keyword_item ILIKE :keyword
              )`,
              { keyword },
            )
        }),
      )
    }

    // --- KG V2 新增过滤条件 (Story 1-5) ---

    if (query.originType) {
      builder.andWhere('control.origin_type = :originType', { originType: query.originType })
    }

    if (query.maturityLevel) {
      builder.andWhere('control.maturity_level = :maturityLevel', { maturityLevel: query.maturityLevel })
    }

    if (query.applicableSector) {
      builder.andWhere(
        `(control.applicable_sector @> ARRAY[:sector]::varchar[] OR control.applicable_sector @> ARRAY['通用']::varchar[] OR control.applicable_sector = '{}')`,
        { sector: query.applicableSector },
      )
    }

    if (query.failureModeId) {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM failure_mode_control_maps fcm WHERE fcm.control_id = control.control_id AND fcm.failure_mode_id = :failureModeId)`,
        { failureModeId: query.failureModeId },
      )
    }

    // --- KG V2 排序: maturity_level 优先级 + authoritative_score 降序 + control_code 升序 ---

    const [items, total] = await builder
      .orderBy(
        `CASE "control"."maturity_level"
          WHEN 'hard' THEN 0
          WHEN 'draft-hard' THEN 1
          WHEN 'candidate' THEN 2
          WHEN 'retired' THEN 3
          ELSE 4 END`,
        'ASC',
      )
      .addOrderBy('control.authoritativeScore', 'DESC')
      .addOrderBy('control.controlCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    return {
      items,
      total,
      page,
      limit,
    }
  }

  async findOne(controlId: string): Promise<ControlPoint> {
    const controlPoint = await this.controlPointRepository.findOne({
      where: { controlId },
    })

    if (!controlPoint) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    return controlPoint
  }

  /**
   * KG V2 全链路查询 (Story 1-5)
   * 一次性 JOIN: taxonomy_l2 → taxonomy_failure_mode_maps → failure_modes → failure_mode_control_maps → control_points → control_evidence_maps → evidence_types
   * 返回按 failure_mode 分组的完整推理链路
   */
  async findByL2CodeWithFullChain(l2Code: string): Promise<FullChainResult> {
    // 验证 l2Code 存在
    const taxonomyL2 = await this.taxonomyL2Repository.findOne({ where: { l2Code } })
    if (!taxonomyL2) {
      throw new NotFoundException(`taxonomy_l2 ${l2Code} not found`)
    }

    // 构建多表 JOIN 查询
    const rawRows = await this.controlPointRepository
      .createQueryBuilder('cp')
      .select('tl2.l2_code', 'l2_code')
      .addSelect('tl2.l2_name', 'l2_name')
      .addSelect('fm.failure_mode_id', 'failure_mode_id')
      .addSelect('fm.failure_mode_code', 'failure_mode_code')
      .addSelect('fm.name', 'fm_name')
      .addSelect('fm.category', 'fm_category')
      .addSelect('cp.control_id', 'control_id')
      .addSelect('cp.control_code', 'control_code')
      .addSelect('cp.control_name', 'control_name')
      .addSelect('cp.maturity_level', 'maturity_level')
      .addSelect('cp.authoritative_score', 'authoritative_score')
      .addSelect('fcm.relevance', 'relevance')
      .addSelect('cem.evidence_id', 'evidence_id')
      .addSelect('et.evidence_code', 'evidence_code')
      .addSelect('et.evidence_name', 'evidence_name')
      .addSelect('et.evidence_category', 'evidence_category')
      .addSelect('et.auto_collectable', 'auto_collectable')
      .addSelect('cem.required_level', 'required_level')
      .addSelect('cem.frequency', 'frequency')
      .innerJoin('failure_mode_control_maps', 'fcm', 'fcm.control_id = cp.control_id')
      .innerJoin('failure_modes', 'fm', 'fm.failure_mode_id = fcm.failure_mode_id')
      .innerJoin('taxonomy_failure_mode_maps', 'tfm', 'tfm.failure_mode_id = fm.failure_mode_id')
      .innerJoin('taxonomy_l2', 'tl2', 'tl2.l2_code = tfm.l2_code')
      .leftJoin('control_evidence_maps', 'cem', 'cem.control_id = cp.control_id')
      .leftJoin('evidence_types', 'et', 'et.evidence_id = cem.evidence_id')
      .where('tl2.l2_code = :l2Code', { l2Code })
      .andWhere('fm.status = :fmStatus', { fmStatus: 'ACTIVE' })
      .andWhere('cp.status = :cpStatus', { cpStatus: 'ACTIVE' })
      .andWhere('cp.maturity_level != :retiredLevel', { retiredLevel: 'retired' })
      .orderBy(
        `CASE cp.maturity_level
          WHEN 'hard' THEN 0
          WHEN 'draft-hard' THEN 1
          WHEN 'candidate' THEN 2
          ELSE 3 END`,
        'ASC',
      )
      .addOrderBy('cp.authoritative_score', 'DESC')
      .getRawMany()

    // 按 failure_mode 分组
    const failureModeMap = new Map<string, {
      failureModeId: string
      failureModeCode: string
      name: string
      category: string
      controlPoints: Map<string, {
        controlId: string
        controlCode: string
        controlName: string
        maturityLevel: string
        authoritativeScore: number | null
        relevance: 'PRIMARY' | 'SECONDARY'
        evidenceTypes: {
          evidenceId: string
          evidenceCode: string
          evidenceName: string
          evidenceCategory: string | null
          autoCollectable: boolean
          requiredLevel: string
          frequency: string | null
        }[]
      }>
    }>()

    for (const row of rawRows) {
      const fmKey = row.failure_mode_id

      if (!failureModeMap.has(fmKey)) {
        failureModeMap.set(fmKey, {
          failureModeId: row.failure_mode_id,
          failureModeCode: row.failure_mode_code,
          name: row.fm_name,
          category: row.fm_category,
          controlPoints: new Map(),
        })
      }

      const fmEntry = failureModeMap.get(fmKey)!
      const cpKey = row.control_id

      if (!fmEntry.controlPoints.has(cpKey)) {
        fmEntry.controlPoints.set(cpKey, {
          controlId: row.control_id,
          controlCode: row.control_code,
          controlName: row.control_name,
          maturityLevel: row.maturity_level,
          authoritativeScore: row.authoritative_score != null ? Number(row.authoritative_score) : null,
          relevance: row.relevance,
          evidenceTypes: [],
        })
      }

      // 如果有 evidence 数据，添加到 evidenceTypes
      if (row.evidence_id) {
        const cpEntry = fmEntry.controlPoints.get(cpKey)!
        cpEntry.evidenceTypes.push({
          evidenceId: row.evidence_id,
          evidenceCode: row.evidence_code,
          evidenceName: row.evidence_name,
          evidenceCategory: row.evidence_category,
          autoCollectable: row.auto_collectable,
          requiredLevel: row.required_level,
          frequency: row.frequency,
        })
      }
    }

    // 转换为数组并按 maturity_level 排序 controlPoints
    const failureModes = Array.from(failureModeMap.values()).map((fm) => ({
      failureModeId: fm.failureModeId,
      failureModeCode: fm.failureModeCode,
      name: fm.name,
      category: fm.category,
      controlPoints: Array.from(fm.controlPoints.values()).sort((a, b) => {
        const orderA = MATURITY_ORDER[a.maturityLevel] ?? 99
        const orderB = MATURITY_ORDER[b.maturityLevel] ?? 99
        if (orderA !== orderB) return orderA - orderB
        return (b.authoritativeScore ?? 0) - (a.authoritativeScore ?? 0)
      }),
    }))

    return {
      l2Code,
      l2Name: taxonomyL2.l2Name,
      failureModes,
    }
  }

  async create(dto: CreateControlPointDto): Promise<ControlPoint> {
    await this.assertTaxonomyRelation(dto.l1Code, dto.l2Code)
    await this.assertUniqueConstraints(dto.controlCode, dto.controlName)

    // CreateControlPointDto 没有 maturityLevel 字段，entity DB 默认 'candidate'，
    // 因此新建控制点不可能直接是 hard — 无需 pack 校验

    return this.controlPointRepository.save(this.controlPointRepository.create(dto))
  }

  async update(controlId: string, dto: UpdateControlPointDto): Promise<ControlPoint> {
    this.assertNoNullUpdates(dto)

    const existing = await this.findOne(controlId)
    const nextL1Code = dto.l1Code ?? existing.l1Code
    const nextL2Code = dto.l2Code ?? existing.l2Code
    const nextControlCode = dto.controlCode ?? existing.controlCode
    const nextControlName = dto.controlName ?? existing.controlName

    await this.assertTaxonomyRelation(nextL1Code, nextL2Code)
    await this.assertUniqueConstraints(nextControlCode, nextControlName, controlId)

    Object.assign(existing, dto, {
      l1Code: nextL1Code,
      l2Code: nextL2Code,
      controlCode: nextControlCode,
      controlName: nextControlName,
    })

    // Story 2.1: if updating to hard, validate pack association
    if (existing.maturityLevel === 'hard') {
      await this.assertHardControlHasPackAssociation(controlId)
    }

    return this.controlPointRepository.save(existing)
  }

  async updateStatus(controlId: string, dto: UpdateControlPointStatusDto): Promise<ControlPoint> {
    const existing = await this.findOne(controlId)
    existing.status = dto.status
    return this.controlPointRepository.save(existing)
  }

  private async assertTaxonomyRelation(l1Code: string, l2Code: string): Promise<void> {
    const [l1, l2] = await Promise.all([
      this.taxonomyL1Repository.findOne({ where: { l1Code } }),
      this.taxonomyL2Repository.findOne({ where: { l2Code } }),
    ])

    if (!l1) {
      throw new BadRequestException(`taxonomy_l1 ${l1Code} does not exist`)
    }

    if (!l2) {
      throw new BadRequestException(`taxonomy_l2 ${l2Code} does not exist`)
    }

    if (l2.l1Code !== l1Code) {
      throw new BadRequestException('Invalid l1Code/l2Code hierarchy relation')
    }
  }

  /** Story 2.1: hard control point 必须至少关联一个 control_pack */
  private async assertHardControlHasPackAssociation(controlId: string): Promise<void> {
    const packCount = await this.controlPackItemRepository.count({
      where: { controlId },
    })

    if (packCount === 0) {
      throw new BadRequestException('hard control point 必须关联至少一个 control_pack')
    }
  }

  private assertNoNullUpdates(dto: UpdateControlPointDto): void {
    const nonNullableFields = [
      'controlCode',
      'controlName',
      'l1Code',
      'l2Code',
      'canonicalTheme',
      'controlFamily',
      'controlType',
      'mandatoryDefault',
      'riskLevelDefault',
      'status',
    ] as const

    for (const field of nonNullableFields) {
      if (dto[field] === null) {
        throw new BadRequestException(`${field} cannot be null`)
      }
    }
  }

  private async assertUniqueConstraints(
    controlCode: string,
    controlName: string,
    currentControlId?: string,
  ): Promise<void> {
    const [existingCode, existingName] = await Promise.all([
      this.controlPointRepository.findOne({ where: { controlCode } }),
      this.controlPointRepository.findOne({ where: { controlName } }),
    ])

    if (existingCode && existingCode.controlId !== currentControlId) {
      throw new ConflictException(`control_code ${controlCode} already exists`)
    }

    if (existingName && existingName.controlId !== currentControlId) {
      throw new ConflictException(`control_name ${controlName} already exists`)
    }
  }
}
