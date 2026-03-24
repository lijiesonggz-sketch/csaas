import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import {
  CreateTaxonomyL1Dto,
  CreateTaxonomyL2Dto,
  QueryTaxonomyTreeDto,
  UpdateTaxonomyL1Dto,
  UpdateTaxonomyL2Dto,
} from '../dto/taxonomy.dto'

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(TaxonomyL1)
    private readonly taxonomyL1Repository: Repository<TaxonomyL1>,
    @InjectRepository(TaxonomyL2)
    private readonly taxonomyL2Repository: Repository<TaxonomyL2>,
  ) {}

  async getTree(query: QueryTaxonomyTreeDto): Promise<
    Array<{
      l1Code: string
      l1Name: string
      sortOrder: number
      children: TaxonomyL2[]
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

    const childrenByL1Code = new Map<string, TaxonomyL2[]>()

    for (const item of filteredL2Items) {
      const current = childrenByL1Code.get(item.l1Code) ?? []
      current.push(item)
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
