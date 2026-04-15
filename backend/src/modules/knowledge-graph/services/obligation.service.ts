import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, QueryFailedError, Repository } from 'typeorm'
import {
  APPLICABLE_SECTORS,
  ApplicableSector,
  CONTROL_POINT_ORIGIN_TYPES,
  ControlPoint,
  ControlPointOriginType,
} from '../../../database/entities/control-point.entity'
import { ObligationControlMap } from '../../../database/entities/obligation-control-map.entity'
import { ClauseControlMap } from '../../../database/entities/clause-control-map.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { RegulationObligation } from '../../../database/entities/regulation-obligation.entity'
import {
  CreateObligationDto,
  CreateObligationControlMapBodyDto,
  QueryObligationDto,
  UpdateObligationDto,
} from '../dto/obligation.dto'

@Injectable()
export class ObligationService {
  constructor(
    @InjectRepository(RegulationObligation)
    private readonly obligationRepo: Repository<RegulationObligation>,
    @InjectRepository(ObligationControlMap)
    private readonly obligationControlMapRepo: Repository<ObligationControlMap>,
    @InjectRepository(RegulationClause)
    private readonly clauseRepo: Repository<RegulationClause>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepo: Repository<ControlPoint>,
    @InjectRepository(ClauseControlMap)
    private readonly clauseControlMapRepo: Repository<ClauseControlMap>,
  ) {}

  async findAll(query: QueryObligationDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const qb = this.obligationRepo
      .createQueryBuilder('obl')
      .leftJoinAndSelect('obl.clause', 'clause')
      .leftJoinAndSelect('clause.source', 'source')
      .orderBy('obl.obligation_code', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)

    if (query.clauseId) {
      qb.andWhere('obl.clause_id = :clauseId', { clauseId: query.clauseId })
    }

    if (query.obligationType) {
      qb.andWhere('obl.obligation_type = :obligationType', {
        obligationType: query.obligationType,
      })
    }

    if (query.status) {
      qb.andWhere('obl.status = :status', { status: query.status })
    }

    if (query.applicableSector) {
      qb.andWhere(
        `(obl.applicable_sector @> ARRAY[:sector]::varchar[] OR obl.applicable_sector @> ARRAY['通用']::varchar[] OR obl.applicable_sector = '{}'::varchar[])`,
        { sector: query.applicableSector },
      )
    }

    if (query.keyword) {
      const keyword = `%${query.keyword}%`
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('obl.obligation_code ILIKE :keyword', { keyword })
            .orWhere('obl.obligation_text ILIKE :keyword', { keyword })
            .orWhere('clause.clause_code ILIKE :keyword', { keyword })
            .orWhere('clause.clause_text ILIKE :keyword', { keyword })
        }),
      )
    }

    const [items, total] = await qb.getManyAndCount()
    return { items, total, page, limit }
  }

  async findById(obligationId: string) {
    const entity = await this.obligationRepo.findOne({
      where: { obligationId },
      relations: [
        'clause',
        'clause.source',
        'obligationControlMaps',
        'obligationControlMaps.controlPoint',
      ],
    })

    if (!entity) {
      throw new NotFoundException(`regulation_obligation ${obligationId} not found`)
    }

    const controlMaps = (entity.obligationControlMaps ?? []).map((map) => ({
      id: map.id,
      controlId: map.controlId,
      controlCode: map.controlPoint?.controlCode ?? '',
      controlName: map.controlPoint?.controlName ?? '',
      coverage: map.coverage,
      originType: map.controlPoint?.originType ?? null,
      maturityLevel: map.controlPoint?.maturityLevel ?? null,
      authoritativeScore: map.controlPoint?.authoritativeScore ?? null,
    }))

    return {
      obligationId: entity.obligationId,
      obligationCode: entity.obligationCode,
      obligationText: entity.obligationText,
      obligationType: entity.obligationType,
      applicableSector: entity.applicableSector,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      clause: entity.clause
        ? {
            clauseId: entity.clause.clauseId,
            clauseCode: entity.clause.clauseCode,
            articleNo: entity.clause.articleNo,
            sectionPath: entity.clause.sectionPath,
            clauseText: entity.clause.clauseText,
            clauseSummary: entity.clause.clauseSummary,
            source: entity.clause.source
              ? {
                  sourceId: entity.clause.source.sourceId,
                  sourceCode: entity.clause.source.sourceCode,
                  sourceName: entity.clause.source.sourceName,
                  sourceLevel: entity.clause.source.sourceLevel,
                  authorityName: entity.clause.source.authorityName,
                }
              : null,
          }
        : null,
      controlMaps,
    }
  }

  async create(dto: CreateObligationDto): Promise<RegulationObligation> {
    await this.assertClauseExists(dto.clauseId)
    await this.assertUniqueObligationCode(dto.obligationCode)

    try {
      return await this.obligationRepo.save(
        this.obligationRepo.create({
          clauseId: dto.clauseId,
          obligationCode: dto.obligationCode,
          obligationText: dto.obligationText,
          obligationType: dto.obligationType,
          applicableSector: dto.applicableSector ?? [],
          status: dto.status ?? 'ACTIVE',
        }),
      )
    } catch (error) {
      this.rethrowKnownPersistenceError(error, dto.obligationCode)
    }
  }

  async update(obligationId: string, dto: UpdateObligationDto): Promise<RegulationObligation> {
    this.assertNoNullUpdates(dto, [
      'clauseId',
      'obligationCode',
      'obligationText',
      'obligationType',
      'status',
    ])

    const existing = await this.findObligationEntity(obligationId)
    const nextClauseId = dto.clauseId ?? existing.clauseId
    const nextCode = dto.obligationCode ?? existing.obligationCode

    await this.assertClauseExists(nextClauseId)
    await this.assertUniqueObligationCode(nextCode, obligationId)

    Object.assign(existing, {
      clauseId: nextClauseId,
      obligationCode: nextCode,
      obligationText: dto.obligationText ?? existing.obligationText,
      obligationType: dto.obligationType ?? existing.obligationType,
      applicableSector: dto.applicableSector ?? existing.applicableSector,
      status: dto.status ?? existing.status,
    })

    try {
      return await this.obligationRepo.save(existing)
    } catch (error) {
      this.rethrowKnownPersistenceError(error, nextCode)
    }
  }

  async findByClauseId(clauseId: string, query: QueryObligationDto) {
    await this.assertClauseExists(clauseId)
    return this.findAll({ ...query, clauseId })
  }

  async findControlPointsByObligation(obligationId: string, query: QueryObligationDto) {
    await this.findObligationEntity(obligationId)

    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const qb = this.obligationControlMapRepo
      .createQueryBuilder('ocm')
      .leftJoinAndSelect('ocm.controlPoint', 'cp')
      .where('ocm.obligation_id = :obligationId', { obligationId })
      .orderBy(`CASE WHEN ocm.coverage = 'FULL' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('cp.authoritativeScore', 'DESC')
      .addOrderBy('cp.controlCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)

    const [rawItems, total] = await qb.getManyAndCount()
    const items = rawItems.map((map) => ({
      id: map.id,
      controlId: map.controlId,
      controlCode: map.controlPoint?.controlCode ?? '',
      controlName: map.controlPoint?.controlName ?? '',
      coverage: map.coverage,
      originType: map.controlPoint?.originType ?? null,
      maturityLevel: map.controlPoint?.maturityLevel ?? null,
      authoritativeScore: map.controlPoint?.authoritativeScore ?? null,
    }))

    return { items, total, page, limit }
  }

  async createControlMap(
    obligationId: string,
    dto: CreateObligationControlMapBodyDto,
  ): Promise<ObligationControlMap> {
    await this.findObligationEntity(obligationId)

    const controlPoint = await this.controlPointRepo.findOne({
      where: { controlId: dto.controlId },
    })
    if (!controlPoint) {
      throw new NotFoundException(`control_point ${dto.controlId} not found`)
    }

    const existing = await this.obligationControlMapRepo.findOne({
      where: { obligationId, controlId: dto.controlId },
    })
    if (existing) {
      throw new ConflictException(
        `obligation-control mapping already exists for obligation ${obligationId} + control ${dto.controlId}`,
      )
    }

    return this.obligationControlMapRepo.save(
      this.obligationControlMapRepo.create({
        obligationId,
        controlId: dto.controlId,
        coverage: dto.coverage,
        notes: dto.notes ?? null,
      }),
    )
  }

  async getCoverageAnalysis() {
    const obligations = await this.obligationRepo.find({
      relations: ['obligationControlMaps', 'obligationControlMaps.controlPoint'],
    })

    const covered = obligations.filter(
      (obligation) => (obligation.obligationControlMaps ?? []).length > 0,
    ).length
    const uncovered = obligations.length - covered
    const coverageRate =
      obligations.length === 0 ? 0 : Number((covered / obligations.length).toFixed(4))

    const originDistribution = CONTROL_POINT_ORIGIN_TYPES.reduce(
      (acc, originType) => ({ ...acc, [originType]: 0 }),
      {} as Record<ControlPointOriginType, number>,
    )

    const seenControls = new Set<string>()
    for (const obligation of obligations) {
      for (const map of obligation.obligationControlMaps ?? []) {
        const controlPoint = map.controlPoint
        if (!controlPoint || seenControls.has(controlPoint.controlId)) {
          continue
        }
        seenControls.add(controlPoint.controlId)
        originDistribution[controlPoint.originType] += 1
      }
    }

    const sectorCoverage = APPLICABLE_SECTORS.map((sector) => {
      const relevantObligations = obligations.filter((obligation) =>
        this.matchesSector(obligation.applicableSector, sector),
      )
      const coveredCount = relevantObligations.filter((obligation) =>
        this.hasCoveredControlForSector(obligation.obligationControlMaps ?? [], sector),
      ).length
      return {
        sector,
        obligations: relevantObligations.length,
        covered: coveredCount,
        coverageRate:
          relevantObligations.length === 0
            ? 0
            : Number((coveredCount / relevantObligations.length).toFixed(4)),
      }
    })

    return {
      totals: {
        obligations: obligations.length,
        covered,
        uncovered,
        coverageRate,
      },
      originDistribution,
      sectorCoverage,
    }
  }

  async findRegulatoryLinksByControlId(controlId: string) {
    const obligationMaps = await this.obligationControlMapRepo
      .createQueryBuilder('ocm')
      .leftJoinAndSelect('ocm.obligation', 'obl')
      .leftJoinAndSelect('obl.clause', 'clause')
      .leftJoinAndSelect('clause.source', 'source')
      .where('ocm.control_id = :controlId', { controlId })
      .orderBy('obl.obligation_code', 'ASC')
      .getMany()

    const clauseMaps = await this.clauseControlMapRepo
      .createQueryBuilder('mapping')
      .leftJoinAndSelect('mapping.clause', 'clause')
      .leftJoinAndSelect('clause.source', 'source')
      .where('mapping.control_id = :controlId', { controlId })
      .orderBy('clause.clause_code', 'ASC')
      .getMany()

    return {
      obligations: obligationMaps.map((map) => ({
        id: map.id,
        obligationId: map.obligation?.obligationId ?? '',
        obligationCode: map.obligation?.obligationCode ?? '',
        obligationText: map.obligation?.obligationText ?? '',
        obligationType: map.obligation?.obligationType ?? null,
        coverage: map.coverage,
        linkSource: 'obligation' as const,
        clause: map.obligation?.clause
          ? {
              clauseId: map.obligation.clause.clauseId,
              clauseCode: map.obligation.clause.clauseCode,
              articleNo: map.obligation.clause.articleNo,
            }
          : null,
      })),
      clauses: clauseMaps.map((item) => ({
        id: item.id,
        clauseId: item.clauseId,
        clauseCode: item.clause.clauseCode,
        articleNo: item.clause.articleNo,
        sectionPath: item.clause.sectionPath,
        clauseText: item.clause.clauseText,
        clauseSummary: item.clause.clauseSummary,
        mandatoryLevel: item.clause.mandatoryLevel,
        mappingType: item.mappingType,
        reviewStatus: item.reviewStatus,
        confidenceScore: item.confidenceScore,
        linkSource: 'clause' as const,
        source: item.clause.source
          ? {
              sourceId: item.clause.source.sourceId,
              sourceCode: item.clause.source.sourceCode,
              sourceName: item.clause.source.sourceName,
              sourceLevel: item.clause.source.sourceLevel,
              authorityName: item.clause.source.authorityName,
            }
          : null,
      })),
    }
  }

  private async findObligationEntity(obligationId: string): Promise<RegulationObligation> {
    const entity = await this.obligationRepo.findOne({ where: { obligationId } })
    if (!entity) {
      throw new NotFoundException(`regulation_obligation ${obligationId} not found`)
    }
    return entity
  }

  private async assertClauseExists(clauseId: string) {
    const clause = await this.clauseRepo.findOne({ where: { clauseId } })
    if (!clause) {
      throw new NotFoundException(`regulation_clause ${clauseId} not found`)
    }
  }

  private async assertUniqueObligationCode(obligationCode: string, currentId?: string) {
    const existing = await this.obligationRepo.findOne({ where: { obligationCode } })
    if (existing && existing.obligationId !== currentId) {
      throw new ConflictException(`obligation_code ${obligationCode} already exists`)
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

  async deleteControlMap(obligationId: string, mapId: string) {
    await this.findObligationEntity(obligationId)

    const result = await this.obligationControlMapRepo.delete({ id: mapId, obligationId })
    if (result.affected === 1) {
      return { success: true, id: mapId }
    }

    const existing = await this.obligationControlMapRepo.findOne({
      where: { id: mapId },
    })
    if (existing) {
      throw new BadRequestException(
        'obligation control map does not belong to the current obligation',
      )
    }

    throw new NotFoundException(`obligation_control_map ${mapId} not found`)
  }

  private rethrowKnownPersistenceError(error: unknown, obligationCode: string): never {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        '23505'
    ) {
      throw new ConflictException(`obligation_code ${obligationCode} already exists`)
    }

    throw error
  }

  private matchesSector(
    applicableSectors: ApplicableSector[] | null | undefined,
    sector: ApplicableSector,
  ) {
    const sectors = applicableSectors ?? []
    return sectors.length === 0 || sectors.includes(sector) || sectors.includes('通用')
  }

  private hasCoveredControlForSector(maps: ObligationControlMap[], sector: ApplicableSector) {
    return maps.some((map) => this.matchesSector(map.controlPoint?.applicableSector, sector))
  }
}
