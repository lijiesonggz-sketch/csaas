'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { ArrowRight, GitBranch, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { ReasoningChainData } from '@/lib/api/knowledge-graph'
import {
  formatAuthoritativeScorePercent,
  toAuthoritativeScorePercent,
} from '@/lib/utils/authoritative-score'

interface ReasoningChainVisualizationProps {
  data: ReasoningChainData | null
  loading: boolean
  onSelectEntity: (entity: { type: 'failure-mode' | 'control-point'; id: string }) => void
  selectedEntityId?: string | null
  searchQuery?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  DEFINITION_ERROR: 'bg-red-100 text-red-800 border-red-300',
  MAPPING_ERROR: 'bg-orange-100 text-orange-800 border-orange-300',
  MISSING_CONTROL: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  TIMELINESS_FAILURE: 'bg-blue-100 text-blue-800 border-blue-300',
  INTEGRITY_FAILURE: 'bg-purple-100 text-purple-800 border-purple-300',
  UNAUTHORIZED_ACTION: 'bg-pink-100 text-pink-800 border-pink-300',
  FALSIFICATION: 'bg-gray-100 text-gray-800 border-gray-300',
}

const MATURITY_COLORS: Record<string, string> = {
  hard: 'bg-green-100 text-green-800 border-green-300',
  'draft-hard': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  candidate: 'bg-gray-100 text-gray-800 border-gray-300',
  retired: 'bg-red-100 text-red-800 border-red-300',
}

export function ReasoningChainVisualization({
  data,
  loading,
  onSelectEntity,
  selectedEntityId,
  searchQuery = '',
}: ReasoningChainVisualizationProps) {
  const router = useRouter()

  // Filter data based on search query (memoized for performance)
  const filteredData = useMemo(() => {
    if (!data || !searchQuery.trim()) return data
    return {
      ...data,
      failureModes: data.failureModes.filter(fm =>
        fm.failureModeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fm.category.toLowerCase().includes(searchQuery.toLowerCase())
      ),
      controlPoints: data.controlPoints.filter(cp =>
        cp.controlCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cp.controlName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cp.maturityLevel.toLowerCase().includes(searchQuery.toLowerCase())
      ),
      obligations: data.obligations.filter(ob =>
        ob.obligationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ob.obligationText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ob.obligationType.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }
  }, [data, searchQuery])

  // Highlight function
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
        <p className="mt-3 text-sm text-[#64748B]">加载推理链路中...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-20 text-center">
        <GitBranch className="h-12 w-12 text-[#CBD5E1]" />
        <p className="mt-3 text-sm text-[#64748B]">请从左侧选择 IT 分类查看推理链路</p>
      </div>
    )
  }

  const displayData = filteredData || data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[#64748B]">
        <span className="font-medium text-[#1E3A5F]">{displayData.taxonomy.l1Name}</span>
        <ArrowRight className="h-4 w-4" />
        <span className="font-medium text-[#1E3A5F]">{displayData.taxonomy.l2Name}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            失效模式 ({displayData.failureModes.length})
          </h3>
          <div className="space-y-2">
            {displayData.failureModes.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">暂无失效模式</p>
            ) : (
              displayData.failureModes.map((fm) => (
                <button
                  key={fm.failureModeId}
                  type="button"
                  aria-label={`失效模式 ${fm.failureModeCode} ${fm.name}，关联 ${fm.controlPointCount} 个控制点`}
                  aria-pressed={selectedEntityId === fm.failureModeId}
                  className={`w-full rounded-sm border p-3 text-left transition ${
                    selectedEntityId === fm.failureModeId
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                  }`}
                  onClick={() => onSelectEntity({ type: 'failure-mode', id: fm.failureModeId })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-[#64748B]">{highlightText(fm.failureModeCode)}</div>
                      <div className="mt-1 text-sm font-medium text-[#1E3A5F]">{highlightText(fm.name)}</div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {fm.controlPointCount}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium ${
                        CATEGORY_COLORS[fm.category] || 'bg-gray-100 text-gray-800 border-gray-300'
                      }`}
                    >
                      {fm.category}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            控制点 ({displayData.controlPoints.length})
          </h3>
          <div className="space-y-2">
            {displayData.controlPoints.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">暂无控制点</p>
            ) : (
              displayData.controlPoints.map((cp) => (
                <button
                  key={cp.controlId}
                  type="button"
                  aria-label={`控制点 ${cp.controlCode} ${cp.controlName}，成熟度 ${cp.maturityLevel}，权威性评分 ${formatAuthoritativeScorePercent(cp.authoritativeScore)}`}
                  aria-pressed={selectedEntityId === cp.controlId}
                  className={`w-full rounded-sm border p-3 text-left transition ${
                    selectedEntityId === cp.controlId
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : 'border-[#E2E8F0] hover:border-[#94A3B8]'
                  }`}
                  onClick={() => onSelectEntity({ type: 'control-point', id: cp.controlId })}
                >
                  <div className="text-xs font-mono text-[#64748B]">{highlightText(cp.controlCode)}</div>
                  <div className="mt-1 text-sm font-medium text-[#1E3A5F]">{highlightText(cp.controlName)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-block rounded-sm border px-2 py-0.5 text-xs font-medium ${
                        MATURITY_COLORS[cp.maturityLevel] || 'bg-gray-100 text-gray-800 border-gray-300'
                      }`}
                    >
                      {cp.maturityLevel}
                    </span>
                    {cp.failureModeRelevance && (
                      <Badge variant="outline" className="text-xs">
                        {cp.failureModeRelevance}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <span>权威分数</span>
                      <span className="font-medium">
                        {formatAuthoritativeScorePercent(cp.authoritativeScore)}
                      </span>
                    </div>
                    <Progress
                      value={toAuthoritativeScorePercent(cp.authoritativeScore) ?? 0}
                      max={100}
                      className="mt-1 h-1.5"
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            合规义务 ({displayData.obligations.length})
          </h3>
          <div className="space-y-2">
            {displayData.obligations.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">暂无合规义务</p>
            ) : (
              displayData.obligations.map((ob) => (
                <button
                  key={ob.obligationId}
                  type="button"
                  aria-label={`义务 ${ob.obligationCode} ${ob.obligationText}`}
                  className="w-full rounded-sm border border-[#E2E8F0] p-3 text-left transition hover:border-[#94A3B8]"
                  onClick={() => router.push(`/admin/obligations?obligationId=${ob.obligationId}`)}
                >
                  <div className="text-xs font-mono text-[#64748B]">{highlightText(ob.obligationCode)}</div>
                  <div className="mt-1 text-sm text-[#475569]">{highlightText(ob.obligationText)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ob.obligationType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {ob.coverage}
                    </Badge>
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
