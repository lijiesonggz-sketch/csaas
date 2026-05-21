/**
 * Story 3.7 ATDD RED phase - CSAAS enterprise signal integration boundary.
 *
 * Provider endpoint/source: advisory integration service boundary consumed by
 * POST /advisory/quick-consult/start.
 *
 * Provider Scrutiny Evidence:
 * - Handler: NEW boundary under backend/src/modules/advisory/integration.
 * - Status/mode contract: available signals return enterprise mode; unavailable,
 *   malformed, missing organization, errors, and timeout return generic/degraded
 *   status without throwing.
 * - Field names: mode, status, signalsApplied, sources, fallbackReason, metadata.
 * - Nested structures: safe summaries only; raw CSAAS report, questionnaire
 *   answers, prompts, and provider output are excluded.
 */

import { CsaasEnterpriseSignalsService } from './csaas-enterprise-signals.service'

const tenantA = '660e8400-e29b-41d4-a716-446655440000'
const tenantB = '660e8400-e29b-41d4-a716-446655440099'
const organizationA = '880e8400-e29b-41d4-a716-446655440000'
const organizationB = '880e8400-e29b-41d4-a716-446655440099'

describe('CsaasEnterpriseSignalsService (Story 3.7 ATDD RED)', () => {
  it('[P0] AC1 loads tenant-scoped maturity and compliance signals inside the 2 second threshold', async () => {
    const adapter = {
      loadSignals: jest.fn().mockResolvedValue({
        tenantId: tenantA,
        organizationId: organizationA,
        maturity: {
          overallMaturity: 'managed',
          topShortcomings: ['日志留存', '访问控制复核'],
          rawQuestionnaireAnswers: ['should never be returned'],
        },
        compliance: {
          complianceGapLevel: 'medium',
          riskThemes: ['ISO 27001 访问控制', '审计证据缺口'],
          latestReportStatus: 'completed',
          rawReportSections: ['should never be returned'],
        },
      }),
    }
    const service = new CsaasEnterpriseSignalsService(adapter, { timeoutMs: 2000 })

    const result = await service.loadForQuickConsult({
      tenantId: tenantA,
      organizationId: organizationA,
    })

    expect(adapter.loadSignals).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenantA, organizationId: organizationA }),
    )
    expect(result).toMatchObject({
      mode: 'enterprise',
      status: 'available',
      signalsApplied: ['it_maturity', 'compliance'],
      sources: ['csaas_it_maturity', 'csaas_compliance'],
      summary: {
        overallMaturity: 'managed',
        topShortcomings: ['日志留存', '访问控制复核'],
        complianceGapLevel: 'medium',
        riskThemes: ['ISO 27001 访问控制', '审计证据缺口'],
        latestReportStatus: 'completed',
      },
      metadata: {
        signalCount: 2,
        sourceCount: 2,
        timeoutMs: 2000,
      },
    })
    expect(JSON.stringify(result)).not.toMatch(
      /rawQuestionnaireAnswers|rawReportSections|should never be returned|prompt|provider/i,
    )
  })

  it('[P0] AC2 degrades to generic mode for no data, malformed data, errors, missing organization, and timeout', async () => {
    const ServiceClass = CsaasEnterpriseSignalsService
    const cases = [
      { organizationId: organizationA, adapterResult: null, reason: 'no_data' },
      {
        organizationId: organizationA,
        adapterResult: { maturity: 'bad-shape' },
        reason: 'malformed',
      },
      { organizationId: null, adapterResult: null, reason: 'no_organization' },
      {
        organizationId: organizationA,
        adapterError: new Error('tenant B report exists'),
        reason: 'error',
      },
    ]

    for (const scenario of cases) {
      const adapter = {
        loadSignals: scenario.adapterError
          ? jest.fn().mockRejectedValue(scenario.adapterError)
          : jest.fn().mockResolvedValue(scenario.adapterResult),
      }
      const service = new ServiceClass(adapter, { timeoutMs: 2000 })

      const result = await service.loadForQuickConsult({
        tenantId: tenantA,
        organizationId: scenario.organizationId,
      })

      expect(result).toMatchObject({
        mode: 'generic',
        status: 'degraded',
        fallbackReason: scenario.reason,
        signalsApplied: [],
        sources: [],
      })
      expect(JSON.stringify(result)).not.toContain('tenant B report exists')
      expect(JSON.stringify(result)).not.toContain(tenantB)
    }

    jest.useFakeTimers()
    try {
      const adapter = { loadSignals: jest.fn(() => new Promise(() => undefined)) }
      const service = new ServiceClass(adapter, { timeoutMs: 2000 })
      const pending = service.loadForQuickConsult({
        tenantId: tenantA,
        organizationId: organizationA,
      })

      await jest.advanceTimersByTimeAsync(2001)

      await expect(pending).resolves.toMatchObject({
        mode: 'generic',
        status: 'degraded',
        fallbackReason: 'timeout',
        signalsApplied: [],
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('[P0] AC1-AC2 never reads or reveals another tenant organization signals', async () => {
    const adapter = {
      loadSignals: jest.fn().mockResolvedValue({
        tenantId: tenantB,
        organizationId: organizationB,
        maturity: { overallMaturity: 'optimized', topShortcomings: ['tenant-b-only'] },
      }),
    }
    const service = new CsaasEnterpriseSignalsService(adapter, { timeoutMs: 2000 })

    const result = await service.loadForQuickConsult({
      tenantId: tenantA,
      organizationId: organizationA,
    })

    expect(adapter.loadSignals).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenantA, organizationId: organizationA }),
    )
    expect(result).toMatchObject({
      mode: 'generic',
      status: 'degraded',
      fallbackReason: 'tenant_scope_mismatch',
    })
    expect(JSON.stringify(result)).not.toContain(tenantB)
    expect(JSON.stringify(result)).not.toContain(organizationB)
    expect(JSON.stringify(result)).not.toContain('tenant-b-only')
  })
})
