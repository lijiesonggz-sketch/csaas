import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Repository } from 'typeorm'
import {
  CONTROL_EVIDENCE_REQUIRED_LEVELS,
  ControlEvidenceMap,
} from '../../../database/entities/control-evidence-map.entity'
import { ControlPoint } from '../../../database/entities/control-point.entity'
import { EvidenceType } from '../../../database/entities/evidence-type.entity'
import {
  CreateControlEvidenceMapDto,
  CreateEvidenceTypeDto,
  QueryControlEvidenceMapDto,
  QueryEvidenceTypeDto,
  UpdateControlEvidenceMapDto,
  UpdateEvidenceTypeDto,
} from '../dto/evidence.dto'

type ControlEvidenceView = {
  id: string
  evidenceId: string
  evidenceCode: string
  evidenceName: string
  evidenceDesc: string | null
  evidenceCategory: string | null
  status: string
  requiredLevel: string
  notes: string | null
}

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(EvidenceType)
    private readonly evidenceTypeRepository: Repository<EvidenceType>,
    @InjectRepository(ControlEvidenceMap)
    private readonly controlEvidenceMapRepository: Repository<ControlEvidenceMap>,
    @InjectRepository(ControlPoint)
    private readonly controlPointRepository: Repository<ControlPoint>,
  ) {}

  async findAllEvidenceTypes(query: QueryEvidenceTypeDto) {
    const where: Record<string, unknown> = {}

    if (query.evidenceCode) {
      where.evidenceCode = query.evidenceCode
    }

    if (query.evidenceCategory) {
      where.evidenceCategory = query.evidenceCategory
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.keyword) {
      const keyword = ILike(`%${query.keyword}%`)
      const [items, total] = await this.evidenceTypeRepository.findAndCount({
        where: [
          { ...where, evidenceCode: keyword },
          { ...where, evidenceName: keyword },
          { ...where, evidenceDesc: keyword },
        ],
        order: { evidenceCode: 'ASC' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      })

      return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
    }

    const [items, total] = await this.evidenceTypeRepository.findAndCount({
      where,
      order: { evidenceCode: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createEvidenceType(dto: CreateEvidenceTypeDto): Promise<EvidenceType> {
    await this.assertUniqueEvidenceCode(dto.evidenceCode)
    return this.evidenceTypeRepository.save(
      this.evidenceTypeRepository.create({
        evidenceCode: dto.evidenceCode,
        evidenceName: dto.evidenceName,
        evidenceDesc: dto.evidenceDesc ?? null,
        evidenceCategory: dto.evidenceCategory ?? null,
        status: dto.status ?? 'ACTIVE',
      }),
    )
  }

  async updateEvidenceType(
    evidenceId: string,
    dto: UpdateEvidenceTypeDto,
  ): Promise<EvidenceType> {
    this.assertNoNullUpdates(dto, ['evidenceCode', 'evidenceName', 'status'])

    const existing = await this.findEvidenceType(evidenceId)
    const nextEvidenceCode = dto.evidenceCode ?? existing.evidenceCode

    await this.assertUniqueEvidenceCode(nextEvidenceCode, evidenceId)

    Object.assign(existing, {
      evidenceCode: nextEvidenceCode,
      evidenceName: dto.evidenceName ?? existing.evidenceName,
      evidenceDesc: dto.evidenceDesc ?? existing.evidenceDesc,
      evidenceCategory: dto.evidenceCategory ?? existing.evidenceCategory,
      status: dto.status ?? existing.status,
    })

    return this.evidenceTypeRepository.save(existing)
  }

  async findAllControlEvidenceMaps(query: QueryControlEvidenceMapDto) {
    const where: Record<string, unknown> = {}

    if (query.controlId) {
      where.controlId = query.controlId
    }

    if (query.evidenceId) {
      where.evidenceId = query.evidenceId
    }

    if (query.requiredLevel) {
      where.requiredLevel = query.requiredLevel
    }

    const [items, total] = await this.controlEvidenceMapRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      take: query.limit ?? 20,
    })

    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 }
  }

  async createControlEvidenceMap(
    dto: CreateControlEvidenceMapDto,
  ): Promise<ControlEvidenceMap> {
    await this.assertControlPointExists(dto.controlId)
    await this.assertEvidenceTypeExists(dto.evidenceId)
    await this.assertUniqueControlEvidenceMap(dto.controlId, dto.evidenceId)

    return this.controlEvidenceMapRepository.save(
      this.controlEvidenceMapRepository.create({
        controlId: dto.controlId,
        evidenceId: dto.evidenceId,
        requiredLevel: dto.requiredLevel ?? 'RECOMMENDED',
        frequency: dto.frequency ?? null,
        ownerRole: dto.ownerRole ?? null,
        samplingRequirement: dto.samplingRequirement ?? null,
        notes: dto.notes ?? null,
      }),
    )
  }

  async updateControlEvidenceMap(
    id: string,
    dto: UpdateControlEvidenceMapDto,
  ): Promise<ControlEvidenceMap> {
    this.assertNoNullUpdates(dto, ['controlId', 'evidenceId', 'requiredLevel'])

    const existing = await this.findControlEvidenceMap(id)
    const nextControlId = dto.controlId ?? existing.controlId
    const nextEvidenceId = dto.evidenceId ?? existing.evidenceId

    await this.assertControlPointExists(nextControlId)
    await this.assertEvidenceTypeExists(nextEvidenceId)
    await this.assertUniqueControlEvidenceMap(nextControlId, nextEvidenceId, id)

    Object.assign(existing, {
      controlId: nextControlId,
      evidenceId: nextEvidenceId,
      requiredLevel: dto.requiredLevel ?? existing.requiredLevel,
      frequency: this.resolveNullableField(dto, 'frequency', existing.frequency),
      ownerRole: this.resolveNullableField(dto, 'ownerRole', existing.ownerRole),
      samplingRequirement: this.resolveNullableField(
        dto,
        'samplingRequirement',
        existing.samplingRequirement,
      ),
      notes: this.resolveNullableField(dto, 'notes', existing.notes),
    })

    return this.controlEvidenceMapRepository.save(existing)
  }

  async deleteControlEvidenceMap(id: string) {
    await this.findControlEvidenceMap(id)
    await this.controlEvidenceMapRepository.delete({ id })
    return { success: true as const, id }
  }

  async findEvidencesByControlId(controlId: string): Promise<{
    controlId: string
    evidences: ControlEvidenceView[]
  }> {
    await this.findControlPoint(controlId)

    const items = await this.controlEvidenceMapRepository
      .createQueryBuilder('mapping')
      .leftJoinAndSelect('mapping.evidenceType', 'evidence')
      .where('mapping.control_id = :controlId', { controlId })
      .andWhere('evidence.status = :status', { status: 'ACTIVE' })
      .getMany()

    const requiredLevelRank = new Map(
      CONTROL_EVIDENCE_REQUIRED_LEVELS.map((value, index) => [value, index] as const),
    )

    const evidences = items
      .slice()
      .sort((left, right) => {
        const requiredLevelDiff =
          (requiredLevelRank.get(left.requiredLevel) ?? Number.MAX_SAFE_INTEGER) -
          (requiredLevelRank.get(right.requiredLevel) ?? Number.MAX_SAFE_INTEGER)

        if (requiredLevelDiff !== 0) {
          return requiredLevelDiff
        }

        return (left.evidenceType?.evidenceCode ?? '').localeCompare(
          right.evidenceType?.evidenceCode ?? '',
        )
      })
      .map((item) => ({
        id: item.id,
        evidenceId: item.evidenceType?.evidenceId ?? item.evidenceId,
        evidenceCode: item.evidenceType?.evidenceCode ?? '',
        evidenceName: item.evidenceType?.evidenceName ?? '',
        evidenceDesc: item.evidenceType?.evidenceDesc ?? null,
        evidenceCategory: item.evidenceType?.evidenceCategory ?? null,
        status: item.evidenceType?.status ?? 'INACTIVE',
        requiredLevel: item.requiredLevel,
        frequency: item.frequency ?? null,
        ownerRole: item.ownerRole ?? null,
        samplingRequirement: item.samplingRequirement ?? null,
        notes: item.notes ?? null,
      }))

    return {
      controlId,
      evidences,
    }
  }

  private async findEvidenceType(evidenceId: string): Promise<EvidenceType> {
    const evidenceType = await this.evidenceTypeRepository.findOne({ where: { evidenceId } })

    if (!evidenceType) {
      throw new NotFoundException(`evidence_type ${evidenceId} not found`)
    }

    return evidenceType
  }

  private async findControlPoint(controlId: string): Promise<ControlPoint> {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new NotFoundException(`control_point ${controlId} not found`)
    }

    return controlPoint
  }

  private async findControlEvidenceMap(id: string): Promise<ControlEvidenceMap> {
    const controlEvidenceMap = await this.controlEvidenceMapRepository.findOne({ where: { id } })

    if (!controlEvidenceMap) {
      throw new NotFoundException(`control_evidence_map ${id} not found`)
    }

    return controlEvidenceMap
  }

  private async assertUniqueEvidenceCode(evidenceCode: string, currentEvidenceId?: string) {
    const existing = await this.evidenceTypeRepository.findOne({ where: { evidenceCode } })

    if (existing && existing.evidenceId !== currentEvidenceId) {
      throw new ConflictException(`evidence_code ${evidenceCode} already exists`)
    }
  }

  private async assertControlPointExists(controlId: string) {
    const controlPoint = await this.controlPointRepository.findOne({ where: { controlId } })

    if (!controlPoint) {
      throw new BadRequestException(`control_point ${controlId} does not exist`)
    }
  }

  private async assertEvidenceTypeExists(evidenceId: string) {
    const evidenceType = await this.evidenceTypeRepository.findOne({ where: { evidenceId } })

    if (!evidenceType) {
      throw new BadRequestException(`evidence_type ${evidenceId} does not exist`)
    }
  }

  private async assertUniqueControlEvidenceMap(
    controlId: string,
    evidenceId: string,
    currentId?: string,
  ) {
    const existing = await this.controlEvidenceMapRepository.findOne({
      where: { controlId, evidenceId },
    })

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`control_evidence_map ${controlId}/${evidenceId} already exists`)
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

  private resolveNullableField<T>(
    dto: object,
    field: string,
    existingValue: T,
  ): T {
    const record = dto as Record<string, unknown>
    return Object.prototype.hasOwnProperty.call(record, field) ? (record[field] as T) : existingValue
  }
}
