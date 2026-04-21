'use client'

import { ArrowRight, FileText, Gavel, Loader2, Scale, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RegulationGraphData } from '@/lib/api/knowledge-graph'

type RegulationEntityType =
  | 'regulation-source'
  | 'clause'
  | 'obligation'
  | 'regulation-control-point'

interface RegulationDrivenVisualizationProps {
  data: RegulationGraphData | null
  loading: boolean
  onSelectEntity: (entity: { type: RegulationEntityType; id: string }) => void
  selectedEntityId?: string | null
  searchQuery?: string
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={`${part}-${index}`} className="bg-yellow-200 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function matchesQuery(query: string, ...values: Array<string | null | undefined>) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return values.some((value) => value?.toLowerCase().includes(normalized))
}

export function RegulationDrivenVisualization({
  data,
  loading,
  onSelectEntity,
  selectedEntityId,
  searchQuery = '',
}: RegulationDrivenVisualizationProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
        <p className="mt-3 text-sm text-[#64748B]">加载法规驱动线中...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-20 text-center">
        <Scale className="h-12 w-12 text-[#CBD5E1]" />
        <p className="mt-3 text-sm text-[#64748B]">请从左侧选择法规来源查看法规驱动线</p>
      </div>
    )
  }

  const query = searchQuery.trim()
  const sourceMatches = matchesQuery(
    query,
    data.source.sourceCode,
    data.source.sourceName,
    data.source.authorityName,
  )

  const matchedClauseIds = new Set(
    data.clauses
      .filter((clause) =>
        matchesQuery(
          query,
          clause.clauseCode,
          clause.articleNo ?? '',
          clause.sectionPath ?? '',
          clause.clauseSummary ?? '',
          clause.clauseText,
        ),
      )
      .map((clause) => clause.clauseId),
  )

  const directMatchedObligationIds = new Set(
    data.obligations
      .filter((obligation) =>
        matchesQuery(
          query,
          obligation.obligationCode,
          obligation.obligationText,
          obligation.obligationType,
          obligation.clauseCode,
        ),
      )
      .map((obligation) => obligation.obligationId),
  )

  const directMatchedControlEdgeIds = new Set(
    data.controlPoints
      .filter((controlPoint) =>
        matchesQuery(
          query,
          controlPoint.controlCode,
          controlPoint.controlName,
          controlPoint.originType ?? '',
          controlPoint.obligationCode,
          controlPoint.clauseCode,
        ),
      )
      .map((controlPoint) => controlPoint.edgeId),
  )

  const matchedObligationIds = new Set<string>(directMatchedObligationIds)
  data.obligations.forEach((obligation) => {
    if (matchedClauseIds.has(obligation.clauseId)) {
      matchedObligationIds.add(obligation.obligationId)
    }
  })
  data.controlPoints.forEach((controlPoint) => {
    if (directMatchedControlEdgeIds.has(controlPoint.edgeId)) {
      matchedObligationIds.add(controlPoint.obligationId)
      matchedClauseIds.add(controlPoint.clauseId)
    }
  })
  data.obligations.forEach((obligation) => {
    if (matchedObligationIds.has(obligation.obligationId)) {
      matchedClauseIds.add(obligation.clauseId)
    }
  })

  const displayedClauses =
    !query || sourceMatches
      ? data.clauses
      : data.clauses.filter((clause) => matchedClauseIds.has(clause.clauseId))
  const displayedObligations =
    !query || sourceMatches
      ? data.obligations
      : data.obligations.filter((obligation) => matchedObligationIds.has(obligation.obligationId))
  const displayedControlPoints =
    !query || sourceMatches
      ? data.controlPoints
      : data.controlPoints.filter(
          (controlPoint) =>
            directMatchedControlEdgeIds.has(controlPoint.edgeId) ||
            matchedObligationIds.has(controlPoint.obligationId),
        )

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-[#E2E8F0] bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.source.sourceCode}</Badge>
          {data.source.sourceLevel && <Badge variant="secondary">{data.source.sourceLevel}</Badge>}
          {data.source.authorityName && (
            <span className="text-xs text-[#64748B]">{data.source.authorityName}</span>
          )}
        </div>
        <div className="mt-2 text-sm font-medium text-[#1E3A5F]">{data.source.sourceName}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#64748B]">
          <span>{data.source.clauseCount} 条法规条文</span>
          <span>{data.source.obligationCount} 个法规义务</span>
          <span>{data.source.controlPointCount} 个控制点</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            法规条文 ({displayedClauses.length})
          </h3>
          <div className="space-y-2">
            {displayedClauses.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">暂无匹配条文</p>
            ) : (
              displayedClauses.map((clause) => (
                <button
                  key={clause.clauseId}
                  type="button"
                  aria-label={`法规条文 ${clause.clauseCode} ${clause.articleNo ?? ''}`}
                  className={`w-full rounded-sm border p-3 text-left transition ${
                    selectedEntityId === clause.clauseId
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                  }`}
                  onClick={() => onSelectEntity({ type: 'clause', id: clause.clauseId })}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-[#64748B]">
                        {highlightText(clause.clauseCode, query)}
                      </div>
                      <div className="mt-1 text-sm font-medium text-[#1E3A5F]">
                        {highlightText(clause.articleNo ?? clause.sectionPath ?? '未标注条号', query)}
                      </div>
                    </div>
                    <FileText className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                  </div>
                  <div className="mt-2 line-clamp-3 text-sm text-[#475569]">
                    {highlightText(clause.clauseSummary ?? clause.clauseText, query)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#64748B]">
                    <span>{clause.obligationCount} 个义务</span>
                    <span>{clause.controlPointCount} 个控制点</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            法规义务 ({displayedObligations.length})
          </h3>
          <div className="space-y-2">
            {displayedObligations.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">暂无匹配义务</p>
            ) : (
              displayedObligations.map((obligation) => (
                <button
                  key={obligation.obligationId}
                  type="button"
                  aria-label={`法规义务 ${obligation.obligationCode} ${obligation.obligationText}`}
                  className={`w-full rounded-sm border p-3 text-left transition ${
                    selectedEntityId === obligation.obligationId
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                  }`}
                  onClick={() => onSelectEntity({ type: 'obligation', id: obligation.obligationId })}
                >
                  <div className="text-xs font-mono text-[#64748B]">
                    {highlightText(obligation.obligationCode, query)}
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#1E3A5F]">
                    {highlightText(obligation.obligationText, query)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {obligation.obligationType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {obligation.controlPointCount} 个控制点
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                    <span>{obligation.clauseCode}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{obligation.applicableSector.join('、') || '通用'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            控制点 ({displayedControlPoints.length})
          </h3>
          <div className="space-y-2">
            {displayedControlPoints.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">暂无匹配控制点</p>
            ) : (
              displayedControlPoints.map((controlPoint) => (
                <button
                  key={controlPoint.edgeId}
                  type="button"
                  aria-label={`控制点 ${controlPoint.controlCode} ${controlPoint.controlName}`}
                  className={`w-full rounded-sm border p-3 text-left transition ${
                    selectedEntityId === controlPoint.edgeId
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                  }`}
                  onClick={() =>
                    onSelectEntity({
                      type: 'regulation-control-point',
                      id: controlPoint.edgeId,
                    })
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-[#64748B]">
                        {highlightText(controlPoint.controlCode, query)}
                      </div>
                      <div className="mt-1 text-sm font-medium text-[#1E3A5F]">
                        {highlightText(controlPoint.controlName, query)}
                      </div>
                    </div>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {controlPoint.coverage}
                    </Badge>
                    {controlPoint.originType && (
                      <Badge variant="secondary" className="text-xs">
                        {controlPoint.originType}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span>{controlPoint.clauseCode}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{controlPoint.obligationCode}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
