import { seedTaxonomyRuntimeProfiles } from './kg-seed.service'

describe('seedTaxonomyRuntimeProfiles', () => {
  it('should upsert runtime profile companion rows keyed by l2Code', async () => {
    const runtimeProfileRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn().mockReturnValue(runtimeProfileRepository),
      },
    }

    const summary = await seedTaxonomyRuntimeProfiles(
      queryRunner as never,
      [
        {
          l1Code: 'IT04',
          l1Name: '数据治理与监管数据报送',
          l2Code: 'IT04-10',
          l2Name: '信息登记/录入/更新不及时不规范',
          definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
          canonicalTheme: '信息登记与更新管理',
          aliases: ['信息登记', '录入更新'],
          keywords: ['录入不及时', '更新不及时'],
        },
      ],
      '2026-04-07',
    )

    expect(runtimeProfileRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          l2Code: 'IT04-10',
          definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
          canonicalTheme: '信息登记与更新管理',
          aliasesJson: ['信息登记', '录入更新'],
          keywordsJson: ['录入不及时', '更新不及时'],
          sourceVersion: '2026-04-07',
        }),
      ],
      ['l2Code'],
    )
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM taxonomy_l2_runtime_profiles'),
      ['2026-04-07', ['IT04-10']],
    )
    expect(summary).toBe(1)
  })

  it('should delete stale rows from previous source versions before upserting the current dataset', async () => {
    const runtimeProfileRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn().mockReturnValue(runtimeProfileRepository),
      },
    }

    await seedTaxonomyRuntimeProfiles(
      queryRunner as never,
      [
        {
          l1Code: 'IT04',
          l1Name: '数据治理与监管数据报送',
          l2Code: 'IT04-10',
          l2Name: '信息登记/录入/更新不及时不规范',
          definition: 'definition',
          canonicalTheme: 'theme',
          aliases: [],
          keywords: [],
        },
      ],
      '2026-05-01',
    )

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM taxonomy_l2_runtime_profiles'),
      ['2026-05-01', ['IT04-10']],
    )
  })

  it('should fail fast when the imported runtime profile dataset contains duplicate l2Code rows', async () => {
    const queryRunner = {
      query: jest.fn(),
      manager: {
        getRepository: jest.fn(),
      },
    }

    await expect(
      seedTaxonomyRuntimeProfiles(
        queryRunner as never,
        [
          {
            l1Code: 'IT04',
            l1Name: '数据治理与监管数据报送',
            l2Code: 'IT04-10',
            l2Name: '信息登记/录入/更新不及时不规范',
            definition: 'definition',
            canonicalTheme: 'theme',
            aliases: [],
            keywords: [],
          },
          {
            l1Code: 'IT04',
            l1Name: '数据治理与监管数据报送',
            l2Code: 'IT04-10',
            l2Name: '信息登记/录入/更新不及时不规范',
            definition: 'definition-duplicate',
            canonicalTheme: 'theme',
            aliases: [],
            keywords: [],
          },
        ],
        '2026-05-01',
      ),
    ).rejects.toThrow(/Duplicate taxonomy runtime profile mapping/i)
  })
})
