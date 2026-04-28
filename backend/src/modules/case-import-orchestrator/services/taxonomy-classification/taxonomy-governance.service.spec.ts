import { DataSource, Repository } from 'typeorm'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { TaxonomyL1 } from '../../../../database/entities/taxonomy-l1.entity'
import { TaxonomyL2RuntimeProfile } from '../../../../database/entities/taxonomy-l2-runtime-profile.entity'
import { TaxonomyL2 } from '../../../../database/entities/taxonomy-l2.entity'
import { TypeOrmBackedMappingRepository } from './typeorm-backed-mapping.repository'
import { TaxonomyGovernanceService } from './taxonomy-governance.service'

describe('Story 7.4 ATDD RED - TaxonomyGovernanceService', () => {
  let dataSource: jest.Mocked<DataSource>
  let taxonomyL1Repository: jest.Mocked<Repository<TaxonomyL1>>
  let runtimeProfileRepository: jest.Mocked<Repository<TaxonomyL2RuntimeProfile>>
  let taxonomyL2Repository: jest.Mocked<Repository<TaxonomyL2>>
  let mappingRepository: jest.Mocked<TypeOrmBackedMappingRepository>
  let queryRunnerRuntimeProfileRepository: { upsert: jest.Mock }
  let queryRunnerAuditLogRepository: { save: jest.Mock }
  let queryRunner: {
    connect: jest.Mock
    startTransaction: jest.Mock
    commitTransaction: jest.Mock
    rollbackTransaction: jest.Mock
    release: jest.Mock
    query: jest.Mock
    isTransactionActive: boolean
    manager: {
      getRepository: jest.Mock
    }
  }
  let service: TaxonomyGovernanceService

  beforeEach(() => {
    queryRunnerRuntimeProfileRepository = {
      upsert: jest.fn(),
    }
    queryRunnerAuditLogRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    }

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      isTransactionActive: true,
      manager: {
        getRepository: jest.fn().mockImplementation((entity) => {
          const entityName = entity?.name
          if (entityName === 'AuditLog') {
            return queryRunnerAuditLogRepository
          }

          return queryRunnerRuntimeProfileRepository
        }),
      },
    }

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>

    taxonomyL1Repository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TaxonomyL1>>

    runtimeProfileRepository = {
      find: jest.fn(),
      upsert: jest.fn(),
    } as unknown as jest.Mocked<Repository<TaxonomyL2RuntimeProfile>>

    taxonomyL2Repository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TaxonomyL2>>

    mappingRepository = {
      refreshCache: jest.fn(),
      loadAll: jest.fn(),
      getVersion: jest.fn(),
      loadByL1Code: jest.fn(),
      snapshotCacheState: jest.fn().mockReturnValue(null),
      replaceCacheState: jest.fn(),
    } as unknown as jest.Mocked<TypeOrmBackedMappingRepository>

    service = new TaxonomyGovernanceService(
      dataSource,
      taxonomyL1Repository,
      taxonomyL2Repository,
      runtimeProfileRepository,
      mappingRepository,
    )
  })

  test('[P0][7.4-SVC-001] should import a full snapshot transactionally and atomically replace TypeOrmBackedMappingRepository cache on success', async () => {
    const csvText = [
      '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
      'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
    ].join('\n')

    taxonomyL2Repository.find.mockResolvedValue([
      {
        l1Code: 'IT01',
        l2Code: 'IT01-01',
        l2Name: 'IT战略规划',
        status: 'ACTIVE',
        parent: {
          l1Code: 'IT01',
          l1Name: '战略与治理',
        },
      },
    ] as unknown as TaxonomyL2[])

    await service.importRuntimeProfile({
      tenantId: '11111111-1111-1111-1111-111111111111',
      actorUserId: '22222222-2222-2222-2222-222222222222',
      sourceVersion: '2026-04-29-governance-v2',
      csvText,
    })

    expect(queryRunnerRuntimeProfileRepository.upsert).toHaveBeenCalled()
    expect(mappingRepository.replaceCacheState).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          l1Code: 'IT01',
          l1Name: '战略与治理',
          l2Code: 'IT01-01',
          l2Name: 'IT战略规划',
        }),
      ],
      '2026-04-29-governance-v2',
    )
    expect(mappingRepository.refreshCache).not.toHaveBeenCalled()
  })

  test('[P0][7.4-SVC-002] should aggregate governance summary from ACTIVE taxonomy catalog/runtime rows, rulebook manifests, and readiness registry', async () => {
    taxonomyL2Repository.find.mockResolvedValue([
      { l1Code: 'IT01', l2Code: 'IT01-01', l2Name: 'IT战略规划', status: 'ACTIVE' },
      { l1Code: 'IT01', l2Code: 'IT01-02', l2Name: 'IT治理架构', status: 'ACTIVE' },
    ] as unknown as TaxonomyL2[])
    taxonomyL1Repository.find.mockResolvedValue([
      {
        l1Code: 'IT01',
        l1Name: '战略与治理',
        sortOrder: 1,
        status: 'ACTIVE',
      },
    ] as unknown as TaxonomyL1[])

    runtimeProfileRepository.find.mockResolvedValue([
      {
        l2Code: 'IT01-01',
        sourceVersion: '2026-04-28-governance-v1',
        definition: '定义战略治理范围',
        canonicalTheme: 'IT战略规划',
        aliasesJson: ['战略规划', '治理蓝图'],
        keywordsJson: ['战略', '规划'],
        taxonomyL2: {
          l1Code: 'IT01',
          l2Code: 'IT01-01',
          l2Name: 'IT战略规划',
          status: 'ACTIVE',
        },
      },
      {
        l2Code: 'IT01-99',
        sourceVersion: 'legacy-retired-version',
        definition: '旧运行时映射',
        canonicalTheme: '旧映射',
        aliasesJson: ['旧别名'],
        keywordsJson: ['旧关键字'],
        taxonomyL2: {
          l1Code: 'IT01',
          l2Code: 'IT01-99',
          l2Name: '旧分类',
          status: 'INACTIVE',
        },
      },
    ] as unknown as TaxonomyL2RuntimeProfile[])

    const summary = await service.getSummary('11111111-1111-1111-1111-111111111111')

    expect(summary.sourceVersion).toBe('2026-04-28-governance-v1')
    expect(summary.domains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          l1Code: 'IT01',
          catalogL2Count: 2,
          runtimeProfileCount: 1,
        }),
      ]),
    )
  })

  test('[P1][7.4-SVC-003] should export ACTIVE runtime profile rows back to canonical CSV schema with BOM and pipe-delimited aliases/keywords', async () => {
    runtimeProfileRepository.find.mockResolvedValue([
      {
        l2Code: 'IT01-01',
        sourceVersion: '2026-04-28-governance-v1',
        definition: '定义战略治理范围',
        canonicalTheme: 'IT战略规划',
        aliasesJson: ['战略规划', '治理蓝图'],
        keywordsJson: ['战略', '规划'],
        taxonomyL2: {
          l1Code: 'IT01',
          l2Code: 'IT01-01',
          l2Name: 'IT战略规划',
          status: 'ACTIVE',
          parent: {
            l1Code: 'IT01',
            l1Name: '战略与治理',
          },
        },
      },
      {
        l2Code: 'IT01-99',
        sourceVersion: 'legacy-retired-version',
        definition: '旧运行时映射',
        canonicalTheme: '旧映射',
        aliasesJson: ['旧别名'],
        keywordsJson: ['旧关键字'],
        taxonomyL2: {
          l1Code: 'IT01',
          l2Code: 'IT01-99',
          l2Name: '旧分类',
          status: 'INACTIVE',
          parent: {
            l1Code: 'IT01',
            l1Name: '战略与治理',
          },
        },
      },
    ] as unknown as TaxonomyL2RuntimeProfile[])

    const exportResult = await service.exportRuntimeProfileCsv(
      '11111111-1111-1111-1111-111111111111',
    )

    expect(exportResult.csvContent.startsWith('\uFEFF一级编码,一级类型,二级编码')).toBe(true)
    expect(exportResult.csvContent).toContain('战略规划|治理蓝图')
    expect(exportResult.csvContent).toContain('战略|规划')
    expect(exportResult.csvContent).not.toContain('IT01-99')
    expect(exportResult.rowCount).toBe(1)
  })

  test('[P0][7.4-SVC-004] should reject imports that do not provide a full ACTIVE taxonomy_l2 snapshot', async () => {
    const csvText = [
      '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
      'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
    ].join('\n')

    taxonomyL2Repository.find
      .mockResolvedValueOnce([
        {
          l1Code: 'IT01',
          l2Code: 'IT01-01',
          l2Name: 'IT战略规划',
          status: 'ACTIVE',
          parent: { l1Code: 'IT01', l1Name: '战略与治理' },
        },
      ] as unknown as TaxonomyL2[])
      .mockResolvedValueOnce([
        { l2Code: 'IT01-01' },
        { l2Code: 'IT01-02' },
      ] as unknown as TaxonomyL2[])

    await expect(
      service.importRuntimeProfile({
        tenantId: '11111111-1111-1111-1111-111111111111',
        actorUserId: '22222222-2222-2222-2222-222222222222',
        sourceVersion: '2026-04-29-governance-v2',
        csvText,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  test('[P0][7.4-SVC-006] should classify malformed runtime profile CSV as a BadRequestException', async () => {
    const malformedCsvText = [
      '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases',
      'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图',
    ].join('\n')

    await expect(
      service.importRuntimeProfile({
        tenantId: '11111111-1111-1111-1111-111111111111',
        actorUserId: '22222222-2222-2222-2222-222222222222',
        sourceVersion: '2026-04-29-governance-v2',
        csvText: malformedCsvText,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled()
    expect(mappingRepository.replaceCacheState).not.toHaveBeenCalled()
  })

  test('[P0][7.4-SVC-005] should preserve 5xx semantics for commit/cache infrastructure failures', async () => {
    const csvText = [
      '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
      'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
    ].join('\n')

    taxonomyL2Repository.find.mockResolvedValue([
      {
        l1Code: 'IT01',
        l2Code: 'IT01-01',
        l2Name: 'IT战略规划',
        status: 'ACTIVE',
        parent: {
          l1Code: 'IT01',
          l1Name: '战略与治理',
        },
      },
    ] as unknown as TaxonomyL2[])
    queryRunner.commitTransaction.mockRejectedValue(new Error('commit failed'))

    await expect(
      service.importRuntimeProfile({
        tenantId: '11111111-1111-1111-1111-111111111111',
        actorUserId: '22222222-2222-2222-2222-222222222222',
        sourceVersion: '2026-04-29-governance-v2',
        csvText,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException)

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1)
    expect(mappingRepository.replaceCacheState).not.toHaveBeenCalled()
  })
})
