import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { TaxonomyL2RuntimeProfile } from '../../../../database/entities/taxonomy-l2-runtime-profile.entity'
import { TypeOrmBackedMappingRepository } from './typeorm-backed-mapping.repository'
import { TAXONOMY_MAPPING_REPOSITORY } from './mapping-repository.interface'

describe('TypeOrmBackedMappingRepository', () => {
  const createMockRuntimeProfileRepository = () => ({
    find: jest.fn(),
  })

  const createHydratedRows = () => [
    {
      l2Code: 'IT04-10',
      definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
      canonicalTheme: '信息登记与更新管理',
      aliasesJson: ['信息登记', '录入更新'],
      keywordsJson: ['录入不及时', '更新不及时'],
      sourceVersion: '2026-04-07',
      taxonomyL2: {
        l2Code: 'IT04-10',
        l1Code: 'IT04',
        l2Name: '信息登记/录入/更新不及时不规范',
        parent: {
          l1Code: 'IT04',
          l1Name: '数据治理与监管数据报送',
        },
      },
    },
  ]

  it('should resolve as the default mapping repository token and expose contract-parity records after cache hydration', async () => {
    const runtimeProfileRepository = createMockRuntimeProfileRepository()
    runtimeProfileRepository.find.mockResolvedValue(createHydratedRows())

    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmBackedMappingRepository,
        {
          provide: getRepositoryToken(TaxonomyL2RuntimeProfile),
          useValue: runtimeProfileRepository,
        },
        {
          provide: TAXONOMY_MAPPING_REPOSITORY,
          useExisting: TypeOrmBackedMappingRepository,
        },
      ],
    }).compile()

    const repository = moduleRef.get<TypeOrmBackedMappingRepository>(TAXONOMY_MAPPING_REPOSITORY)

    await repository.refreshCache()

    expect(repository.getVersion()).toBe('2026-04-07')
    expect(repository.loadByL1Code('IT04')).toEqual([
      expect.objectContaining({
        l1Code: 'IT04',
        l1Name: '数据治理与监管数据报送',
        l2Code: 'IT04-10',
        l2Name: '信息登记/录入/更新不及时不规范',
        definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
        canonicalTheme: '信息登记与更新管理',
        aliases: ['信息登记', '录入更新'],
        keywords: ['录入不及时', '更新不及时'],
      }),
    ])
  })

  it('should fail fast when runtime profile table has no rows', async () => {
    const repository = new TypeOrmBackedMappingRepository({
      find: jest.fn().mockResolvedValue([]),
    } as never)

    await expect(repository.refreshCache()).rejects.toThrow(/no taxonomy runtime profiles/i)
  })

  it('should fail fast when active runtime profiles contain inconsistent source versions', async () => {
    const repository = new TypeOrmBackedMappingRepository({
      find: jest.fn().mockResolvedValue([
        {
          l2Code: 'IT01-01',
          definition: 'd1',
          canonicalTheme: 'c1',
          aliasesJson: [],
          keywordsJson: [],
          sourceVersion: '2026-04-07',
          taxonomyL2: {
            l2Code: 'IT01-01',
            l1Code: 'IT01',
            l2Name: 'n1',
            parent: { l1Code: 'IT01', l1Name: 'l1' },
          },
        },
        {
          l2Code: 'IT01-02',
          definition: 'd2',
          canonicalTheme: 'c2',
          aliasesJson: [],
          keywordsJson: [],
          sourceVersion: '2026-05-01',
          taxonomyL2: {
            l2Code: 'IT01-02',
            l1Code: 'IT01',
            l2Name: 'n2',
            parent: { l1Code: 'IT01', l1Name: 'l1' },
          },
        },
      ]),
    } as never)

    await expect(repository.refreshCache()).rejects.toThrow(/inconsistent sourceVersion/i)
  })

  it('should fail fast when runtime profile rows are detached from taxonomy_l2 or parent l1 metadata', async () => {
    const repository = new TypeOrmBackedMappingRepository({
      find: jest.fn().mockResolvedValue([
        {
          l2Code: 'IT02-03',
          definition: 'd1',
          canonicalTheme: 'c1',
          aliasesJson: [],
          keywordsJson: [],
          sourceVersion: '2026-04-07',
          taxonomyL2: null,
        },
      ]),
    } as never)

    await expect(repository.refreshCache()).rejects.toThrow(/missing taxonomy_l2 relation/i)
  })

  it('should hydrate cache during onModuleInit so subsequent reads do not require explicit refreshCache calls', async () => {
    const runtimeProfileRepository = createMockRuntimeProfileRepository()
    runtimeProfileRepository.find.mockResolvedValue(createHydratedRows())

    const repository = new TypeOrmBackedMappingRepository(runtimeProfileRepository as never)

    await repository.onModuleInit()

    expect(runtimeProfileRepository.find).toHaveBeenCalledTimes(1)
    expect(repository.getVersion()).toBe('2026-04-07')
    expect(repository.loadAll()).toHaveLength(1)
  })
})
