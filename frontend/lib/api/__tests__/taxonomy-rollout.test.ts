import {
  buildTaxonomyRetirementReportUrl,
  evaluateRetirementDryRun,
  executeTaxonomyRetirement,
  rollbackTaxonomyRetirement,
} from '../taxonomy-rollout'
import { apiFetch } from '../../utils/api'

jest.mock('../../utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL

describe('Taxonomy rollout retirement API - Story 8.3', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_API_URL = ''
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL
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
})
