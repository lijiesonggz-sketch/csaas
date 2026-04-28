export const runtimeProfileReplacementWarningText = '导入会替换当前 runtime profile snapshot'

export const governanceSummaryFixtureV1 = {
  generatedAt: '2026-04-28T02:00:00.000Z',
  sourceVersion: '2026-04-28-governance-v1',
  domains: [
    {
      l1Code: 'IT01',
      l1Name: '战略与治理',
      catalogL2Count: 2,
      runtimeProfileCount: 2,
      rulebookEntryCount: 2,
      mappingSourceVersion: '2026-04-28-governance-v1',
      rulebookVersion: 'it01-rulebook-v2',
      fallbackBucket: 'IT01-01',
      readinessStage: 'runtime-classifier-ready',
    },
    {
      l1Code: 'IT02',
      l1Name: '数据管理',
      catalogL2Count: 2,
      runtimeProfileCount: 1,
      rulebookEntryCount: 1,
      mappingSourceVersion: '2026-04-28-governance-v1',
      rulebookVersion: 'it02-rulebook-v1',
      fallbackBucket: 'IT02-01',
      readinessStage: 'runtime-classifier-ready',
    },
  ],
}

export const governanceSummaryFixtureV2 = {
  ...governanceSummaryFixtureV1,
  sourceVersion: '2026-04-29-governance-v2',
  domains: governanceSummaryFixtureV1.domains.map((domain) =>
    domain.l1Code === 'IT02'
      ? {
          ...domain,
          runtimeProfileCount: 2,
          mappingSourceVersion: '2026-04-29-governance-v2',
        }
      : {
          ...domain,
          mappingSourceVersion: '2026-04-29-governance-v2',
        }
  ),
}

export const runtimeProfileImportSuccessFixture = {
  sourceVersion: '2026-04-29-governance-v2',
  importedRowCount: 2,
  cacheRefreshed: true,
  replacedSnapshot: true,
}

export function buildRuntimeProfileUploadFile() {
  return {
    name: 'runtime-profile.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
        'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
        'IT02,数据管理,IT02-02,数据标准管理,定义数据标准治理,数据标准管理,标准治理|数据标准,标准|数据',
      ].join('\n'),
      'utf8'
    ),
  }
}
