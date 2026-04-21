import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Repository } from 'typeorm'
import { ClauseControlMap } from '../../../database/entities/clause-control-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { RegulationClause } from '../../../database/entities/regulation-clause.entity'
import { RegulationSource } from '../../../database/entities/regulation-source.entity'
import { RegulationGraphResponseDto } from '../dto/regulation-graph.dto'
import {
  CreateClauseControlMapDto,
  CreateRegulationClauseDto,
  CreateRegulationSourceDto,
  QueryClauseControlMapDto,
  QueryRegulationClauseDto,
  QueryRegulationSourceDto,
  UpdateClauseControlMapDto,
  UpdateRegulationClauseDto,
  UpdateRegulationSourceDto,
} from '../dto/regulation.dto'

@Injectable()
export class RegulationService {
  constructor(
    @InjectRepository(RegulationSource)
    private readonly regulationSourceRepository: Repository<RegulationSource>,
    @InjectRepository(RegulationClause)
    private readonly regulationClauseRepository: Repository<RegulationClause>,
    @InjectRepository(ClauseControlMap)
    private readonly clauseControlMapRepository: Repository<ClauseControlMap>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
  ) {}

  async findAllSources(query: QueryRegulationSourceDto) {
    const where: Record<string, unknown> = {}

    if (query.sourceCode) {
      where.sourceCode = query.sourceCode
    }

    if (query.sourceLevel) {
      where.sourceLevel = query.sourceLevel
    }

    if (query.sourceStatus) {
      where.sourceStatus = query.sourceStatus
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      const [items, total] = await this.regulationSourceRepository.findAndCount({
        where: [
          { ...where, sourceCode: keyword },
          { ...where, sourceName: keyword },
          { ...where, authorityName: keyword },
        ],
        order: { sourceCode: 'ASC' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      })

      return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
    }

    const [items, total] = await this.regulationSourceRepository.findAndCount({
      where,
      order: { sourceCode: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createSource(dto: CreateRegulationSourceDto): Promise<RegulationSource> {
    await this.assertUniqueSourceCode(dto.sourceCode)
    return this.regulationSourceRepository.save(this.regulationSourceRepository.create(dto))
  }

  async updateSource(
    sourceId: string,
    dto: UpdateRegulationSourceDto,
  ): Promise<RegulationSource> {
    this.assertNoNullUpdates(dto, ['sourceCode', 'sourceName', 'sourceLevel', 'sourceStatus'])

    const existing = await this.findSource(sourceId)
    const nextSourceCode = dto.sourceCode ?? existing.sourceCode

    await this.assertUniqueSourceCode(nextSourceCode, sourceId)

    Object.assign(existing, dto, {
      sourceCode: nextSourceCode,
    })

    return this.regulationSourceRepository.save(existing)
  }

  async findAllClauses(query: QueryRegulationClauseDto) {
    const where: Record<string, unknown> = {}

    if (query.sourceId) {
      where.sourceId = query.sourceId
    }

    if (query.mandatoryLevel) {
      where.mandatoryLevel = query.mandatoryLevel
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      const [items, total] = await this.regulationClauseRepository.findAndCount({
        where: [
          { ...where, clauseCode: keyword },
          { ...where, clauseText: keyword },
          { ...where, clauseSummary: keyword },
          { ...where, articleNo: keyword },
        ],
        order: { clauseCode: 'ASC' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      })

      return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
    }

    const [items, total] = await this.regulationClauseRepository.findAndCount({
      where,
      order: { clauseCode: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createClause(dto: CreateRegulationClauseDto): Promise<RegulationClause> {
    await this.assertSourceExists(dto.sourceId)
    await this.assertUniqueClauseCode(dto.clauseCode)
    return this.regulationClauseRepository.save(this.regulationClauseRepository.create(dto))
  }

  async updateClause(
    clauseId: string,
    dto: UpdateRegulationClauseDto,
  ): Promise<RegulationClause> {
    this.assertNoNullUpdates(dto, ['sourceId', 'clauseCode', 'clauseText'])

    const existing = await this.findClause(clauseId)
    const nextSourceId = dto.sourceId ?? existing.sourceId
    const nextClauseCode = dto.clauseCode ?? existing.clauseCode

    await this.assertSourceExists(nextSourceId)
    await this.assertUniqueClauseCode(nextClauseCode, clauseId)

    Object.assign(existing, dto, {
      sourceId: nextSourceId,
      clauseCode: nextClauseCode,
    })

    return this.regulationClauseRepository.save(existing)
  }

  async findAllClauseControlMaps(query: QueryClauseControlMapDto) {
    const where: Record<string, unknown> = {}

    if (query.clauseId) {
      where.clauseId = query.clauseId
    }

    if (query.controlId) {
      where.controlId = query.controlId
    }

    if (query.mappingType) {
      where.mappingType = query.mappingType
    }

    if (query.reviewStatus) {
      where.reviewStatus = query.reviewStatus
    }

    const [items, total] = await this.clauseControlMapRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createClauseControlMap(dto: CreateClauseControlMapDto): Promise<ClauseControlMap> {
    await this.assertClauseExists(dto.clauseId)
    await this.assertControlExists(dto.controlId)
    await this.assertUniqueClauseControlMap(dto.clauseId, dto.controlId)

    const entity = this.clauseControlMapRepository.create(this.toClauseControlMapPersistence(dto))
    return this.clauseControlMapRepository.save(entity)
  }

  async updateClauseControlMap(
    id: string,
    dto: UpdateClauseControlMapDto,
  ): Promise<ClauseControlMap> {
    this.assertNoNullUpdates(dto, ['clauseId', 'controlId', 'mappingType', 'reviewStatus'])

    const existing = await this.findClauseControlMap(id)
    const nextClauseId = dto.clauseId ?? existing.clauseId
    const nextControlId = dto.controlId ?? existing.controlId

    await this.assertClauseExists(nextClauseId)
    await this.assertControlExists(nextControlId)
    await this.assertUniqueClauseControlMap(nextClauseId, nextControlId, id)

    Object.assign(existing, this.toClauseControlMapPersistence(dto), {
      clauseId: nextClauseId,
      controlId: nextControlId,
    })

    return this.clauseControlMapRepository.save(existing)
  }

  async findClausesByControlId(controlId: string) {
    const items = await this.clauseControlMapRepository
      .createQueryBuilder('mapping')
      .leftJoinAndSelect('mapping.clause', 'clause')
      .leftJoinAndSelect('clause.source', 'source')
      .where('mapping.control_id = :controlId', { controlId })
      .orderBy('clause.clause_code', 'ASC')
      .getMany()

    return items.map((item) => ({
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
      source: {
        sourceId: item.clause.source.sourceId,
        sourceCode: item.clause.source.sourceCode,
        sourceName: item.clause.source.sourceName,
        sourceLevel: item.clause.source.sourceLevel,
        authorityName: item.clause.source.authorityName,
      },
    }))
  }

  async getRegulationGraph(sourceId: string): Promise<RegulationGraphResponseDto> {
    const source = await this.findSource(sourceId)
    const clauses = await this.regulationClauseRepository.find({
      where: { sourceId },
      relations: [
        'obligations',
        'obligations.obligationControlMaps',
        'obligations.obligationControlMaps.controlPoint',
      ],
      order: { clauseCode: 'ASC' },
    })

    const clauseItems: RegulationGraphResponseDto['clauses'] = []
    const obligationItems: RegulationGraphResponseDto['obligations'] = []
    const controlPointItems: RegulationGraphResponseDto['controlPoints'] = []
    const uniqueControlIds = new Set<string>()

    for (const clause of clauses.sort((left, right) => left.clauseCode.localeCompare(right.clauseCode))) {
      const obligations = [...(clause.obligations ?? [])].sort((left, right) =>
        left.obligationCode.localeCompare(right.obligationCode),
      )
      const clauseControlIds = new Set<string>()

      for (const obligation of obligations) {
        const controlMaps = [...(obligation.obligationControlMaps ?? [])].sort((left, right) =>
          (left.controlPoint?.controlCode ?? '').localeCompare(right.controlPoint?.controlCode ?? ''),
        )
        const obligationControlIds = new Set<string>()

        for (const map of controlMaps) {
          const controlPoint = map.controlPoint
          if (!controlPoint) {
            continue
          }

          obligationControlIds.add(controlPoint.controlId)
          clauseControlIds.add(controlPoint.controlId)
          uniqueControlIds.add(controlPoint.controlId)

          controlPointItems.push({
            edgeId: `${clause.clauseId}:${obligation.obligationId}:${controlPoint.controlId}`,
            controlId: controlPoint.controlId,
            controlCode: controlPoint.controlCode,
            controlName: controlPoint.controlName,
            maturityLevel: controlPoint.maturityLevel ?? null,
            authoritativeScore: controlPoint.authoritativeScore ?? 0,
            originType: controlPoint.originType ?? null,
            applicableSector: controlPoint.applicableSector ?? [],
            coverage: map.coverage,
            obligationId: obligation.obligationId,
            obligationCode: obligation.obligationCode,
            clauseId: clause.clauseId,
            clauseCode: clause.clauseCode,
          })
        }

        obligationItems.push({
          obligationId: obligation.obligationId,
          obligationCode: obligation.obligationCode,
          obligationText: obligation.obligationText,
          obligationType: obligation.obligationType,
          applicableSector: obligation.applicableSector ?? [],
          clauseId: clause.clauseId,
          clauseCode: clause.clauseCode,
          clauseSummary: clause.clauseSummary ?? null,
          controlPointCount: obligationControlIds.size,
        })
      }

      clauseItems.push({
        clauseId: clause.clauseId,
        clauseCode: clause.clauseCode,
        articleNo: clause.articleNo ?? null,
        sectionPath: clause.sectionPath ?? null,
        clauseText: clause.clauseText,
        clauseSummary: clause.clauseSummary ?? null,
        mandatoryLevel: clause.mandatoryLevel ?? null,
        obligationCount: obligations.length,
        controlPointCount: clauseControlIds.size,
      })
    }

    return {
      source: {
        sourceId: source.sourceId,
        sourceCode: source.sourceCode,
        sourceName: source.sourceName,
        sourceLevel: source.sourceLevel ?? null,
        authorityName: source.authorityName ?? null,
        clauseCount: clauseItems.length,
        obligationCount: obligationItems.length,
        controlPointCount: uniqueControlIds.size,
      },
      clauses: clauseItems,
      obligations: obligationItems,
      controlPoints: controlPointItems,
    }
  }

  private toClauseControlMapPersistence(
    dto: CreateClauseControlMapDto | UpdateClauseControlMapDto,
  ): Partial<ClauseControlMap> {
    const confidenceScore =
      dto.confidenceScore === undefined || dto.confidenceScore === null
        ? dto.confidenceScore ?? null
        : dto.confidenceScore.toFixed(4)
    const reviewedAt =
      dto.reviewedAt === undefined || dto.reviewedAt === null
        ? dto.reviewedAt ?? null
        : new Date(dto.reviewedAt)

    return {
      ...(dto as object),
      confidenceScore,
      reviewedAt,
    } as Partial<ClauseControlMap>
  }

  private async findSource(sourceId: string): Promise<RegulationSource> {
    const source = await this.regulationSourceRepository.findOne({ where: { sourceId } })

    if (!source) {
      throw new NotFoundException(`regulation_source ${sourceId} not found`)
    }

    return source
  }

  private async findClause(clauseId: string): Promise<RegulationClause> {
    const clause = await this.regulationClauseRepository.findOne({ where: { clauseId } })

    if (!clause) {
      throw new NotFoundException(`regulation_clause ${clauseId} not found`)
    }

    return clause
  }

  private async findClauseControlMap(id: string): Promise<ClauseControlMap> {
    const mapping = await this.clauseControlMapRepository.findOne({ where: { id } })

    if (!mapping) {
      throw new NotFoundException(`clause_control_map ${id} not found`)
    }

    return mapping
  }

  private async assertUniqueSourceCode(sourceCode: string, currentSourceId?: string) {
    const existing = await this.regulationSourceRepository.findOne({ where: { sourceCode } })

    if (existing && existing.sourceId !== currentSourceId) {
      throw new ConflictException(`source_code ${sourceCode} already exists`)
    }
  }

  private async assertUniqueClauseCode(clauseCode: string, currentClauseId?: string) {
    const existing = await this.regulationClauseRepository.findOne({ where: { clauseCode } })

    if (existing && existing.clauseId !== currentClauseId) {
      throw new ConflictException(`clause_code ${clauseCode} already exists`)
    }
  }

  private async assertUniqueClauseControlMap(
    clauseId: string,
    controlId: string,
    currentId?: string,
  ) {
    const existing = await this.clauseControlMapRepository.findOne({
      where: { clauseId, controlId },
    })

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`clause_control_map ${clauseId}/${controlId} already exists`)
    }
  }

  private async assertSourceExists(sourceId: string) {
    const source = await this.regulationSourceRepository.findOne({ where: { sourceId } })

    if (!source) {
      throw new BadRequestException(`regulation_source ${sourceId} does not exist`)
    }
  }

  private async assertClauseExists(clauseId: string) {
    const clause = await this.regulationClauseRepository.findOne({ where: { clauseId } })

    if (!clause) {
      throw new BadRequestException(`regulation_clause ${clauseId} does not exist`)
    }
  }

  private async assertControlExists(controlId: string) {
    const control = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!control) {
      throw new BadRequestException(`control_point ${controlId} does not exist`)
    }
  }

  private assertNoNullUpdates(dto: object, nonNullableFields: readonly string[]): void {
    const record = dto as Record<string, unknown>

    for (const field of nonNullableFields) {
      if (record[field] === null) {
        throw new BadRequestException(`${field} cannot be null`)
      }
    }
  }
}
