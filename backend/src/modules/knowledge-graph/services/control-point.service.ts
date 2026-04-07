import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository } from 'typeorm'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import {
  CreateControlPointDto,
  QueryControlPointDto,
  UpdateControlPointDto,
  UpdateControlPointStatusDto,
} from '../dto/control-point.dto'

@Injectable()
export class ControlPointService {
  constructor(
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
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
      builder.andWhere('control.l1Code = :l1Code', { l1Code: query.l1Code })
    }

    if (query.l2Code) {
      builder.andWhere('control.l2Code = :l2Code', { l2Code: query.l2Code })
    }

    if (query.controlFamily) {
      builder.andWhere('control.controlFamily = :controlFamily', {
        controlFamily: query.controlFamily,
      })
    }

    if (query.keyword) {
      const keyword = `%${query.keyword}%`
      builder.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where('control.controlName ILIKE :keyword', { keyword })
            .orWhere('control.controlCode ILIKE :keyword', { keyword })
            .orWhere('control.controlDesc ILIKE :keyword', { keyword })
            .orWhere('control.canonicalTheme ILIKE :keyword', { keyword })
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

    const [items, total] = await builder
      .orderBy('control.controlCode', 'ASC')
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

  async create(dto: CreateControlPointDto): Promise<ControlPoint> {
    await this.assertTaxonomyRelation(dto.l1Code, dto.l2Code)
    await this.assertUniqueConstraints(dto.controlCode, dto.controlName)

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
