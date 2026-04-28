import { Test } from '@nestjs/testing'
import { TAXONOMY_CLASSIFIER_ATDD_INVALID_MAPPING_CSV } from '../../testing/taxonomy-classification-atdd.fixtures'
import {
  TAXONOMY_CLASSIFIER_AUTOMATE_MALFORMED_CSV,
  TAXONOMY_CLASSIFIER_AUTOMATE_MISSING_MAPPING_PATH,
} from '../../testing/taxonomy-classification-automate.fixtures'
import {
  CSV_BACKED_MAPPING_REPOSITORY_OPTIONS,
  CsvBackedMappingRepository,
} from './csv-backed-mapping.repository'
import { TAXONOMY_MAPPING_REPOSITORY } from './mapping-repository.interface'

describe('CsvBackedMappingRepository', () => {
  it('should resolve as a Nest provider without requiring an Object token dependency', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: CSV_BACKED_MAPPING_REPOSITORY_OPTIONS,
          useValue: {
            csvText: [
              '一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
              'IT04,数据治理,IT04-10,信息登记/录入/更新不及时不规范,样例定义,信息更新,台账更新|登记补录,登记|更新',
            ].join('\n'),
            mappingVersion: '2026-04-07',
          },
        },
        CsvBackedMappingRepository,
        {
          provide: TAXONOMY_MAPPING_REPOSITORY,
          useExisting: CsvBackedMappingRepository,
        },
      ],
    }).compile()

    const repository = moduleRef.get<CsvBackedMappingRepository>(TAXONOMY_MAPPING_REPOSITORY)

    expect(repository.getVersion()).toBe('2026-04-07')
    expect(repository.loadByL1Code('IT04')).toHaveLength(1)
  })

  it('should load mappings by l1Code and load all rows from the taxonomy CSV', () => {
    const repository = new CsvBackedMappingRepository({
      mappingPath: 'docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv',
    })

    const allMappings = repository.loadAll()
    const it04Mappings = repository.loadByL1Code('IT04')

    expect(allMappings.length).toBeGreaterThan(0)
    expect(it04Mappings.length).toBeGreaterThan(0)
    expect(it04Mappings.every((mapping) => mapping.l1Code === 'IT04')).toBe(true)
    expect(repository.getVersion()).toBe('2026-04-07')
  })

  it('should throw when the mapping CSV schema is missing required columns', () => {
    const repository = new CsvBackedMappingRepository({
      csvText: TAXONOMY_CLASSIFIER_ATDD_INVALID_MAPPING_CSV,
      mappingVersion: 'invalid-fixture',
    })

    expect(() => repository.loadAll()).toThrow(/schema validation failed/i)
  })

  it('should require an explicit version when the mapping path filename is not versioned', () => {
    expect(
      () =>
        new CsvBackedMappingRepository({
          mappingPath: 'docs/taxonomy.csv',
        }),
    ).toThrow(/version is not parseable/i)
  })

  it('should defer missing-file failure until mappings are actually loaded', () => {
    const repository = new CsvBackedMappingRepository({
      mappingPath: TAXONOMY_CLASSIFIER_AUTOMATE_MISSING_MAPPING_PATH,
    })

    expect(repository.getVersion()).toBe('2026-04-07')
    expect(() => repository.loadAll()).toThrow(/not found/i)
  })

  it('should fail fast when Papa parsing reports malformed CSV rows', () => {
    const repository = new CsvBackedMappingRepository({
      csvText: TAXONOMY_CLASSIFIER_AUTOMATE_MALFORMED_CSV,
      mappingVersion: 'invalid-fixture',
    })

    expect(() => repository.loadAll()).toThrow(/parse errors/i)
  })
})
