import { Inject, Injectable, Optional } from '@nestjs/common'

export const CSAAS_ENTERPRISE_SIGNALS_ADAPTER = Symbol('CSAAS_ENTERPRISE_SIGNALS_ADAPTER')
export const CSAAS_ENTERPRISE_SIGNALS_OPTIONS = Symbol('CSAAS_ENTERPRISE_SIGNALS_OPTIONS')

export type CsaasEnterpriseSignalMode = 'enterprise' | 'generic'
export type CsaasEnterpriseSignalStatus = 'available' | 'degraded'
export type CsaasEnterpriseSignalSource = 'csaas_it_maturity' | 'csaas_compliance'
export type CsaasEnterpriseSignalFallbackReason =
  | 'no_organization'
  | 'no_data'
  | 'timeout'
  | 'error'
  | 'malformed'
  | 'tenant_scope_mismatch'

export interface CsaasEnterpriseSignalsLoadInput {
  tenantId: string
  organizationId?: string | null
  deadlineMs?: number
}

export interface CsaasEnterpriseSignalAdapter {
  loadSignals(input: { tenantId: string; organizationId: string }): Promise<unknown>
}

export interface CsaasEnterpriseSignalsOptions {
  timeoutMs?: number
  targetLatencyMs?: number
}

export interface CsaasEnterpriseSignalsSummary {
  overallMaturity?: string
  topShortcomings?: string[]
  complianceGapLevel?: string
  riskThemes?: string[]
  latestReportStatus?: string
  sourceFreshness?: string
}

export interface CsaasEnterpriseSignalsResult {
  mode: CsaasEnterpriseSignalMode
  status: CsaasEnterpriseSignalStatus
  signalsApplied: Array<'it_maturity' | 'compliance'>
  sources: CsaasEnterpriseSignalSource[]
  fallbackReason?: CsaasEnterpriseSignalFallbackReason
  summary?: CsaasEnterpriseSignalsSummary
  metadata: {
    signalCount: number
    sourceCount: number
    timeoutMs: number
    latencyMs?: number
  }
}

const DEFAULT_TIMEOUT_MS = 2000

@Injectable()
export class CsaasNoDataEnterpriseSignalAdapter implements CsaasEnterpriseSignalAdapter {
  async loadSignals(): Promise<unknown> {
    return null
  }
}

@Injectable()
export class CsaasEnterpriseSignalsService {
  constructor(
    @Optional()
    @Inject(CSAAS_ENTERPRISE_SIGNALS_ADAPTER)
    private readonly adapter: CsaasEnterpriseSignalAdapter = new CsaasNoDataEnterpriseSignalAdapter(),
    @Optional()
    @Inject(CSAAS_ENTERPRISE_SIGNALS_OPTIONS)
    private readonly options: CsaasEnterpriseSignalsOptions = {},
  ) {}

  async loadForQuickConsult(
    input: CsaasEnterpriseSignalsLoadInput,
  ): Promise<CsaasEnterpriseSignalsResult> {
    const timeoutMs = this.normalizeTimeout(input.deadlineMs ?? this.options.timeoutMs)
    const startedAt = Date.now()

    if (!input.organizationId) {
      return this.toGenericResult('no_organization', timeoutMs, startedAt)
    }

    try {
      const rawSignals = await withTimeout(
        this.adapter.loadSignals({
          tenantId: input.tenantId,
          organizationId: input.organizationId,
        }),
        timeoutMs,
      )
      return this.normalizeAdapterResult(rawSignals, input, timeoutMs, startedAt)
    } catch (error) {
      return this.toGenericResult(isTimeoutError(error) ? 'timeout' : 'error', timeoutMs, startedAt)
    }
  }

  private normalizeAdapterResult(
    rawSignals: unknown,
    input: CsaasEnterpriseSignalsLoadInput,
    timeoutMs: number,
    startedAt: number,
  ): CsaasEnterpriseSignalsResult {
    if (rawSignals === null || rawSignals === undefined) {
      return this.toGenericResult('no_data', timeoutMs, startedAt)
    }
    if (!rawSignals || typeof rawSignals !== 'object') {
      return this.toGenericResult('malformed', timeoutMs, startedAt)
    }

    const record = rawSignals as Record<string, unknown>
    if (!record.tenantId || !record.organizationId) {
      return this.toGenericResult('malformed', timeoutMs, startedAt)
    }
    if (record.tenantId !== input.tenantId || record.organizationId !== input.organizationId) {
      return this.toGenericResult('tenant_scope_mismatch', timeoutMs, startedAt)
    }

    const maturitySummary = normalizeMaturitySummary(record.maturity)
    const complianceSummary = normalizeComplianceSummary(record.compliance)
    const sources: CsaasEnterpriseSignalSource[] = []
    const signalsApplied: Array<'it_maturity' | 'compliance'> = []
    const summary: CsaasEnterpriseSignalsSummary = {}

    if (maturitySummary) {
      signalsApplied.push('it_maturity')
      sources.push('csaas_it_maturity')
      Object.assign(summary, maturitySummary)
    }
    if (complianceSummary) {
      signalsApplied.push('compliance')
      sources.push('csaas_compliance')
      Object.assign(summary, complianceSummary)
    }

    if (signalsApplied.length === 0) {
      return this.toGenericResult('no_data', timeoutMs, startedAt)
    }

    return {
      mode: 'enterprise',
      status: 'available',
      signalsApplied,
      sources,
      summary,
      metadata: {
        signalCount: signalsApplied.length,
        sourceCount: sources.length,
        timeoutMs,
        latencyMs: elapsedMs(startedAt),
      },
    }
  }

  private toGenericResult(
    fallbackReason: CsaasEnterpriseSignalFallbackReason,
    timeoutMs: number,
    startedAt: number,
  ): CsaasEnterpriseSignalsResult {
    return {
      mode: 'generic',
      status: 'degraded',
      fallbackReason,
      signalsApplied: [],
      sources: [],
      metadata: {
        signalCount: 0,
        sourceCount: 0,
        timeoutMs,
        latencyMs: elapsedMs(startedAt),
      },
    }
  }

  private normalizeTimeout(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.min(Math.floor(value), DEFAULT_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS
  }
}

function normalizeMaturitySummary(value: unknown): Partial<CsaasEnterpriseSignalsSummary> | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const overallMaturity = normalizeSafeText(record.overallMaturity)
  const topShortcomings = normalizeSafeTextList(record.topShortcomings)
  const sourceFreshness = normalizeSafeText(record.sourceFreshness)

  if (!overallMaturity && topShortcomings.length === 0 && !sourceFreshness) return null

  return {
    ...(overallMaturity ? { overallMaturity } : {}),
    ...(topShortcomings.length > 0 ? { topShortcomings } : {}),
    ...(sourceFreshness ? { sourceFreshness } : {}),
  }
}

function normalizeComplianceSummary(value: unknown): Partial<CsaasEnterpriseSignalsSummary> | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const complianceGapLevel = normalizeSafeText(record.complianceGapLevel)
  const riskThemes = normalizeSafeTextList(record.riskThemes)
  const latestReportStatus = normalizeSafeText(record.latestReportStatus)

  if (!complianceGapLevel && riskThemes.length === 0 && !latestReportStatus) return null

  return {
    ...(complianceGapLevel ? { complianceGapLevel } : {}),
    ...(riskThemes.length > 0 ? { riskThemes } : {}),
    ...(latestReportStatus ? { latestReportStatus } : {}),
  }
}

function normalizeSafeText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : undefined
}

function normalizeSafeTextList(value: unknown): string[] {
  const seen = new Set<string>()
  return (Array.isArray(value) ? value : [])
    .map(normalizeSafeText)
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, 5)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new EnterpriseSignalTimeoutError()), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeout)
        reject(error)
      })
  })
}

class EnterpriseSignalTimeoutError extends Error {
  constructor() {
    super('CSAAS enterprise signal loading timed out')
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof EnterpriseSignalTimeoutError
}

function elapsedMs(startedAt: number): number {
  return Math.max(Date.now() - startedAt, 0)
}
