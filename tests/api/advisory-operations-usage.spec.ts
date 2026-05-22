import { expect, test } from '@playwright/test'

const API_BASE_URL = process.env.BACKEND_URL ?? process.env.API_URL ?? 'http://localhost:3000'
const adminToken = process.env.ATDD_ADMIN_TOKEN ?? 'red-phase-admin-token'
const nonAdminToken = process.env.ATDD_NON_ADMIN_TOKEN ?? 'red-phase-non-admin-token'

const authHeaders = (token = adminToken) => ({
  Accept: 'application/json',
  Authorization: `Bearer ${token}`,
})

test.describe('Story 6.1 operations usage HTTP API contract (ATDD RED)', () => {
  test.skip('[P1][6.1-API-004][AC1,AC3,AC4] returns a privacy-safe usage dashboard envelope for tenant/date filters', async ({ request }) => {
    // Provider endpoint: TODO - new backend endpoint, not yet implemented.
    /*
     * Provider Scrutiny Evidence:
     * - Endpoint: GET /advisory/admin/operations/usage.
     * - Status: 200 for authenticated admin operator.
     * - Required envelope: { data }.
     * - Data fields: appliedFilters, summary, usageByWorkflowType, lowCompletionWorkflows, instrumentationGaps, freshness.
     * - Privacy: raw conversation, prompt, report, message, content, and feedback text fields are not returned.
     */
    const response = await request.get(`${API_BASE_URL}/advisory/admin/operations/usage`, {
      headers: authHeaders(),
      params: {
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      },
    })

    expect(response.status()).toBe(200)
    const envelope = await response.json()
    expect(envelope).toEqual({
      data: expect.objectContaining({
        appliedFilters: expect.objectContaining({
          tenantId: '660e8400-e29b-41d4-a716-446655440000',
          dateFrom: '2026-05-01T00:00:00.000Z',
          dateTo: '2026-05-22T23:59:59.999Z',
        }),
        summary: expect.objectContaining({
          quickConsult: expect.objectContaining({
            volume: expect.any(Number),
            started: expect.any(Number),
            completed: expect.any(Number),
            failed: expect.any(Number),
          }),
          workflows: expect.objectContaining({
            started: expect.any(Number),
            completed: expect.any(Number),
            incomplete: expect.any(Number),
          }),
        }),
        usageByWorkflowType: expect.any(Array),
        lowCompletionWorkflows: expect.any(Array),
        instrumentationGaps: expect.any(Array),
        freshness: expect.objectContaining({
          source: 'audit_logs',
          status: expect.stringMatching(/^(fresh|delayed|unavailable)$/),
        }),
      }),
    })
    expect(JSON.stringify(envelope.data)).not.toMatch(
      /conversation|prompt|message|content|raw_content|report|feedback_text/i,
    )
  })

  test.skip('[P1][6.1-API-005][AC2,AC4] surfaces instrumentation gaps and freshness state instead of misleading zero success metrics', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/advisory/admin/operations/usage`, {
      headers: authHeaders(),
      params: {
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-22T23:59:59.999Z',
      },
    })

    expect(response.status()).toBe(200)
    const { data } = await response.json()
    expect(data).toEqual(
      expect.objectContaining({
        instrumentationGaps: expect.any(Array),
        freshness: expect.objectContaining({
          source: 'audit_logs',
          status: expect.stringMatching(/^(fresh|delayed|unavailable)$/),
        }),
      }),
    )
    if (data.freshness.status !== 'fresh') {
      expect(data.summary.measurementStatus).toBe(data.freshness.status)
      expect(data.summary.workflows.completionRate).not.toBe(0)
      expect(data.instrumentationGaps.length).toBeGreaterThan(0)
    }
  })

  test.skip('[P1][6.1-API-006][AC1] requires authenticated admin access and tenant scoping for the operations endpoint', async ({ request }) => {
    const anonymous = await request.get(`${API_BASE_URL}/advisory/admin/operations/usage`)
    expect([401, 403]).toContain(anonymous.status())

    const nonAdmin = await request.get(`${API_BASE_URL}/advisory/admin/operations/usage`, {
      headers: authHeaders(nonAdminToken),
      params: {
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
      },
    })
    expect(nonAdmin.status()).toBe(403)
  })
})
