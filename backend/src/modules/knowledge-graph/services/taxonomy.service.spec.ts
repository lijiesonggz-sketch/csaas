import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import { TaxonomyL1 } from '../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2 } from '../../../database/entities/taxonomy-l2.entity'
import { TaxonomyService } from './taxonomy.service'

describe('TaxonomyService', () => {
  let service: TaxonomyService

  const taxonomyL1Repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const taxonomyL2Repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxonomyService,
        {
          provide: getRepositoryToken(TaxonomyL1),
          useValue: taxonomyL1Repository,
        },
        {
          provide: getRepositoryToken(TaxonomyL2),
          useValue: taxonomyL2Repository,
        },
      ],
    }).compile()

    service = module.get(TaxonomyService)
    jest.clearAllMocks()
  })

  it('should build taxonomy tree grouped by l1Code', async () => {
    taxonomyL1Repository.find.mockResolvedValue([
      {
        l1Code: 'IT02',
        l1Name: '网络与信息安全',
        sortOrder: 20,
      },
    ])
    taxonomyL2Repository.find.mockResolvedValue([
      {
        l2Code: 'IT02-03',
        l1Code: 'IT02',
        l2Name: '访问控制与授权管理',
        sortOrder: 23,
        status: 'ACTIVE',
      },
    ])

    const result = await service.getTree({ status: 'ACTIVE' })

    expect(taxonomyL1Repository.find).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      order: { sortOrder: 'ASC', l1Code: 'ASC' },
    })
    expect(result).toEqual([
      {
        l1Code: 'IT02',
        l1Name: '网络与信息安全',
        sortOrder: 20,
        children: [
          {
            l2Code: 'IT02-03',
            l1Code: 'IT02',
            l2Name: '访问控制与授权管理',
            sortOrder: 23,
            status: 'ACTIVE',
          },
        ],
      },
    ])
  })

  it('should filter taxonomy tree by l1Code, l2Code and keyword', async () => {
    taxonomyL1Repository.find.mockResolvedValue([
      {
        l1Code: 'IT02',
        l1Name: '网络与信息安全',
        sortOrder: 20,
      },
    ])
    taxonomyL2Repository.find.mockResolvedValue([
      {
        l2Code: 'IT02-03',
        l1Code: 'IT02',
        l2Name: '访问控制与授权管理',
        sortOrder: 23,
        status: 'ACTIVE',
      },
      {
        l2Code: 'IT02-05',
        l1Code: 'IT02',
        l2Name: '边界安全管理',
        sortOrder: 25,
        status: 'ACTIVE',
      },
    ])

    const result = await service.getTree({
      status: 'ACTIVE',
      l1Code: 'IT02',
      keyword: '访问',
    })

    expect(taxonomyL1Repository.find).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', l1Code: 'IT02' },
      order: { sortOrder: 'ASC', l1Code: 'ASC' },
    })
    expect(taxonomyL2Repository.find).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', l1Code: 'IT02' },
      order: { sortOrder: 'ASC', l2Code: 'ASC' },
    })
    expect(result).toEqual([
      {
        l1Code: 'IT02',
        l1Name: '网络与信息安全',
        sortOrder: 20,
        children: [
          {
            l2Code: 'IT02-03',
            l1Code: 'IT02',
            l2Name: '访问控制与授权管理',
            sortOrder: 23,
            status: 'ACTIVE',
          },
        ],
      },
    ])
  })

  it('should create l1 when code is unique', async () => {
    const created = {
      l1Code: 'IT01',
      l1Name: '信息科技治理与风险管理',
      sortOrder: 10,
      status: 'ACTIVE' as const,
    }

    taxonomyL1Repository.findOne.mockResolvedValue(null)
    taxonomyL1Repository.create.mockReturnValue(created)
    taxonomyL1Repository.save.mockResolvedValue(created)

    const result = await service.createL1(created)

    expect(taxonomyL1Repository.save).toHaveBeenCalledWith(created)
    expect(result).toEqual(created)
  })

  it('should reject creating l2 when parent l1 does not exist', async () => {
    taxonomyL2Repository.findOne.mockResolvedValue(null)
    taxonomyL1Repository.findOne.mockResolvedValue(null)

    await expect(
      service.createL2({
        l2Code: 'IT02-03',
        l1Code: 'IT02',
        l2Name: '访问控制与授权管理',
      }),
    ).rejects.toThrow(new BadRequestException('taxonomy_l1 IT02 does not exist'))
  })

  it('should reject creating l2 when l2Code prefix does not match l1Code', async () => {
    taxonomyL2Repository.findOne.mockResolvedValue(null)

    await expect(
      service.createL2({
        l2Code: 'IT04-06',
        l1Code: 'IT02',
        l2Name: '访问控制与授权管理',
      }),
    ).rejects.toThrow(
      new BadRequestException('taxonomy_l2 IT04-06 does not belong to taxonomy_l1 IT02'),
    )
  })
})
