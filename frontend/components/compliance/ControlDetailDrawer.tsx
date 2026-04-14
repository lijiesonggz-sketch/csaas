'use client'

import { Fragment, type ReactNode, useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Gavel,
  GitBranch,
  HelpCircle,
  Layers3,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'

import {
  type ControlDetailContext,
  type ControlExplainErrorState,
  type ControlExplainFailureMode,
  type ControlExplainObligation,
  type ControlExplainReasoningChain,
  type ControlExplainResponse,
  getControlExplain,
  normalizeControlExplainError,
} from '@/lib/api/compliance-intelligence'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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

type OverviewSectionKey =
  | 'governance-summary'
  | 'sector-requirements'
  | 'failure-modes'
  | 'obligations'
  | 'reasoning-chain'

type AuthorityChecklistItem = {
  key:
    | 'has_source_basis'
    | 'has_applicability_scope'
    | 'has_control_activity'
    | 'has_expected_evidence'
    | 'has_human_review'
    | 'has_case_validation'
  label: string
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

const ORIGIN_TYPE_LABEL: Record<string, string> = {
  case_derived: '案例驱动',
  regulation_derived: '法规驱动',
  both: '双轨覆盖',
  candidate: '待治理',
  manual: '人工创建',
}

const MATURITY_META: Record<string, { label: string; className: string }> = {
  hard: {
    label: '正式硬控制点',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  'draft-hard': {
    label: '候选硬控制点',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  candidate: {
    label: '候选控制点',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  },
  retired: {
    label: '已退役',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

const AUTHORITY_ITEMS: AuthorityChecklistItem[] = [
  { key: 'has_source_basis', label: '有来源依据' },
  { key: 'has_applicability_scope', label: '有适用范围' },
  { key: 'has_control_activity', label: '有控制动作' },
  { key: 'has_expected_evidence', label: '有预期证据' },
  { key: 'has_human_review', label: '有人审确认' },
  { key: 'has_case_validation', label: '有案例验证' },
]

function SectionShell({
  sectionKey,
  title,
  icon: Icon,
  children,
}: {
  sectionKey: OverviewSectionKey | DetailSectionConfig['key']
  title: string
  icon: typeof HelpCircle
  children: ReactNode
}) {
  return (
    <section
      data-testid={`control-detail-section-${sectionKey}`}
      data-section-key={sectionKey}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      {message}
    </div>
  )
}

function GovernanceSummarySection({ detail }: { detail: ControlExplainResponse }) {
  const governance = detail.governance
  const score = governance?.authoritativeScore ?? null
  const scorePercent = score == null ? null : Math.round(score * 100)
  const authorityProfile = governance?.authorityProfile

  return (
    <SectionShell sectionKey="governance-summary" title="治理摘要" icon={ShieldCheck}>
      <div className="space-y-4" data-testid="control-detail-governance-summary">
        <div className="flex flex-wrap items-center gap-2">
          {governance?.originType && (
            <Badge variant="info" className="border-none">
              {ORIGIN_TYPE_LABEL[governance.originType] ?? governance.originType}
            </Badge>
          )}
          {governance?.maturityLevel && (
            <Badge
              className={cn(
                'border',
                MATURITY_META[governance.maturityLevel]?.className ??
                  'border-slate-200 bg-slate-100 text-slate-600',
              )}
            >
              {MATURITY_META[governance.maturityLevel]?.label ?? governance.maturityLevel}
            </Badge>
          )}
          {(governance?.applicableSector ?? []).map((sector) => (
            <Badge
              key={sector}
              variant="outline"
              className="border-sky-200 bg-sky-50 text-sky-700"
            >
              {sector}
            </Badge>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                authoritative score
              </p>
              <p className="text-sm text-slate-700">权威度评分由治理字段自动计算</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-slate-950">
                {scorePercent == null ? '--' : `${scorePercent}%`}
              </p>
            </div>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            {...(scorePercent != null ? { 'aria-valuenow': scorePercent } : {})}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
              style={{ width: `${scorePercent ?? 0}%` }}
            />
          </div>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-2"
          data-testid="control-detail-authority-profile"
        >
          {AUTHORITY_ITEMS.map((item) => {
            const checked = authorityProfile?.[item.key] === true
            return (
              <div
                key={item.key}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                  checked
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500',
                )}
              >
                {checked ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span>{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </SectionShell>
  )
}

function SectorRequirementsSection({ detail }: { detail: ControlExplainResponse }) {
  const sectorRequirements = detail.governance?.sectorRequirements
  const entries = sectorRequirements ? Object.entries(sectorRequirements) : []

  return (
    <SectionShell sectionKey="sector-requirements" title="行业差异化要求" icon={Layers3}>
      {entries.length === 0 ? (
        <EmptySection message="暂无行业差异化要求" />
      ) : (
        <Accordion
          type="multiple"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4"
          data-testid="control-detail-sector-requirements"
        >
          {entries.map(([sector, requirement]) => {
            const requirementEntries = Object.entries(requirement ?? {})
            return (
              <AccordionItem key={sector} value={sector}>
                <AccordionTrigger className="text-sm text-slate-900">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{sector}</Badge>
                    <span>{requirementEntries.length} 项差异化参数</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {requirementEntries.length === 0 ? (
                    <EmptySection message="该行业暂无差异化参数" />
                  ) : (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {requirementEntries.map(([key, value]) => (
                        <div
                          key={`${sector}-${key}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                        >
                          <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {key.replace(/_/g, ' ')}
                          </dt>
                          <dd className="mt-1 text-sm text-slate-800">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </SectionShell>
  )
}

function FailureModeSection({ detail }: { detail: ControlExplainResponse }) {
  const failureModes = detail.failureModes ?? []

  return (
    <SectionShell sectionKey="failure-modes" title="关联失效模式" icon={GitBranch}>
      {failureModes.length === 0 ? (
        <EmptySection message="当前控制点暂无失效模式映射" />
      ) : (
        <ul className="space-y-3" data-testid="control-detail-failure-mode-cards">
          {failureModes.map((item, index) => (
            <FailureModeCard
              key={item.failureModeId ?? `${item.failureModeCode ?? 'failure-mode'}-${index}`}
              item={item}
            />
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

function FailureModeCard({ item }: { item: ControlExplainFailureMode }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {item.failureModeCode && <Badge variant="outline">{item.failureModeCode}</Badge>}
        {item.category && (
          <Badge className="border-none bg-amber-100 text-amber-800 hover:bg-amber-100">
            {item.category}
          </Badge>
        )}
        {item.relevance && (
          <Badge className="border-none bg-sky-100 text-sky-700 hover:bg-sky-100">
            {item.relevance}
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium text-slate-900">{item.name || '未命名失效模式'}</p>
      <p className="mt-2 text-xs text-slate-500">
        详情页将在 Failure Mode 管理面中提供，当前仅展示映射摘要。
      </p>
    </li>
  )
}

function ObligationSection({ detail }: { detail: ControlExplainResponse }) {
  const obligations = detail.obligations ?? []

  return (
    <SectionShell sectionKey="obligations" title="关联法规义务" icon={Scale}>
      {obligations.length === 0 ? (
        <EmptySection message="当前控制点暂无法规义务映射" />
      ) : (
        <ul className="space-y-3" data-testid="control-detail-obligation-cards">
          {obligations.map((item, index) => (
            <ObligationCard
              key={item.obligationId ?? `${item.obligationCode ?? 'obligation'}-${index}`}
              item={item}
            />
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

function ObligationCard({ item }: { item: ControlExplainObligation }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {item.obligationCode && <Badge variant="outline">{item.obligationCode}</Badge>}
        {item.obligationType && (
          <Badge className="border-none bg-violet-100 text-violet-700 hover:bg-violet-100">
            {item.obligationType}
          </Badge>
        )}
        {item.coverage && (
          <Badge className="border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {item.coverage}
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium leading-6 text-slate-900">
        {item.obligationText || '未提供义务文本'}
      </p>
      {item.clause?.clauseCode && (
        <p className="mt-2 text-xs text-slate-500">
          条文：{item.clause.clauseCode}
          {item.clause.articleNo ? ` · ${item.clause.articleNo}` : ''}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        详情页将在 Obligation 管理面中提供，当前仅展示映射摘要。
      </p>
    </li>
  )
}

function ReasoningChainSection({ detail }: { detail: ControlExplainResponse }) {
  const chain = detail.reasoningChain
  const steps = buildReasoningSteps(chain)

  return (
    <SectionShell sectionKey="reasoning-chain" title="推理链路" icon={GitBranch}>
      {steps.length === 0 ? (
        <EmptySection message="暂无完整推理链路" />
      ) : (
        <div
          className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]"
          data-testid="control-detail-reasoning-chain"
        >
          {steps.map((step, index) => (
            <Fragment key={step.key}>
              <div
                className={cn(
                  'rounded-xl border p-3',
                  step.highlighted
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200 bg-slate-50',
                )}
                data-testid={`control-detail-reasoning-step-${step.key}`}
              >
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{step.label}</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{step.summary}</p>
                {step.caption && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.caption}</p>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className="hidden items-center justify-center lg:flex">
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </SectionShell>
  )
}

function buildReasoningSteps(chain?: ControlExplainReasoningChain | null) {
  if (!chain?.selectedControl) {
    return []
  }

  return [
    {
      key: 'cases',
      label: '案例',
      summary: chain.cases?.length ? `${chain.cases.length} 个关联案例` : '暂无关联案例',
      caption: chain.cases?.[0]?.caseTitle ?? chain.cases?.[0]?.caseCode ?? '可继续补齐案例链路',
    },
    {
      key: 'taxonomy',
      label: 'IT分类',
      summary: chain.l2?.code ?? '未提供 IT 分类',
      caption: chain.l2?.name ?? '暂无分类名称',
    },
    {
      key: 'failure-modes',
      label: '失效模式',
      summary: chain.failureModes?.length
        ? `${chain.failureModes.length} 个关联失效模式`
        : '暂无失效模式映射',
      caption:
        chain.failureModes?.map((item) => item.failureModeCode).filter(Boolean).join('、') ||
        '可继续补齐 failure mode 链路',
    },
    {
      key: 'control',
      label: '控制点',
      summary: chain.selectedControl.controlCode ?? '当前控制点',
      caption: chain.selectedControl.controlName ?? '未提供控制点名称',
      highlighted: true,
    },
    {
      key: 'evidence',
      label: '证据',
      summary: chain.evidenceTypes?.length
        ? `${chain.evidenceTypes.length} 类证据要求`
        : '暂无证据要求',
      caption:
        chain.evidenceTypes?.map((item) => item.evidenceCode).filter(Boolean).join('、') ||
        '可继续补齐证据链路',
    },
  ]
}

function SectionCard({
  section,
  data,
}: {
  section: DetailSectionConfig
  data?: ControlExplainResponse | null
}) {
  return (
    <SectionShell sectionKey={section.key} title={section.title} icon={section.icon}>
      {renderSectionBody(section, data)}
    </SectionShell>
  )
}

function renderSectionBody(section: DetailSectionConfig, data?: ControlExplainResponse | null) {
  if (!data) {
    return <EmptySection message={section.emptyMessage} />
  }

  switch (section.key) {
    case 'applicabilityReason':
      return data.applicabilityReason ? (
        <p className="text-sm leading-6 text-slate-700">{data.applicabilityReason}</p>
      ) : (
        <EmptySection message={section.emptyMessage} />
      )
    case 'clauses':
      return data.clauses.length > 0 ? (
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
      ) : (
        <EmptySection message={section.emptyMessage} />
      )
    case 'cases':
      return data.cases.length > 0 ? (
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
      ) : (
        <EmptySection message={section.emptyMessage} />
      )
    case 'evidences':
      return data.evidences.length > 0 ? (
        <ul className="space-y-3">
          {data.evidences.map((item, index) => (
            <li key={`${item.evidenceCode || 'evidence'}-${index}`} className="rounded-xl bg-slate-50 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {item.evidenceCode && <Badge variant="outline">{item.evidenceCode}</Badge>}
                {item.requiredLevel && (
                  <Badge className="border-none bg-amber-100 text-amber-800 hover:bg-amber-100">
                    {item.requiredLevel}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-slate-900">{item.evidenceName || '未命名证据项'}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{item.description || '未提供证据说明'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptySection message={section.emptyMessage} />
      )
    case 'questions':
      return data.questions.length > 0 ? (
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
      ) : (
        <EmptySection message={section.emptyMessage} />
      )
    case 'remediations':
      return data.remediations.length > 0 ? (
        <ul className="space-y-3">
          {data.remediations.map((item, index) => (
            <li key={`${item.remediationActionId || 'remediation'}-${index}`} className="rounded-xl bg-slate-50 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {item.priority && (
                  <Badge className="border-none bg-rose-100 text-rose-800 hover:bg-rose-100">
                    {item.priority}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-slate-900">{item.title || '未命名整改项'}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{item.description || '未提供整改说明'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptySection message={section.emptyMessage} />
      )
    default:
      return <EmptySection message={section.emptyMessage} />
  }
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
        <span className="font-semibold">{error.kind === 'permission' ? '权限受限' : '加载失败'}</span>
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
            'sm:w-[760px]',
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
              {detail?.governance?.originType && (
                <Badge
                  className="border-none bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
                  data-testid="control-detail-origin-badge"
                >
                  {ORIGIN_TYPE_LABEL[detail.governance.originType] ?? detail.governance.originType}
                </Badge>
              )}
              {detail?.governance?.maturityLevel && (
                <Badge
                  data-testid="control-detail-maturity-badge"
                  className={cn(
                    'border',
                    MATURITY_META[detail.governance.maturityLevel]?.className ??
                      'border-slate-200 bg-slate-100 text-slate-600',
                  )}
                >
                  {MATURITY_META[detail.governance.maturityLevel]?.label ??
                    detail.governance.maturityLevel}
                </Badge>
              )}
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
                <GovernanceSummarySection detail={detail} />
                <SectorRequirementsSection detail={detail} />
                <FailureModeSection detail={detail} />
                <ObligationSection detail={detail} />
                <ReasoningChainSection detail={detail} />
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
