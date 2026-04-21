'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink, FileText, Info, Loader2, Scale, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { RegulationGraphData } from '@/lib/api/knowledge-graph'

type RegulationEntityType =
  | 'regulation-source'
  | 'clause'
  | 'obligation'
  | 'regulation-control-point'
  | null

interface RegulationDrivenDetailPanelProps {
  entityType: RegulationEntityType
  entityId: string | null
  data: RegulationGraphData | null
  loading?: boolean
}

export function RegulationDrivenDetailPanel({
  entityType,
  entityId,
  data,
  loading = false,
}: RegulationDrivenDetailPanelProps) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
        <p className="mt-3 text-sm text-[#64748B]">加载详情中...</p>
      </div>
    )
  }

  if (!entityType || !entityId || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-16 text-center">
        <Info className="h-10 w-10 text-[#CBD5E1]" />
        <p className="mt-3 text-sm text-[#64748B]">点击法规驱动线中的节点查看详情</p>
      </div>
    )
  }

  if (entityType === 'regulation-source') {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">法规来源详情</h2>
        <DetailRow label="来源编码" value={data.source.sourceCode} />
        <DetailRow label="来源名称" value={data.source.sourceName} />
        <DetailRow label="法规层级" value={data.source.sourceLevel || '未标注'} />
        <DetailRow label="发布机构" value={data.source.authorityName || '未标注'} />
        <div className="grid grid-cols-3 gap-2 rounded-sm border border-[#E2E8F0] bg-slate-50 p-3 text-center">
          <Metric label="条文" value={String(data.source.clauseCount)} />
          <Metric label="义务" value={String(data.source.obligationCount)} />
          <Metric label="控制点" value={String(data.source.controlPointCount)} />
        </div>
      </div>
    )
  }

  if (entityType === 'clause') {
    const clause = data.clauses.find((item) => item.clauseId === entityId)
    if (!clause) return <EmptyDetail />

    const relatedObligations = data.obligations.filter((item) => item.clauseId === clause.clauseId)

    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">法规条文详情</h2>
        <DetailRow label="条文编码" value={clause.clauseCode} />
        <DetailRow label="条号" value={clause.articleNo || '未标注'} />
        <DetailRow label="章节路径" value={clause.sectionPath || '未标注'} />
        <div>
          <span className="text-xs text-[#64748B]">条文摘要</span>
          <p className="mt-1 text-sm text-[#1E3A5F]">{clause.clauseSummary || clause.clauseText}</p>
        </div>
        <div className="rounded-sm border border-[#E2E8F0] bg-slate-50 p-3 text-sm text-[#475569]">
          {clause.clauseText}
        </div>

        {relatedObligations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">关联法规义务</h3>
            {relatedObligations.map((obligation) => (
              <div
                key={obligation.obligationId}
                className="rounded-sm border border-[#E2E8F0] px-3 py-2 text-sm"
              >
                <div className="font-medium text-[#1E3A5F]">{obligation.obligationCode}</div>
                <div className="line-clamp-2 text-[#64748B]">{obligation.obligationText}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (entityType === 'obligation') {
    const obligation = data.obligations.find((item) => item.obligationId === entityId)
    if (!obligation) return <EmptyDetail />

    const relatedClause = data.clauses.find((item) => item.clauseId === obligation.clauseId)
    const relatedControls = data.controlPoints.filter((item) => item.obligationId === obligation.obligationId)

    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">法规义务详情</h2>
        <DetailRow label="义务编码" value={obligation.obligationCode} />
        <DetailRow label="义务类型" value={obligation.obligationType} />
        <div>
          <span className="text-xs text-[#64748B]">义务内容</span>
          <p className="mt-1 text-sm text-[#1E3A5F]">{obligation.obligationText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {obligation.applicableSector.map((sector) => (
            <Badge key={sector} variant="outline" className="text-xs">
              {sector}
            </Badge>
          ))}
        </div>
        {relatedClause && (
          <div className="rounded-sm border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-sm">
            <div className="font-medium text-[#1E3A5F]">{relatedClause.clauseCode}</div>
            <div className="text-[#64748B]">{relatedClause.clauseSummary || relatedClause.clauseText}</div>
          </div>
        )}
        {relatedControls.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B]">关联控制点</h3>
            {relatedControls.map((controlPoint) => (
              <div
                key={controlPoint.edgeId}
                className="rounded-sm border border-[#E2E8F0] px-3 py-2 text-sm"
              >
                <div className="font-medium text-[#1E3A5F]">{controlPoint.controlCode}</div>
                <div className="text-[#64748B]">{controlPoint.controlName}</div>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-sm"
          onClick={() => router.push(`/admin/obligations?obligationId=${obligation.obligationId}`)}
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          在 Obligation 管理中查看
        </Button>
      </div>
    )
  }

  if (entityType === 'regulation-control-point') {
    const controlPoint = data.controlPoints.find((item) => item.edgeId === entityId)
    if (!controlPoint) return <EmptyDetail />

    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1E3A5F]">控制点详情</h2>
        <DetailRow label="控制点编码" value={controlPoint.controlCode} />
        <DetailRow label="控制点名称" value={controlPoint.controlName} />
        <DetailRow label="来源类型" value={controlPoint.originType || '未标注'} />
        <DetailRow label="覆盖程度" value={controlPoint.coverage} />
        <div>
          <span className="text-xs text-[#64748B]">权威分数</span>
          <div className="mt-1 flex items-center gap-2">
            <Progress
              value={controlPoint.authoritativeScore ?? 0}
              max={100}
              className="h-2 flex-1"
            />
            <span className="text-sm font-medium text-[#1E3A5F]">
              {controlPoint.authoritativeScore ?? 0}%
            </span>
          </div>
        </div>
        <div className="rounded-sm border border-[#E2E8F0] bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium text-[#1E3A5F]">{controlPoint.clauseCode}</div>
          <div className="text-[#64748B]">{controlPoint.obligationCode}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-sm"
          onClick={() => router.push(`/admin/obligations?obligationId=${controlPoint.obligationId}`)}
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          查看所属义务
        </Button>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[#E2E8F0] bg-white px-2 py-3">
      <div className="text-xs uppercase tracking-wide text-[#64748B]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#1E3A5F]">{value}</div>
    </div>
  )
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-[#CBD5E1] py-16 text-center">
      <Info className="h-10 w-10 text-[#CBD5E1]" />
      <p className="mt-3 text-sm text-[#64748B]">未找到对应的法规节点数据</p>
    </div>
  )
}
