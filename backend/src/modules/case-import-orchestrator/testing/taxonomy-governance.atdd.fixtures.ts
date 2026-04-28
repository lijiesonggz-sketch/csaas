export type RequestContext = {
  tenantId?: string
  userId?: string
  authenticated?: boolean
  role?: string
}

export const VALID_TENANT_ID = '11111111-1111-1111-1111-111111111111'
export const VALID_ADMIN_USER_ID = '22222222-2222-2222-2222-222222222222'
export const VALID_CONSULTANT_USER_ID = '33333333-3333-3333-3333-333333333333'

export const adminContext: RequestContext = {
  tenantId: VALID_TENANT_ID,
  userId: VALID_ADMIN_USER_ID,
  authenticated: true,
  role: 'admin',
}

export const consultantContext: RequestContext = {
  tenantId: VALID_TENANT_ID,
  userId: VALID_CONSULTANT_USER_ID,
  authenticated: true,
  role: 'consultant',
}

export const runtimeProfileExportFileName = 'taxonomy-runtime-profile-2026-04-28-governance-v1.csv'

export const runtimeProfileExportCsv = [
  '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
  'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
  'IT02,数据管理,IT02-01,数据质量管理,定义数据质量要求,数据质量管理,质量治理|数据质量,质量|数据',
].join('\n')

export const runtimeProfileImportRequest = {
  sourceVersion: '2026-04-29-governance-v2',
}

export const runtimeProfileImportSuccessResponse = {
  success: true,
  data: {
    sourceVersion: '2026-04-29-governance-v2',
    importedRowCount: 2,
    cacheRefreshed: true,
    replacedSnapshot: true,
  },
}

export const governanceSummaryResponse = {
  success: true,
  data: {
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
  },
}

export const duplicateL2Csv = [
  '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
  'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,IT战略规划,战略规划|治理蓝图,战略|规划',
  'IT01,战略与治理,IT01-01,IT战略规划副本,重复记录,IT战略规划,战略规划|治理蓝图,战略|规划',
].join('\n')

export const orphanL2Csv = [
  '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
  'IT09,未知域,IT09-01,不存在的分类,孤立分类,未知主题,未知别名,未知关键字',
].join('\n')

export const invalidHeaderCsv = [
  '\uFEFF一级编码,一级类型,二级编码,二级子类型,定义口径,缺失列A,缺失列B',
  'IT01,战略与治理,IT01-01,IT战略规划,定义战略治理范围,错误,错误',
].join('\n')

export const mixedVersionImportRequest = {
  sourceVersion: 'invalid-mixed-version',
}
