'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink, Info, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { ReasoningChainData } from '@/lib/api/knowledge-graph'
import {
  formatAuthoritativeScorePercent,
  toAuthoritativeScorePercent,
} from '@/lib/utils/authoritative-score'

interface KnowledgeGraphDetailPanelProps {
  entityType: 'failure-mode' | 'control-point' | 'obligation' | null
  entityId: string | null
  reasoningChain: ReasoningChainData | null
  loading?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  DEFINITION_ERROR: 'bg-red-100 text-red-800',
  MAPPING_ERROR: 'bg-orange-100 text-orange-800',
  MISSING_CONTROL: 'bg-yellow-100 text-yellow-800',
  TIMELINESS_FAILURE: 'bg-blue-100 text-blue-800',
  INTEGRITY_FAILURE: 'bg-purple-100 text-purple-800',
  UNAUTHORIZED_ACTION: 'bg-pink-100 text-pink-800',
  FALSIFICATION: 'bg-gray-100 text-gray-800',
}

const MATURITY_COLORS: Record<string, string> = {
  hard: 'bg-green-100 text-green-800',
  'draft-hard': 'bg-yellow-100 text-yellow-800',
  candidate: 'bg-gray-100 text-gray-800',
  retired: 'bg-red-100 text-red-800',
}

export function KnowledgeGraphDetailPanel({
  entityType,
  entityId,
  reasoningChain,
  loading = false,
}: KnowledgeGraphDetailPanelProps) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
        <p className="mt-3 text-sm text-[#64748B]">加载详情中...</p>
      </div>
    )
  }

  if (!entityType || !entityId || !reasoningChain) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-16 text-center">
        <Info className="h-10 w-10 text-[#CBD5E1]" />
        <p className="mt-3 text-sm text-[#64748B]">点击推理链路中的卡片查看详情</p>
      </div>
    )
  }

  if (entityType === 'failure-mode') {
    const fm = reasoningChain.failureModes.find((f) => f.failureModeId === entityId)
    if (!fm) return <EmptyDetail />

    const relatedCPs = reasoningChain.controlPoints.filter(
      (cp) => cp.failureModeId === fm.failureModeId
    )
    const relatedObligations = reasoningChain.obligations.filter((obligation) =>
      relatedCPs.some((controlPoint) => controlPoint.controlId === obligation.controlId),
    )

    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">失效模式详情</h2>
        <div className="space-y-3">
          <DetailRow label="编码" value={fm.failureModeCode} />
          <DetailRow label="名称" value={fm.name} />
          <div>
            <span className="text-xs text-[#64748B]">分类</span>
            <div className="mt-1">
              <span
                className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${
                  CATEGORY_COLORS[fm.category] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {fm.category}
              </span>
            </div>
          </div>
          <DetailRow label="关联控制点数" value={String(fm.controlPointCount)} />
          <div>
            <span className="text-xs text-[#64748B]">IT 分类</span>
            <p className="mt-1 text-sm text-[#1E3A5F]">
              {reasoningChain.taxonomy.l1Name} / {reasoningChain.taxonomy.l2Name}
            </p>
          </div>
        </div>

        {relatedCPs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">关联控制点</h3>
            {relatedCPs.map((cp) => (
              <div
                key={cp.controlId}
                className="rounded-sm border border-[#E2E8F0] px-3 py-2 text-sm"
              >
                <div className="font-medium text-[#1E3A5F]">{cp.controlCode}</div>
                <div className="text-[#64748B]">{cp.controlName}</div>
              </div>
            ))}
          </div>
        )}

        {relatedObligations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">关联合规义务</h3>
            {relatedObligations.map((obligation) => (
              <button
                key={obligation.obligationId}
                type="button"
                className="w-full rounded-sm border border-[#E2E8F0] px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() =>
                  router.push(`/admin/obligations?obligationId=${obligation.obligationId}`)
                }
              >
                <div className="font-medium text-[#1E3A5F]">{obligation.obligationCode}</div>
                <div className="line-clamp-2 text-[#64748B]">{obligation.obligationText}</div>
                <div className="mt-1 flex gap-1">
                  <Badge variant="outline" className="text-xs">
                    {obligation.obligationType}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {obligation.coverage}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-sm"
          onClick={() =>
            router.push(`/admin/failure-modes?failureModeId=${fm.failureModeId}`)
          }
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          在 Failure Mode 管理中查看
        </Button>
      </div>
    )
  }

  if (entityType === 'control-point') {
    const cp = reasoningChain.controlPoints.find((c) => c.controlId === entityId)
    if (!cp) return <EmptyDetail />

    const relatedFM = reasoningChain.failureModes.find(
      (fm) => fm.failureModeId === cp.failureModeId
    )
    const relatedObs = reasoningChain.obligations.filter(
      (ob) => ob.controlId === cp.controlId
    )

    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">控制点详情</h2>
        <div className="space-y-3">
          <DetailRow label="编码" value={cp.controlCode} />
          <DetailRow label="名称" value={cp.controlName} />
          <div>
            <span className="text-xs text-[#64748B]">成熟度</span>
            <div className="mt-1">
              <span
                className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${
                  MATURITY_COLORS[cp.maturityLevel] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {cp.maturityLevel}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-[#64748B]">权威分数</span>
            <div className="mt-1 flex items-center gap-2">
              <Progress
                value={toAuthoritativeScorePercent(cp.authoritativeScore) ?? 0}
                max={100}
                className="h-2 flex-1"
              />
              <span className="text-sm font-medium text-[#1E3A5F]">
                {formatAuthoritativeScorePercent(cp.authoritativeScore)}
              </span>
            </div>
          </div>
          <DetailRow label="来源类型" value={cp.originType} />
          <DetailRow label="关联强度" value={cp.failureModeRelevance} />
        </div>

        {relatedFM && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">关联失效模式</h3>
            <div className="rounded-sm border border-[#E2E8F0] px-3 py-2 text-sm">
              <div className="font-medium text-[#1E3A5F]">{relatedFM.failureModeCode}</div>
              <div className="text-[#64748B]">{relatedFM.name}</div>
            </div>
          </div>
        )}

        {relatedObs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">关联合规义务</h3>
            {relatedObs.map((ob) => (
              <button
                key={ob.obligationId}
                type="button"
                className="w-full rounded-sm border border-[#E2E8F0] px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() =>
                  router.push(`/admin/obligations?obligationId=${ob.obligationId}`)
                }
              >
                <div className="font-medium text-[#1E3A5F]">{ob.obligationCode}</div>
                <div className="line-clamp-2 text-[#64748B]">{ob.obligationText}</div>
                <div className="mt-1 flex gap-1">
                  <Badge variant="outline" className="text-xs">{ob.obligationType}</Badge>
                  <Badge variant="secondary" className="text-xs">{ob.coverage}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <EmptyDetail />
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-[#64748B]">{label}</span>
      <p className="mt-0.5 text-sm font-medium text-[#1E3A5F]">{value}</p>
    </div>
  )
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-16 text-center">
      <Info className="h-10 w-10 text-[#CBD5E1]" />
      <p className="mt-3 text-sm text-[#64748B]">未找到对应的实体数据</p>
    </div>
  )
}
