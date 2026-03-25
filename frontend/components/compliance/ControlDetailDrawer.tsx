'use client'

import { useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertCircle, FileText, Gavel, HelpCircle, RefreshCw, ShieldAlert, Wrench, X } from 'lucide-react'

import {
  type ControlDetailContext,
  type ControlExplainResponse,
  type ControlExplainErrorState,
  getControlExplain,
  normalizeControlExplainError,
} from '@/lib/api/compliance-intelligence'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ControlDetailDrawerProps = ControlDetailContext & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RequestState = 'idle' | 'loading' | 'success' | 'error'

type DetailSectionConfig = {
  key: 'applicabilityReason' | 'clauses' | 'cases' | 'evidences' | 'questions' | 'remediations'
  title: string
  emptyMessage: string
  icon: typeof HelpCircle
}

const SECTION_CONFIG: DetailSectionConfig[] = [
  {
    key: 'applicabilityReason',
    title: '适用性说明',
    emptyMessage: '暂无法规适用说明',
    icon: HelpCircle,
  },
  {
    key: 'clauses',
    title: '法规条款',
    emptyMessage: '暂无法规条款',
    icon: FileText,
  },
  {
    key: 'cases',
    title: '处罚案例',
    emptyMessage: '暂无处罚案例',
    icon: Gavel,
  },
  {
    key: 'evidences',
    title: '证据要求',
    emptyMessage: '暂无证据要求',
    icon: ShieldAlert,
  },
  {
    key: 'questions',
    title: '问卷题目',
    emptyMessage: '暂无问卷题目',
    icon: HelpCircle,
  },
  {
    key: 'remediations',
    title: '整改建议',
    emptyMessage: '暂无整改建议',
    icon: Wrench,
  },
]

const SOURCE_BADGE_LABEL: Record<ControlDetailContext['sourceModule'], string> = {
  audit: '来自审核台',
  radar: '来自雷达',
  report: '来自报告',
}

function SectionCard({
  section,
  data,
}: {
  section: DetailSectionConfig
  data?: ControlExplainResponse | null
}) {
  const Icon = section.icon
  const sectionTestId = `control-detail-section-${section.key}`

  return (
    <section
      data-testid={sectionTestId}
      data-section-key={section.key}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
      </div>

      {renderSectionBody(section, data)}
    </section>
  )
}

function renderSectionBody(section: DetailSectionConfig, data?: ControlExplainResponse | null) {
  if (!data) {
    return <EmptySection message={section.emptyMessage} />
  }

  switch (section.key) {
    case 'applicabilityReason':
      return data.applicabilityReason
        ? <p className="text-sm leading-6 text-slate-700">{data.applicabilityReason}</p>
        : <EmptySection message={section.emptyMessage} />
    case 'clauses':
      return data.clauses.length > 0
        ? (
            <ul className="space-y-3">
              {data.clauses.map((clause, index) => (
                <li key={`${clause.clauseCode || 'clause'}-${index}`} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {clause.clauseCode && <Badge variant="outline">{clause.clauseCode}</Badge>}
                    {clause.articleNo && <span className="text-xs text-slate-500">{clause.articleNo}</span>}
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{clause.clauseText || '未提供条款正文'}</p>
                </li>
              ))}
            </ul>
          )
        : <EmptySection message={section.emptyMessage} />
    case 'cases':
      return data.cases.length > 0
        ? (
            <ul className="space-y-3">
              {data.cases.map((item, index) => (
                <li key={`${item.caseCode || 'case'}-${index}`} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {item.caseCode && <Badge variant="outline">{item.caseCode}</Badge>}
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{item.caseTitle || '未提供案例标题'}</p>
                </li>
              ))}
            </ul>
          )
        : <EmptySection message={section.emptyMessage} />
    case 'evidences':
      return data.evidences.length > 0
        ? (
            <ul className="space-y-3">
              {data.evidences.map((item, index) => (
                <li key={`${item.evidenceCode || 'evidence'}-${index}`} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {item.evidenceCode && <Badge variant="outline">{item.evidenceCode}</Badge>}
                    {item.requiredLevel && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{item.requiredLevel}</Badge>}
                  </div>
                  <p className="text-sm font-medium text-slate-900">{item.evidenceName || '未命名证据项'}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.description || '未提供证据说明'}</p>
                </li>
              ))}
            </ul>
          )
        : <EmptySection message={section.emptyMessage} />
    case 'questions':
      return data.questions.length > 0
        ? (
            <ul className="space-y-3">
              {data.questions.map((item, index) => (
                <li key={`${item.questionId || 'question'}-${index}`} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {item.questionId && <Badge variant="outline">{item.questionId}</Badge>}
                    {item.questionType && <span className="text-xs text-slate-500">{item.questionType}</span>}
                  </div>
                  <p className="text-sm font-medium text-slate-900">{item.questionText || '未提供题目内容'}</p>
                  {item.scoringRule && (
                    <p className="mt-1 text-xs text-slate-500">评分规则：{item.scoringRule}</p>
                  )}
                </li>
              ))}
            </ul>
          )
        : <EmptySection message={section.emptyMessage} />
    case 'remediations':
      return data.remediations.length > 0
        ? (
            <ul className="space-y-3">
              {data.remediations.map((item, index) => (
                <li key={`${item.remediationActionId || 'remediation'}-${index}`} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {item.priority && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">{item.priority}</Badge>}
                  </div>
                  <p className="text-sm font-medium text-slate-900">{item.title || '未命名整改项'}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{item.description || '未提供整改说明'}</p>
                </li>
              ))}
            </ul>
          )
        : <EmptySection message={section.emptyMessage} />
    default:
      return <EmptySection message={section.emptyMessage} />
  }
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      {message}
    </div>
  )
}

function DrawerLoadingState() {
  return (
    <div data-testid="control-detail-loading" className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function DrawerErrorState({
  error,
  onRetry,
}: {
  error: ControlExplainErrorState
  onRetry: () => void
}) {
  return (
    <div
      data-testid="control-detail-error"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-slate-800"
    >
      <div className="mb-3 flex items-center gap-2 text-rose-700">
        <AlertCircle className="h-5 w-5" />
        <span className="font-semibold">
          {error.kind === 'permission' ? '权限受限' : '加载失败'}
        </span>
      </div>
      <p className="mb-4 text-sm leading-6">{error.message}</p>
      {error.retryable && (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          data-testid="control-detail-retry"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      )}
    </div>
  )
}

export function ControlDetailDrawer({
  open,
  onOpenChange,
  organizationId,
  controlId,
  sourceModule,
  sourceRecordId,
}: ControlDetailDrawerProps) {
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [detail, setDetail] = useState<ControlExplainResponse | null>(null)
  const [error, setError] = useState<ControlExplainErrorState | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    setRequestState('loading')
    setDetail(null)
    setError(null)

    getControlExplain({ organizationId, controlId })
      .then((response) => {
        if (cancelled) {
          return
        }

        setDetail(response)
        setRequestState('success')
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return
        }

        setDetail(null)
        setError(normalizeControlExplainError(requestError))
        setRequestState('error')
      })

    return () => {
      cancelled = true
    }
  }, [open, organizationId, controlId, retryToken])

  const sourceBadge = SOURCE_BADGE_LABEL[sourceModule]
  const secondaryMeta = detail
    ? [detail.control.l1?.name, detail.control.l2?.name].filter(Boolean).join(' / ')
    : sourceRecordId
      ? `来源记录：${sourceRecordId}`
      : '统一控制点详情契约'

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPortal>
        <DialogOverlay
          data-testid="control-detail-overlay"
          className="pointer-events-none bg-transparent"
        />
        <DialogPrimitive.Content
          data-testid="control-detail-drawer"
          className={cn(
            'fixed right-0 top-0 z-50 flex h-screen w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'sm:w-[720px]',
          )}
        >
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
            <DialogPrimitive.Close
              className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
              aria-label="关闭控制点详情"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              data-testid="control-detail-source-badge"
              variant="outline"
              className="border-sky-200 bg-sky-50 text-sky-700"
            >
              {sourceBadge}
            </Badge>
            {sourceRecordId && (
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                {sourceRecordId}
              </Badge>
            )}
          </div>

          <DialogTitle className="text-xl text-slate-950">
            {detail?.control.controlCode || '控制点详情'}
            {detail?.control.controlName ? ` · ${detail.control.controlName}` : ''}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            {secondaryMeta}
          </DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-100 px-6 py-5">
            {requestState === 'loading' && <DrawerLoadingState />}

            {requestState === 'error' && error && (
              <DrawerErrorState
                error={error}
                onRetry={() => setRetryToken((current) => current + 1)}
              />
            )}

            {requestState === 'success' && detail && (
              <div className="space-y-4">
                {SECTION_CONFIG.map((section) => (
                  <SectionCard key={section.key} section={section} data={detail} />
                ))}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
