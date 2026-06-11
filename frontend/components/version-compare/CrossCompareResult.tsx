'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Layers,
  Puzzle,
  FileText,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface CrossCompareData {
  documents: Array<{ id: string; name: string }>
  themes: Array<{
    theme_id: string
    theme_name: string
    category: string
    relation: 'CONFLICT' | 'OVERLAP' | 'COMPLEMENT' | 'UNIQUE'
    relation_rationale: string
    requirements_by_document: Array<{
      document_id: string
      document_name: string
      clause_ids: string[]
      summary: string
      clauses: Array<{ clause_id: string; clause_text: string }>
    }>
    conflict_detail?: {
      conflict_points: Array<{
        aspect: string
        severity: 'HIGH' | 'MEDIUM' | 'LOW'
        positions: Array<{ document_id: string; position: string }>
      }>
    }
    unified_baseline: {
      requirement: string
      strictest_source_document_id?: string
      implementation_notes?: string
    }
  }>
  statistics: {
    total_themes: number
    conflict_count: number
    overlap_count: number
    complement_count: number
    unique_count: number
    documents_count: number
    ai_analyzed_themes: number
    ai_batch_failures: number
  }
  baseline_summary: string[]
}

const RELATION_CONFIG: Record<string, { label: string; badge: string; row: string }> = {
  CONFLICT: { label: '冲突', badge: 'bg-red-100 text-red-800 border-red-200', row: 'bg-red-50/50' },
  OVERLAP: { label: '重叠', badge: 'bg-amber-100 text-amber-800 border-amber-200', row: '' },
  COMPLEMENT: { label: '互补', badge: 'bg-blue-100 text-blue-800 border-blue-200', row: '' },
  UNIQUE: { label: '独有', badge: 'bg-slate-100 text-slate-700 border-slate-200', row: '' },
}

function FragmentRow({
  theme,
  config,
  expanded,
  documents,
  reqByDocId,
  onToggle,
}: {
  theme: CrossCompareData['themes'][number]
  config: { label: string; badge: string; row: string }
  expanded: boolean
  documents: CrossCompareData['documents']
  reqByDocId: Map<string, CrossCompareData['themes'][number]['requirements_by_document'][number]>
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className={`border-b border-[#E2E8F0] cursor-pointer hover:bg-slate-50 ${config.row}`}
        onClick={onToggle}
      >
        <td className="py-3 pr-4">
          <div className="flex items-center gap-1">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
            )}
            <div>
              <p className="font-medium text-[#1E3A5F]">{theme.theme_name}</p>
              <p className="text-xs text-[#94A3B8]">{theme.category}</p>
            </div>
          </div>
        </td>
        {documents.map((doc) => {
          const req = reqByDocId.get(doc.id)
          return (
            <td key={doc.id} className="py-3 px-3 align-top">
              {req ? (
                <div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {req.clause_ids.slice(0, 4).map((cid) => (
                      <Badge
                        key={cid}
                        variant="outline"
                        className="text-xs bg-indigo-50 text-indigo-700"
                      >
                        {cid}
                      </Badge>
                    ))}
                    {req.clause_ids.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{req.clause_ids.length - 4}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] line-clamp-2">{req.summary}</p>
                </div>
              ) : (
                <span className="text-xs text-[#CBD5E1]">—</span>
              )}
            </td>
          )
        })}
        <td className="py-3 pl-3">
          <Badge className={config.badge}>{config.label}</Badge>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#E2E8F0] bg-slate-50/50">
          <td colSpan={documents.length + 2} className="p-4">
            <div className="space-y-4">
              <p className="text-sm text-[#64748B]">
                <span className="font-medium">判定理由：</span>
                {theme.relation_rationale}
              </p>
              {theme.conflict_detail && theme.conflict_detail.conflict_points.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-2">冲突点明细</p>
                  <div className="space-y-2">
                    {theme.conflict_detail.conflict_points.map((point, idx) => (
                      <div key={idx} className="border border-red-200 bg-red-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-[#1E3A5F]">{point.aspect}</span>
                          <Badge
                            className={
                              point.severity === 'HIGH'
                                ? 'bg-red-100 text-red-800'
                                : point.severity === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                            }
                          >
                            {point.severity === 'HIGH'
                              ? '高'
                              : point.severity === 'MEDIUM'
                                ? '中'
                                : '低'}
                          </Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                          {point.positions.map((pos, pidx) => {
                            const docName =
                              documents.find((d) => d.id === pos.document_id)?.name ||
                              pos.document_id
                            return (
                              <p key={pidx} className="text-xs text-[#64748B]">
                                <span className="font-medium">《{docName}》：</span>
                                {pos.position}
                              </p>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                <p className="text-sm font-medium text-emerald-800 mb-1">统一执行基线</p>
                <p className="text-sm text-[#64748B]">{theme.unified_baseline.requirement}</p>
                {theme.unified_baseline.strictest_source_document_id && (
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    最严来源：
                    {documents.find(
                      (d) => d.id === theme.unified_baseline.strictest_source_document_id
                    )?.name || theme.unified_baseline.strictest_source_document_id}
                  </p>
                )}
                {theme.unified_baseline.implementation_notes && (
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    落地说明：{theme.unified_baseline.implementation_notes}
                  </p>
                )}
              </div>

              {/* 条款原文 */}
              <details className="text-sm">
                <summary className="cursor-pointer text-[#64748B] font-medium">
                  查看各标准条款原文
                </summary>
                <div className="mt-2 space-y-3">
                  {theme.requirements_by_document.map((req) => (
                    <div key={req.document_id}>
                      <p className="text-xs font-medium text-[#1E3A5F] mb-1">
                        《{req.document_name}》
                      </p>
                      {req.clauses.map((clause) => (
                        <p key={clause.clause_id} className="text-xs text-[#94A3B8] mb-1">
                          <Badge variant="outline" className="mr-1 text-xs">
                            {clause.clause_id}
                          </Badge>
                          {clause.clause_text}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function CrossCompareResult({ result }: { result: CrossCompareData }) {
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null)
  const [relationFilter, setRelationFilter] = useState<string | null>(null)

  const filteredThemes = relationFilter
    ? result.themes.filter((t) => t.relation === relationFilter)
    : result.themes

  const statCards = [
    {
      key: null,
      label: '主题总数',
      value: result.statistics.total_themes,
      icon: Layers,
      color: 'bg-slate-100 text-slate-600',
    },
    {
      key: 'CONFLICT',
      label: '冲突',
      value: result.statistics.conflict_count,
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-600',
    },
    {
      key: 'OVERLAP',
      label: '重叠',
      value: result.statistics.overlap_count,
      icon: Layers,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      key: 'COMPLEMENT',
      label: '互补',
      value: result.statistics.complement_count,
      icon: Puzzle,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      key: 'UNIQUE',
      label: '独有',
      value: result.statistics.unique_count,
      icon: FileText,
      color: 'bg-slate-100 text-slate-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* 统计卡（可点击筛选） */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              relationFilter === card.key && card.key ? 'ring-2 ring-[#1E3A5F]' : ''
            }`}
            onClick={() => setRelationFilter(relationFilter === card.key ? null : card.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8]">{card.label}</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {result.statistics.ai_batch_failures > 0 && (
        <p className="text-sm text-amber-600">
          ⚠ 有 {result.statistics.ai_batch_failures}{' '}
          个分析批次失败，相关主题已保守标注为“重叠”，请人工复核
        </p>
      )}

      {/* 主题矩阵表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1E3A5F]">
            主题 × 标准矩阵
            {relationFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-3 text-xs"
                onClick={() => setRelationFilter(null)}
              >
                清除筛选（{RELATION_CONFIG[relationFilter]?.label}）
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-left">
                <th className="py-2 pr-4 font-medium text-[#64748B] min-w-[160px]">主题</th>
                {result.documents.map((doc) => (
                  <th key={doc.id} className="py-2 px-3 font-medium text-[#64748B] min-w-[180px]">
                    {doc.name}
                  </th>
                ))}
                <th className="py-2 pl-3 font-medium text-[#64748B] w-20">关系</th>
              </tr>
            </thead>
            <tbody>
              {filteredThemes.map((theme) => {
                const config = RELATION_CONFIG[theme.relation]
                const expanded = expandedThemeId === theme.theme_id
                const reqByDocId = new Map(
                  theme.requirements_by_document.map((r) => [r.document_id, r])
                )
                return (
                  <FragmentRow
                    key={theme.theme_id}
                    theme={theme}
                    config={config}
                    expanded={expanded}
                    documents={result.documents}
                    reqByDocId={reqByDocId}
                    onToggle={() => setExpandedThemeId(expanded ? null : theme.theme_id)}
                  />
                )
              })}
              {filteredThemes.length === 0 && (
                <tr>
                  <td
                    colSpan={result.documents.length + 2}
                    className="py-8 text-center text-[#94A3B8]"
                  >
                    无符合筛选条件的主题
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 合规基线汇总 */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[#1E3A5F]">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            企业合规基线（草案，就高执行）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside">
            {result.baseline_summary.map((item, idx) => (
              <li key={idx} className="text-sm text-[#64748B]">
                {item}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
