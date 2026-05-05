import {
  backfillTaxonomyCases,
  buildTaxonomyRetirementReportUrl,
  buildTaxonomyRolloutReportUrl,
  evaluateRetirementDryRun,
  executeTaxonomyRetirement,
  fetchTaxonomyRolloutReports,
  reclassifyTaxonomyCases,
  rollbackTaxonomyRetirement,
} from '../taxonomy-rollout'
import { apiFetch, getAuthToken } from '../../utils/api'

jest.mock('../../utils/api', () => ({
  apiFetch: jest.fn(),
  clearTokenCache: jest.fn(),
  getAuthToken: jest.fn(),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>
const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL
const originalFetch = global.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('Taxonomy rollout retirement API - Story 8.3', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_API_URL = ''
    mockGetAuthToken.mockResolvedValue('token-1')
    global.fetch = jest.fn()
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL
    global.fetch = originalFetch
  })

  test('[8.3-API-001][P0] posts dry-run requests to the formal retirement endpoint', async () => {
    const response = { l1Code: 'IT04', allowed: true }
    mockApiFetch.mockResolvedValue(response)

    const result = await evaluateRetirementDryRun({ l1Code: 'IT04' })

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy-rollout/retirement/dry-run',
      {
        method: 'POST',
        body: JSON.stringify({ l1Code: 'IT04' }),
      }
    )
    expect(result).toBe(response)
  })

  test('[8.3-API-002][P0] posts legacy-off execution payloads without changing confirmation data', async () => {
    const response = { l1Code: 'IT04', targetState: 'legacy-off' }
    const payload = {
      l1Code: 'IT04',
      releaseId: 'rel-8-3-001',
      confirmationText: 'IT04',
    }
    mockApiFetch.mockResolvedValue(response)

    const result = await executeTaxonomyRetirement(payload)

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy-rollout/retirement/execute',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
    expect(result).toBe(response)
  })

  test('[8.3-API-003][P0] posts rollback payloads through the dedicated rollback contract', async () => {
    const response = {
      l1Code: 'IT04',
      targetState: 'domain-primary',
      legacyFallbackRestored: true,
    }
    const payload = {
      l1Code: 'IT04',
      targetState: 'domain-primary' as const,
      confirmationText: 'IT04',
      restoreLegacyFallback: true,
    }
    mockApiFetch.mockResolvedValue(response)

    const result = await rollbackTaxonomyRetirement(payload)

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy-rollout/retirement/rollback',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
    expect(result).toBe(response)
  })

  test('[8.3-API-004][P1] builds audited report URLs only for public taxonomy retirement reports', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.csaas.test/'

    expect(
      buildTaxonomyRetirementReportUrl(
        '/reports/taxonomy-retirement/retirement-IT04-rel-8-3-001.json'
      )
    ).toBe(
      'https://api.csaas.test/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=%2Freports%2Ftaxonomy-retirement%2Fretirement-IT04-rel-8-3-001.json'
    )

    expect(
      buildTaxonomyRetirementReportUrl('taxonomy-retirement/retirement-IT04-rel-8-3-001.json')
    ).toBe(
      'https://api.csaas.test/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=taxonomy-retirement%2Fretirement-IT04-rel-8-3-001.json'
    )
  })

  test.each([
    null,
    undefined,
    '',
    '   ',
    '/reports/taxonomy-retirement/nested/retirement-IT04.json',
    '/reports/taxonomy-retirement/../retirement-IT04.json',
    '/reports/taxonomy-retirement/retirement-IT04.txt',
    '/reports/other/retirement-IT04.json',
    'https://example.test/reports/taxonomy-retirement/retirement-IT04.json',
    'D:\\csaas\\_bmad-output\\test-artifacts\\taxonomy-retirement\\retirement-IT04.json',
  ])('[8.3-API-005][P1] rejects unsafe report path %p', (reportPath) => {
    expect(buildTaxonomyRetirementReportUrl(reportPath)).toBeNull()
  })

  test('[8.4-API-001][P0] posts reclassify requests to the formal recovery endpoint', async () => {
    const response = {
      operation: 'reclassify',
      l1Code: 'IT04',
      processedCount: 3,
      affectedDomains: ['IT04'],
      latestPointerUpdated: false,
      classifierVersion: 'taxonomy-classifier-6.7',
    }
    const payload = {
      l1Code: 'IT04',
      batchId: 'batch-1',
      caseIds: ['case-1', 'case-2'],
      classifierVersion: 'taxonomy-classifier-6.7',
      shadowOnly: true,
      dryRun: true,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: response })
    )

    const result = await reclassifyTaxonomyCases(payload)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy-rollout/reclassify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    )
    expect(result).toBe(response)
  })

  test('[8.4-API-002][P0] posts backfill requests to the formal recovery endpoint', async () => {
    const response = {
      operation: 'backfill',
      l1Code: 'IT05',
      processedCount: 4,
      affectedDomains: ['IT05'],
      latestPointerUpdated: false,
      classifierVersion: null,
    }
    const payload = {
      l1Code: 'IT05',
      batchId: 'batch-2',
      caseIds: ['case-3'],
      dryRun: false,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: response })
    )

    const result = await backfillTaxonomyCases(payload)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy-rollout/backfill',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    )
    expect(result).toBe(response)
  })

  test('[8.4-API-003][P0] fetches report history with page and limit plus optional filters', async () => {
    const response = {
      items: [],
      page: 2,
      limit: 25,
      total: 0,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ success: true, data: response })
    )

    const result = await fetchTaxonomyRolloutReports({
      l1Code: 'it04',
      page: 2,
      limit: 25,
      dateFrom: '2026-05-01',
      dateTo: '2026-05-05',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/knowledge-graph/taxonomy-rollout/reports?page=2&limit=25&l1Code=IT04&dateFrom=2026-05-01&dateTo=2026-05-05',
      expect.any(Object)
    )
    expect(result).toBe(response)
  })

  test('[8.4-API-004][P1] preserves recovery error code and audit id from nested API errors', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'RECLASSIFY_BLOCKED',
            message: 'Recovery operation blocked',
            auditId: 'audit-reclassify-1',
          },
        },
        409
      )
    )

    await expect(
      reclassifyTaxonomyCases({ l1Code: 'IT04', dryRun: true, shadowOnly: true })
    ).rejects.toMatchObject({
      message: 'Recovery operation blocked',
      status: 409,
      code: 'RECLASSIFY_BLOCKED',
      auditId: 'audit-reclassify-1',
    })
  })

  test('[8.4-API-005][P1] builds recovery report URLs only for allowlisted report folders', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.csaas.test/'

    expect(
      buildTaxonomyRolloutReportUrl('/reports/taxonomy-recovery/reclassify/IT04-dry-run.json')
    ).toBe(
      'https://api.csaas.test/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=%2Freports%2Ftaxonomy-recovery%2Freclassify%2FIT04-dry-run.json'
    )

    expect(buildTaxonomyRolloutReportUrl('taxonomy-recovery/backfill/IT05-dry-run.json')).toBe(
      'https://api.csaas.test/api/admin/knowledge-graph/taxonomy-rollout/retirement/report?path=taxonomy-recovery%2Fbackfill%2FIT05-dry-run.json'
    )

    expect(
      buildTaxonomyRolloutReportUrl('/reports/taxonomy-recovery/reclassify/nested/IT04.json')
    ).toBeNull()
    expect(buildTaxonomyRolloutReportUrl('/reports/taxonomy-recovery/other/IT04.json')).toBeNull()
    expect(buildTaxonomyRolloutReportUrl('D:\\csaas\\report.json')).toBeNull()
  })
})
