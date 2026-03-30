'use client'

import { AlertCircle, ArrowUpRight, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RemediationPriorityItem } from '@/lib/api/report-center'

interface RemediationPriorityListProps {
  items: RemediationPriorityItem[]
  title?: string
  emptyText?: string
}

function getRiskBadgeClass(riskLevel: RemediationPriorityItem['riskLevel']) {
  switch (riskLevel) {
    case 'HIGH':
      return 'bg-red-100 text-red-800'
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800'
    case 'LOW':
    default:
      return 'bg-emerald-100 text-emerald-800'
  }
}

function getDifficultyLabel(level: RemediationPriorityItem['difficultyLevel']) {
  switch (level) {
    case 'low':
      return '低难度'
    case 'medium':
      return '中难度'
    case 'high':
      return '高难度'
    case 'unknown':
    default:
      return '难度未知'
  }
}

export function RemediationPriorityList({
  items,
  title = '整改优先级清单',
  emptyText = '当前暂无可展示的整改优先级项。',
}: RemediationPriorityListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 text-sky-600" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <span>{emptyText}</span>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.controlId}-${item.remediationActionId ?? 'missing'}`}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{item.rank}</Badge>
                    <Badge className={getRiskBadgeClass(item.riskLevel)}>{item.riskLevel}</Badge>
                    <Badge variant="secondary">{getDifficultyLabel(item.difficultyLevel)}</Badge>
                    <Badge variant="outline">Score {item.priorityScore}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.l1Name} / {item.l2Name} / {item.controlCode} {item.controlName}
                    </p>
                  </div>
                  {item.description ? (
                    <p className="text-sm text-slate-600">{item.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>状态：{item.statusLabel}</span>
                    <span>controlId：{item.controlId}</span>
                    <span>
                      remediationActionId：{item.remediationActionId ?? '暂无整改建议'}
                    </span>
                  </div>
                </div>
                {item.expectedBenefit ? (
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:max-w-xs">
                    <div className="mb-1 flex items-center gap-1 font-medium">
                      <ArrowUpRight className="h-4 w-4" />
                      预期收益
                    </div>
                    <p>{item.expectedBenefit}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
