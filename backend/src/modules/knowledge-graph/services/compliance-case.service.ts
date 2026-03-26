import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Repository } from 'typeorm'
import { CaseControlMap } from '../../../database/entities/case-control-map.entity'
import { ComplianceCase } from '../../../database/entities/compliance-case.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import {
  CreateCaseControlMapDto,
  CreateComplianceCaseDto,
  QueryCaseControlMapDto,
  QueryComplianceCaseDto,
  UpdateCaseControlMapDto,
  UpdateComplianceCaseDto,
} from '../dto/compliance-case.dto'

@Injectable()
export class ComplianceCaseService {
  constructor(
    @InjectRepository(ComplianceCase)
    private readonly complianceCaseRepository: Repository<ComplianceCase>,
    @InjectRepository(CaseControlMap)
    private readonly caseControlMapRepository: Repository<CaseControlMap>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
  ) {}

  async findAllCases(query: QueryComplianceCaseDto) {
    const where: Record<string, unknown> = {}

    if (query.caseCode) {
      where.caseCode = query.caseCode
    }

    if (query.industry) {
      where.industry = query.industry
    }

    if (query.authorityName) {
      where.authorityName = query.authorityName
    }

    if (query.regulatorCode) {
      where.regulatorCode = query.regulatorCode
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      const [items, total] = await this.complianceCaseRepository.findAndCount({
        where: [
          { ...where, caseCode: keyword },
          { ...where, caseTitle: keyword },
          { ...where, sourceOrg: keyword },
          { ...where, caseFacts: keyword },
        ],
        order: { caseDate: 'DESC', caseCode: 'ASC' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      })

      return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
    }

    const [items, total] = await this.complianceCaseRepository.findAndCount({
      where,
      order: { caseDate: 'DESC', caseCode: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createCase(dto: CreateComplianceCaseDto): Promise<ComplianceCase> {
    await this.assertUniqueCaseCode(dto.caseCode)
    await this.assertCaseTaxonomyRelation(dto.l1Code ?? null, dto.l2Code ?? null)

    const entity = this.complianceCaseRepository.create(this.toComplianceCasePersistence(dto))
    return this.complianceCaseRepository.save(entity)
  }

  async updateCase(caseId: string, dto: UpdateComplianceCaseDto): Promise<ComplianceCase> {
    this.assertNoNullUpdates(dto, ['caseCode', 'status'])

    const existing = await this.findCase(caseId)
    const nextCaseCode = dto.caseCode ?? existing.caseCode
    const nextL1Code = dto.l1Code ?? existing.l1Code
    const nextL2Code = dto.l2Code ?? existing.l2Code

    await this.assertUniqueCaseCode(nextCaseCode, caseId)
    await this.assertCaseTaxonomyRelation(nextL1Code ?? null, nextL2Code ?? null)

    Object.assign(existing, this.toComplianceCasePersistence(dto), {
      caseCode: nextCaseCode,
      l1Code: nextL1Code,
      l2Code: nextL2Code,
    })

    return this.complianceCaseRepository.save(existing)
  }

  async findAllCaseControlMaps(query: QueryCaseControlMapDto) {
    const where: Record<string, unknown> = {}

    if (query.caseId) {
      where.caseId = query.caseId
    }

    if (query.controlId) {
      where.controlId = query.controlId
    }

    if (query.relationType) {
      where.relationType = query.relationType
    }

    if (query.reviewStatus) {
      where.reviewStatus = query.reviewStatus
    }

    const [items, total] = await this.caseControlMapRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createCaseControlMap(dto: CreateCaseControlMapDto): Promise<CaseControlMap> {
    await this.assertCaseExists(dto.caseId)
    await this.assertControlExists(dto.controlId)
    await this.assertUniqueCaseControlMap(dto.caseId, dto.controlId)

    const entity = this.caseControlMapRepository.create(this.toCaseControlMapPersistence(dto))
    return this.caseControlMapRepository.save(entity)
  }

  async updateCaseControlMap(id: string, dto: UpdateCaseControlMapDto): Promise<CaseControlMap> {
    this.assertNoNullUpdates(dto, ['caseId', 'controlId', 'relationType', 'reviewStatus'])

    const existing = await this.findCaseControlMap(id)
    const nextCaseId = dto.caseId ?? existing.caseId
    const nextControlId = dto.controlId ?? existing.controlId

    await this.assertCaseExists(nextCaseId)
    await this.assertControlExists(nextControlId)
    await this.assertUniqueCaseControlMap(nextCaseId, nextControlId, id)

    Object.assign(existing, this.toCaseControlMapPersistence(dto), {
      caseId: nextCaseId,
      controlId: nextControlId,
    })

    return this.caseControlMapRepository.save(existing)
  }

  async findCasesByControlId(controlId: string) {
    const items = await this.caseControlMapRepository
      .createQueryBuilder('mapping')
      .leftJoinAndSelect('mapping.caseRecord', 'caseRecord')
      .where('mapping.control_id = :controlId', { controlId })
      .orderBy('caseRecord.case_date', 'DESC')
      .addOrderBy('caseRecord.case_code', 'ASC')
      .getMany()

    return items.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      caseCode: item.caseRecord.caseCode,
      caseTitle: item.caseRecord.caseTitle,
      sourceOrg: item.caseRecord.sourceOrg,
      industry: item.caseRecord.industry,
      authorityName: item.caseRecord.authorityName,
      caseDate: item.caseRecord.caseDate,
      relationType: item.relationType,
      reviewStatus: item.reviewStatus,
      confidenceScore: item.confidenceScore,
    }))
  }

  private toComplianceCasePersistence(
    dto: CreateComplianceCaseDto | UpdateComplianceCaseDto,
  ): Partial<ComplianceCase> {
    const caseDate =
      dto.caseDate === undefined || dto.caseDate === null
        ? (dto.caseDate ?? null)
        : new Date(dto.caseDate)
    const confidenceScore =
      dto.confidenceScore === undefined || dto.confidenceScore === null
        ? (dto.confidenceScore ?? null)
        : dto.confidenceScore.toFixed(4)

    return {
      ...(dto as object),
      caseDate,
      confidenceScore,
    } as Partial<ComplianceCase>
  }

  private toCaseControlMapPersistence(
    dto: CreateCaseControlMapDto | UpdateCaseControlMapDto,
  ): Partial<CaseControlMap> {
    const confidenceScore =
      dto.confidenceScore === undefined || dto.confidenceScore === null
        ? (dto.confidenceScore ?? null)
        : dto.confidenceScore.toFixed(4)

    return {
      ...(dto as object),
      confidenceScore,
    } as Partial<CaseControlMap>
  }

  private async findCase(caseId: string): Promise<ComplianceCase> {
    const caseRecord = await this.complianceCaseRepository.findOne({ where: { caseId } })

    if (!caseRecord) {
      throw new NotFoundException(`compliance_case ${caseId} not found`)
    }

    return caseRecord
  }

  private async findCaseControlMap(id: string): Promise<CaseControlMap> {
    const mapping = await this.caseControlMapRepository.findOne({ where: { id } })

    if (!mapping) {
      throw new NotFoundException(`case_control_map ${id} not found`)
    }

    return mapping
  }

  private async assertUniqueCaseCode(caseCode: string, currentCaseId?: string) {
    const existing = await this.complianceCaseRepository.findOne({ where: { caseCode } })

    if (existing && existing.caseId !== currentCaseId) {
      throw new ConflictException(`case_code ${caseCode} already exists`)
    }
  }

  private async assertUniqueCaseControlMap(caseId: string, controlId: string, currentId?: string) {
    const existing = await this.caseControlMapRepository.findOne({
      where: { caseId, controlId },
    })

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`case_control_map ${caseId}/${controlId} already exists`)
    }
  }

  private async assertCaseExists(caseId: string) {
    const caseRecord = await this.complianceCaseRepository.findOne({ where: { caseId } })

    if (!caseRecord) {
      throw new BadRequestException(`compliance_case ${caseId} does not exist`)
    }
  }

  private async assertControlExists(controlId: string) {
    const control = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!control) {
      throw new BadRequestException(`control_point ${controlId} does not exist`)
    }
  }

  private async assertCaseTaxonomyRelation(l1Code: string | null, l2Code: string | null) {
    if (!l1Code && !l2Code) {
      return
    }

    if (!l1Code && l2Code) {
      throw new BadRequestException('l1Code is required when l2Code is provided')
    }

    const l1 = await this.taxonomyL1Repository.findOne({ where: { l1Code: l1Code! } })

    if (!l1) {
      throw new BadRequestException(`taxonomy_l1 ${l1Code} does not exist`)
    }

    if (!l2Code) {
      return
    }

    const l2 = await this.taxonomyL2Repository.findOne({ where: { l2Code } })

    if (!l2) {
      throw new BadRequestException(`taxonomy_l2 ${l2Code} does not exist`)
    }

    if (l2.l1Code !== l1Code) {
      throw new BadRequestException('Invalid l1Code/l2Code hierarchy relation')
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
