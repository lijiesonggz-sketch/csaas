import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { TaxonomyFailureModeMap } from '../../../database/entities/taxonomy-failure-mode-map.entity'
import { FailureModeControlMap } from '../../../database/entities/failure-mode-control-map.entity'
import { ObligationControlMap } from '../../../database/entities/obligation-control-map.entity'
import {
  CreateTaxonomyL1Dto,
  CreateTaxonomyL2Dto,
  QueryTaxonomyTreeDto,
  UpdateTaxonomyL1Dto,
  UpdateTaxonomyL2Dto,
} from '../dto/taxonomy.dto'
import { ReasoningChainResponseDto } from '../dto/reasoning-chain.dto'

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
    @InjectRepository(TaxonomyFailureModeMap)
    private readonly taxonomyFailureModeMapRepository: Repository<TaxonomyFailureModeMap>,
    @InjectRepository(FailureModeControlMap)
    private readonly failureModeControlMapRepository: Repository<FailureModeControlMap>,
    @InjectRepository(ObligationControlMap)
    private readonly obligationControlMapRepository: Repository<ObligationControlMap>,
  ) {}

  async getTree(query: QueryTaxonomyTreeDto): Promise<
    Array<{
      l1Code: string
      l1Name: string
      sortOrder: number
      children: Array<TaxonomyL2 & { failureModeCount?: number }>
    }>
  > {
    const [l1Items, l2Items] = await Promise.all([
      this.taxonomyL1Repository.find({
        where: this.buildL1Where(query),
        order: { sortOrder: 'ASC', l1Code: 'ASC' },
      }),
      this.taxonomyL2Repository.find({
        where: this.buildL2Where(query),
        order: { sortOrder: 'ASC', l2Code: 'ASC' },
      }),
    ])

    const normalizedKeyword = query.keyword?.trim().toLocaleLowerCase()
    let filteredL1Items = l1Items
    let filteredL2Items = l2Items

    if (normalizedKeyword) {
      const directL1MatchCodes = new Set(
        l1Items
          .filter((item) => this.matchesKeyword(normalizedKeyword, item.l1Code, item.l1Name))
          .map((item) => item.l1Code),
      )

      filteredL2Items = l2Items.filter(
        (item) =>
          directL1MatchCodes.has(item.l1Code) ||
          this.matchesKeyword(normalizedKeyword, item.l2Code, item.l2Name),
      )

      const includedL1Codes = new Set([
        ...directL1MatchCodes,
        ...filteredL2Items.map((item) => item.l1Code),
      ])

      filteredL1Items = l1Items.filter((item) => includedL1Codes.has(item.l1Code))
    } else if (query.l2Code) {
      const includedL1Codes = new Set(l2Items.map((item) => item.l1Code))
      filteredL1Items = l1Items.filter((item) => includedL1Codes.has(item.l1Code))
    }

    // Fetch failure mode counts for all L2 items
    const l2Codes = filteredL2Items.map((item) => item.l2Code)
    let failureModeCounts = new Map<string, number>()

    if (l2Codes.length > 0) {
      const counts = await this.taxonomyFailureModeMapRepository
        .createQueryBuilder('tfm')
        .select('tfm.l2_code', 'l2Code')
        .addSelect('COALESCE(COUNT(DISTINCT tfm.failure_mode_id), 0)', 'count')
        .where('tfm.l2_code IN (:...l2Codes)', { l2Codes })
        .groupBy('tfm.l2_code')
        .getRawMany()

      failureModeCounts = new Map(
        counts.map((row) => [row.l2Code, parseInt(row.count, 10) || 0])
      )
    }

    const childrenByL1Code = new Map<string, Array<TaxonomyL2 & { failureModeCount?: number }>>()

    for (const item of filteredL2Items) {
      const current = childrenByL1Code.get(item.l1Code) ?? []
      current.push({
        ...item,
        failureModeCount: failureModeCounts.get(item.l2Code) ?? 0,
      })
      childrenByL1Code.set(item.l1Code, current)
    }

    return filteredL1Items.map((item) => ({
      l1Code: item.l1Code,
      l1Name: item.l1Name,
      sortOrder: item.sortOrder,
      children: childrenByL1Code.get(item.l1Code) ?? [],
    }))
  }

  async createL1(dto: CreateTaxonomyL1Dto): Promise<TaxonomyL1> {
    const existing = await this.taxonomyL1Repository.findOne({
      where: { l1Code: dto.l1Code },
    })

    if (existing) {
      throw new ConflictException(`taxonomy_l1 ${dto.l1Code} already exists`)
    }

    return this.taxonomyL1Repository.save(this.taxonomyL1Repository.create(dto))
  }

  async updateL1(l1Code: string, dto: UpdateTaxonomyL1Dto): Promise<TaxonomyL1> {
    const existing = await this.taxonomyL1Repository.findOne({
      where: { l1Code },
    })

    if (!existing) {
      throw new NotFoundException(`taxonomy_l1 ${l1Code} not found`)
    }

    Object.assign(existing, dto)
    return this.taxonomyL1Repository.save(existing)
  }

  async createL2(dto: CreateTaxonomyL2Dto): Promise<TaxonomyL2> {
    const existing = await this.taxonomyL2Repository.findOne({
      where: { l2Code: dto.l2Code },
    })

    if (existing) {
      throw new ConflictException(`taxonomy_l2 ${dto.l2Code} already exists`)
    }

    await this.assertValidL2Hierarchy(dto.l2Code, dto.l1Code)

    return this.taxonomyL2Repository.save(this.taxonomyL2Repository.create(dto))
  }

  async updateL2(l2Code: string, dto: UpdateTaxonomyL2Dto): Promise<TaxonomyL2> {
    const existing = await this.taxonomyL2Repository.findOne({
      where: { l2Code },
    })

    if (!existing) {
      throw new NotFoundException(`taxonomy_l2 ${l2Code} not found`)
    }

    const nextL1Code = dto.l1Code ?? existing.l1Code

    await this.assertValidL2Hierarchy(l2Code, nextL1Code)

    Object.assign(existing, dto, {
      l1Code: nextL1Code,
    })
    return this.taxonomyL2Repository.save(existing)
  }

  /**
   * 获取完整推理链路数据。
   * 注意：此方法仅包含只读查询（SELECT），无需事务包裹。
   * 多个查询之间的数据一致性由底层数据的不可变性保证（知识图谱数据仅通过管理流程变更）。
   */
  async getReasoningChain(l2Code: string): Promise<ReasoningChainResponseDto> {
    // 1. Fetch taxonomy L2 with its parent L1
    const l2 = await this.taxonomyL2Repository.findOne({
      where: { l2Code },
      relations: ['parent'],
    })

    if (!l2) {
      throw new NotFoundException(`taxonomy_l2 ${l2Code} not found`)
    }

    if (!l2.parent) {
      throw new NotFoundException(`taxonomy_l2 ${l2Code} has no parent L1`)
    }

    // 2. Fetch failure modes linked to this L2
    const tfmMaps = await this.taxonomyFailureModeMapRepository.find({
      where: { l2Code },
      relations: ['failureMode'],
    })

    const failureModeIds = [...new Set(tfmMaps.map((m) => m.failureModeId))]

    // 2.5. Count control points per failure mode using database aggregation (batched to avoid parameter limit)
    let controlCountByFm = new Map<string, number>()
    if (failureModeIds.length > 0) {
      const BATCH_SIZE = 1000
      const allControlCounts: Array<{ failureModeId?: string; failuremodeid?: string; count: string }> = []
      for (let i = 0; i < failureModeIds.length; i += BATCH_SIZE) {
        const batch = failureModeIds.slice(i, i + BATCH_SIZE)
        const batchCounts = await this.failureModeControlMapRepository
          .createQueryBuilder('fmc')
          .select('fmc.failure_mode_id', 'failureModeId')
          .addSelect('COUNT(fmc.control_id)', 'count')
          .where('fmc.failure_mode_id IN (:...batch)', { batch })
          .groupBy('fmc.failure_mode_id')
          .getRawMany()
        allControlCounts.push(...batchCounts)
      }

      controlCountByFm = new Map(
        allControlCounts.map((row: { failureModeId?: string; failuremodeid?: string; count: string }) => [
          row.failureModeId || row.failuremodeid || '',
          parseInt(row.count, 10) || 0
        ])
      )
    }

    // 3. Fetch control points linked to these failure modes (batched)
    let fmcMaps: FailureModeControlMap[] = []
    if (failureModeIds.length > 0) {
      const BATCH_SIZE = 1000
      for (let i = 0; i < failureModeIds.length; i += BATCH_SIZE) {
        const batch = failureModeIds.slice(i, i + BATCH_SIZE)
        const batchMaps = await this.failureModeControlMapRepository
          .createQueryBuilder('fmc')
          .leftJoinAndSelect('fmc.controlPoint', 'cp')
          .where('fmc.failure_mode_id IN (:...batch)', { batch })
          .getMany()
        fmcMaps.push(...batchMaps)
      }
    }

    const controlIds = [...new Set(fmcMaps.map((m) => m.controlId))]

    // 4. Fetch obligations linked to these control points
    let ocMaps: ObligationControlMap[] = []
    if (controlIds.length > 0) {
      ocMaps = await this.obligationControlMapRepository
        .createQueryBuilder('ocm')
        .leftJoinAndSelect('ocm.obligation', 'obl')
        .where('ocm.control_id IN (:...controlIds)', { controlIds })
        .getMany()
    }

    // 5. Assemble response
    return {
      taxonomy: {
        l1Code: l2.parent.l1Code,
        l1Name: l2.parent.l1Name,
        l2Code: l2.l2Code,
        l2Name: l2.l2Name,
      },
      failureModes: tfmMaps.map((m) => ({
        failureModeId: m.failureMode.failureModeId,
        failureModeCode: m.failureMode.failureModeCode,
        name: m.failureMode.name,
        category: m.failureMode.category,
        controlPointCount: controlCountByFm.get(m.failureModeId) ?? 0,
      })),
      controlPoints: fmcMaps
        .filter((m) => m.controlPoint)
        .map((m) => ({
          controlId: m.controlPoint.controlId,
          controlCode: m.controlPoint.controlCode,
          controlName: m.controlPoint.controlName,
          maturityLevel: m.controlPoint.maturityLevel,
          authoritativeScore: m.controlPoint.authoritativeScore ?? 0,
          originType: m.controlPoint.originType,
          failureModeRelevance: m.relevance,
          failureModeId: m.failureModeId,
        })),
      obligations: ocMaps.map((m) => ({
        obligationId: m.obligation.obligationId,
        obligationCode: m.obligation.obligationCode,
        obligationText: m.obligation.obligationText,
        obligationType: m.obligation.obligationType,
        controlId: m.controlId,
        coverage: m.coverage,
      })),
    }
  }

  private buildL1Where(query: QueryTaxonomyTreeDto): FindOptionsWhere<TaxonomyL1> {
    const where: FindOptionsWhere<TaxonomyL1> = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.l1Code) {
      where.l1Code = query.l1Code
    }

    return where
  }

  private buildL2Where(query: QueryTaxonomyTreeDto): FindOptionsWhere<TaxonomyL2> {
    const where: FindOptionsWhere<TaxonomyL2> = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.l1Code) {
      where.l1Code = query.l1Code
    }

    if (query.l2Code) {
      where.l2Code = query.l2Code
    }

    return where
  }

  private matchesKeyword(keyword: string, code: string, name: string): boolean {
    return (
      code.toLocaleLowerCase().includes(keyword) || name.toLocaleLowerCase().includes(keyword)
    )
  }

  private async assertValidL2Hierarchy(l2Code: string, l1Code: string): Promise<void> {
    const [codePrefix] = l2Code.split('-')

    if (codePrefix !== l1Code) {
      throw new BadRequestException(`taxonomy_l2 ${l2Code} does not belong to taxonomy_l1 ${l1Code}`)
    }

    await this.assertL1Exists(l1Code)
  }

  private async assertL1Exists(l1Code: string): Promise<void> {
    const parent = await this.taxonomyL1Repository.findOne({
      where: { l1Code },
    })

    if (!parent) {
      throw new BadRequestException(`taxonomy_l1 ${l1Code} does not exist`)
    }
  }
}
