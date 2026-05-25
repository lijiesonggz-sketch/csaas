'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { cva } from 'class-variance-authority'
import {
  BrainCircuit,
  Clock3,
  FileText,
  History as HistoryIcon,
  LogOut,
  MessageSquareText,
  RotateCcw,
  Search,
  SendHorizontal,
  Settings,
  Trash2,
  Workflow,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdvisoryChatMessage } from '@/components/advisory/AdvisoryChatMessage'
import { AdvisoryDocumentDrawer } from '@/components/advisory/AdvisoryDocumentDrawer'
import { EnterpriseBackgroundDialog } from '@/components/advisory/EnterpriseBackgroundDialog'
import { QuickConsultProblemIntake } from '@/components/advisory/QuickConsultProblemIntake'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ADVISORY_DESKTOP_QUERY,
  ADVISORY_LAYOUT,
  ADVISORY_LAYOUT_STYLE,
} from '@/lib/advisory/layout'
import {
  ADVISORY_READING_DENSITY_OPTIONS,
  DEFAULT_ADVISORY_READING_DENSITY,
  type AdvisoryReadingDensity,
  getAdvisoryReadingDensityLabel,
  normalizeAdvisoryReadingDensity,
  readAdvisoryPreferences,
  writeAdvisoryPreferences,
} from '@/lib/advisory/preferences'
import {
  THINKTANK_EMPTY_MESSAGE_MESSAGE,
  THINKTANK_MESSAGE_MAX_LENGTH,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE,
  fetchThinkTankSessionMessages,
  fetchThinkTankWorkflows,
  launchThinkTankWorkflow,
  type ThinkTankConversationMessage,
  type ThinkTankDecisionOption,
  type ThinkTankWorkflowCatalogItem,
  type ThinkTankWorkflowCurrentStep,
  type ThinkTankWorkflowLaunchResult,
  type ThinkTankWorkflowLaunchOptions,
} from '@/lib/advisory/workflows'
import {
  THINKTANK_STREAM_ERROR_MESSAGE,
  streamThinkTankSessionMessage,
} from '@/lib/advisory/streaming'
import {
  readThinkTankCheckpointWarningMessage,
  type ThinkTankCheckpointWarning,
} from '@/lib/advisory/checkpoints'
import {
  THINKTANK_OUTPUT_DELETE_FAILED_MESSAGE,
  THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE,
  associateThinkTankOutputWithKnowledgeBase,
  completeThinkTankSessionOutput,
  deleteThinkTankSessionOutput,
  downloadThinkTankSessionOutput,
  fetchThinkTankWorkflowOutput,
  rateThinkTankSessionOutput,
  updateThinkTankOutputFavorite,
  type ThinkTankOutputAssetState,
  type ThinkTankOutputExportFormat,
  type ThinkTankOutputFavoriteInput,
  type ThinkTankOutputKnowledgeBaseAssociationInput,
  type ThinkTankOutputKnowledgeBaseAssociationState,
  type ThinkTankOutputRatingInput,
  type ThinkTankWorkflowOutput,
} from '@/lib/advisory/outputs'
import {
  THINKTANK_RESUME_SESSION_FAILED_MESSAGE,
  THINKTANK_SAFE_EXIT_SESSION_FAILED_MESSAGE,
  THINKTANK_DELETE_SESSION_FAILED_MESSAGE,
  THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE,
  deleteThinkTankSession,
  fetchThinkTankUnfinishedSessions,
  resumeThinkTankSession,
  safeExitThinkTankSession,
  toWorkflowLaunchFromResume,
  type ThinkTankRecoveryMessage,
  type ThinkTankUnfinishedSessionCard,
} from '@/lib/advisory/sessions'
import {
  THINKTANK_HISTORY_LOAD_FAILED_MESSAGE,
  THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE,
  fetchThinkTankSessionHistory,
  searchThinkTankHistory,
  type ThinkTankHistoryItem,
  type ThinkTankHistoryQuery,
  type ThinkTankHistoryResult,
  type ThinkTankHistoryStatus,
  type ThinkTankHistoryType,
} from '@/lib/advisory/history'
import {
  ORGANIZATION_CONTEXT_LOAD_FAILED_MESSAGE,
  ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE,
  fetchOrganizationContext,
  isOrganizationContextUsable,
  readOrganizationContextSkip,
  saveOrganizationContext,
  writeOrganizationContextSkip,
  type OrganizationContextSaved,
  type OrganizationContextState,
  type SaveOrganizationContextInput,
} from '@/lib/advisory/organization-context'
import { cn } from '@/lib/utils'

const ADVISORY_STATE_SUMMARY_ID = 'advisory-state-summary'
const WORKFLOW_CATALOG_ERROR_MESSAGE = '暂时无法加载 ThinkTank 工作流目录，请刷新页面后重试。'
const SESSION_MESSAGES_ERROR_MESSAGE = '暂时无法加载 ThinkTank 会话消息，请刷新页面后重试。'
const THINKTANK_DRAFT_STORAGE_PREFIX = 'thinktank:session-draft'
const THINKTANK_MESSAGE_LAZY_RENDER_THRESHOLD = 80
const THINKTANK_HISTORY_PAGE_SIZE = 20
const THINKTANK_SCROLL_BOTTOM_TOLERANCE_PX = 48
const THINKTANK_STREAM_ANNOUNCEMENT_THROTTLE_MS = 1000
const INITIAL_HISTORY_META: ThinkTankHistoryResult['meta'] = {
  page: 1,
  limit: THINKTANK_HISTORY_PAGE_SIZE,
  total: 0,
}

type WorkflowCatalogStatus = 'loading' | 'ready' | 'error'
type SessionMessagesStatus = 'idle' | 'loading' | 'ready' | 'error'
type MessageStreamingStatus = 'idle' | 'submitting' | 'streaming' | 'completing' | 'error'
type WorkspaceMode = 'quick-consult' | 'workflow'
type PartyModeReplyTarget = {
  advisorId: string
  advisorName: string
  advisorRole: string
  messageId: string
  round?: number
}
type DecisionSubmitOverride = {
  content?: string
  decisionAction?: string
  decisionSourceMessageId?: string
  selectedDecisionLabel?: string
  addressedExpertHint?: { advisorId: string; messageId?: string }
}
type OrganizationContextStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error'
type UnfinishedSessionsStatus = 'idle' | 'loading' | 'ready' | 'error'
type HistoryLoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type HistoryTimeFilter = 'all' | '7d' | '30d'
type LifecycleAction =
  | { type: 'safe-exit'; sessionId: string; title: string }
  | { type: 'session-delete'; sessionId: string; title: string }
  | { type: 'output-delete'; sessionId: string; outputId: string; title: string }

const shellGridVariants = cva(
  'grid h-[calc(100vh-var(--advisory-nav-height)-48px)] min-h-[560px] grid-cols-[var(--advisory-sidebar-width)_minmax(var(--advisory-chat-min-width),1fr)_var(--advisory-document-rail-width)] overflow-hidden rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] shadow-sm transition-[font-size]',
  {
    variants: {
      density: {
        compact: 'text-[13px]',
        default: 'text-sm',
        comfortable: 'text-[15px]',
      },
    },
    defaultVariants: {
      density: DEFAULT_ADVISORY_READING_DENSITY,
    },
  }
)

const readingSurfaceVariants = cva('mx-auto text-center transition-[font-size,line-height]', {
  variants: {
    density: {
      compact: 'max-w-md text-[13px] leading-5',
      default: 'max-w-lg text-sm leading-6',
      comfortable: 'max-w-xl text-base leading-7',
    },
  },
  defaultVariants: {
    density: DEFAULT_ADVISORY_READING_DENSITY,
  },
})

const activePromptSurfaceVariants = cva(
  'mx-auto w-full text-left transition-[font-size,line-height]',
  {
    variants: {
      density: {
        compact: 'max-w-3xl text-[13px] leading-5',
        default: 'max-w-4xl text-sm leading-6',
        comfortable: 'max-w-5xl text-base leading-7',
      },
    },
    defaultVariants: {
      density: DEFAULT_ADVISORY_READING_DENSITY,
    },
  }
)

function readWorkflowErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function readMessageSubmitErrorMessage(error: unknown): string {
  const message = readWorkflowErrorMessage(error, THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)

  return message === THINKTANK_STREAM_ERROR_MESSAGE
    ? THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE
    : message
}

function getPublicLaunchPrompt(launch: ThinkTankWorkflowLaunchResult): string {
  const prompt = launch.firstPrompt.trim()
  if (prompt && !containsInternalWorkflowPrompt(prompt)) {
    return prompt
  }

  return [
    `${launch.workflow.displayName} 已启动。`,
    `我会基于 ${launch.workflow.scenarioLabel} 工作流，引导你整理问题背景、目标和约束。`,
    '请直接输入你要讨论的主题、当前背景，以及希望产出的具体结果。',
  ].join('\n\n')
}

function containsInternalWorkflowPrompt(prompt: string): boolean {
  return /MANDATORY EXECUTION RULES|EXECUTION PROTOCOLS|CONTEXT BOUNDARIES|## YOUR TASK|## Source:|_bmad|Untrusted user-provided context data/i.test(
    prompt
  )
}

function buildDraftStorageKey(userIdentity: string | null, sessionId: string): string {
  return `${THINKTANK_DRAFT_STORAGE_PREFIX}:${userIdentity ?? 'anonymous'}:${sessionId}`
}

function readStoredDraft(userIdentity: string | null, sessionId: string): string {
  if (typeof window === 'undefined') return ''

  return window.localStorage.getItem(buildDraftStorageKey(userIdentity, sessionId)) ?? ''
}

function writeStoredDraft(userIdentity: string | null, sessionId: string, draft: string) {
  if (typeof window === 'undefined') return

  const storageKey = buildDraftStorageKey(userIdentity, sessionId)
  if (draft) {
    window.localStorage.setItem(storageKey, draft)
    return
  }
  window.localStorage.removeItem(storageKey)
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()

  return tagName === 'textarea' || tagName === 'input' || target.isContentEditable
}

function getLatestDecisionMessage(
  messages: ThinkTankConversationMessage[]
): ThinkTankConversationMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'assistant' && message.decisionOptions?.length) {
      return message
    }
  }

  return null
}

function getLatestDecisionOptions(
  messages: ThinkTankConversationMessage[]
): ThinkTankDecisionOption[] {
  return getLatestDecisionMessage(messages)?.decisionOptions ?? []
}

function readSingleKeyShortcut(value: string): string | null {
  const match = value.trim().match(/^\[?([0-9a-z])\]?$/i)
  return match?.[1]?.toLowerCase() ?? null
}

function createPartyModeShortcutSubmitOverride(
  content: string,
  messages: ThinkTankConversationMessage[]
): DecisionSubmitOverride | null {
  const shortcut = readSingleKeyShortcut(content)
  if (!shortcut) return null

  const option = getLatestDecisionOptions(messages).find(
    (candidate) =>
      candidate.action === 'party-mode' &&
      candidate.enabled &&
      candidate.shortcut?.toLowerCase() === shortcut
  )
  if (!option) return null

  return {
    content: '启动 Party Mode',
    decisionAction: 'party-mode',
    selectedDecisionLabel: option.label,
  }
}

function getLatestDecisionMessageId(messages: ThinkTankConversationMessage[]): string | null {
  const message = getLatestDecisionMessage(messages)
  if (message) return message.id

  return null
}

function isSameDecisionOption(left: ThinkTankDecisionOption, right: ThinkTankDecisionOption) {
  return (
    left.action === right.action &&
    left.label === right.label &&
    (left.shortcut ?? '') === (right.shortcut ?? '')
  )
}

function readPartyModeReplyTarget(
  message: ThinkTankConversationMessage
): PartyModeReplyTarget | null {
  if (message.metadata?.party_mode_message !== true) return null
  const advisorId = readMetadataText(message.metadata.party_mode_advisor_id)
  const advisorName = readMetadataText(message.metadata.party_mode_advisor_name)
  const advisorRole = readMetadataText(message.metadata.party_mode_advisor_role)
  if (!advisorId || !advisorName || !advisorRole) return null

  return {
    advisorId,
    advisorName,
    advisorRole,
    messageId: message.id,
    round: readMetadataNumber(message.metadata.party_mode_round) ?? undefined,
  }
}

function readMetadataText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readMetadataNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatSessionActivityTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '最近更新'

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getHistoryItemKey(item: ThinkTankHistoryItem): string {
  return `${item.resultType}:${item.id}`
}

function getHistoryResultTypeLabel(item: ThinkTankHistoryItem): string {
  return item.resultType === 'output' ? '报告' : item.status === 'active' ? '会话' : '会话'
}

function getHistoryActionLabel(item: ThinkTankHistoryItem): string {
  if (item.openTarget === 'resume-session') return `继续会话 ${item.title}`
  if (item.openTarget === 'view-output') return `打开报告 ${item.title}`
  return `打开会话 ${item.title}`
}

function getHistoryStatusLabel(status: ThinkTankHistoryItem['status']): string {
  if (status === 'active') return '进行中'
  if (status === 'paused') return '已暂停'
  if (status === 'completed') return '已完成'
  return '草稿'
}

function getLifecycleDialogTitle(action: LifecycleAction | null): string {
  if (action?.type === 'safe-exit') return '退出 ThinkTank 工作流'
  if (action?.type === 'session-delete') return '删除 ThinkTank 会话'
  if (action?.type === 'output-delete') return '删除 ThinkTank 报告'
  return '确认操作'
}

function getLifecycleDialogDescription(action: LifecycleAction | null): string {
  if (action?.type === 'safe-exit') {
    return `当前进度已自动保存。退出后会回到 Quick Consult，你可以稍后从未完成会话继续 ${action.title}。`
  }
  if (action?.type === 'session-delete') {
    return `删除 ${action.title} 会隐藏该会话及关联报告，列表和当前详情会同步移除。此操作难以撤销。`
  }
  if (action?.type === 'output-delete') {
    return `删除 ${action.title} 会从历史和当前预览中移除该报告，但不会删除同一会话的其他记录。此操作难以撤销。`
  }
  return ''
}

function getLifecycleConfirmLabel(action: LifecycleAction | null): string {
  if (action?.type === 'safe-exit') return '确认退出'
  if (action?.type === 'session-delete') return '删除会话'
  if (action?.type === 'output-delete') return '删除报告'
  return '确认'
}

function applyOutputAssetState(
  output: ThinkTankWorkflowOutput | null,
  assetState: ThinkTankOutputAssetState
): ThinkTankWorkflowOutput | null {
  if (!output || output.id !== assetState.outputId) return output

  return {
    ...output,
    assetState,
  }
}

function applyHistoryAssetState(
  item: ThinkTankHistoryItem,
  assetState: ThinkTankOutputAssetState
): ThinkTankHistoryItem {
  if (item.outputId !== assetState.outputId && item.id !== assetState.outputId) return item

  return {
    ...item,
    assetState,
  }
}

function applyOutputKnowledgeBaseAssociationState(
  output: ThinkTankWorkflowOutput | null,
  knowledgeBaseAssociation: ThinkTankOutputKnowledgeBaseAssociationState
): ThinkTankWorkflowOutput | null {
  if (!output || output.id !== knowledgeBaseAssociation.outputId) return output

  return {
    ...output,
    knowledgeBaseAssociation,
  }
}

function applyHistoryKnowledgeBaseAssociationState(
  item: ThinkTankHistoryItem,
  knowledgeBaseAssociation: ThinkTankOutputKnowledgeBaseAssociationState
): ThinkTankHistoryItem {
  if (
    item.outputId !== knowledgeBaseAssociation.outputId &&
    item.id !== knowledgeBaseAssociation.outputId
  ) {
    return item
  }

  return {
    ...item,
    knowledgeBaseAssociation,
  }
}

function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    if (typeof window.matchMedia !== 'function') {
      setIsDesktop(false)
      return undefined
    }

    const mediaQuery = window.matchMedia(ADVISORY_DESKTOP_QUERY)
    const update = (event?: MediaQueryListEvent) => {
      setIsDesktop(event?.matches ?? mediaQuery.matches)
    }

    update()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
      return () => mediaQuery.removeEventListener?.('change', update)
    }

    mediaQuery.addListener?.(update)
    return () => mediaQuery.removeListener?.(update)
  }, [])

  return isDesktop
}

function ViewportCheckingState() {
  return (
    <section
      className="flex min-h-[calc(100vh-var(--advisory-nav-height))] items-center justify-center bg-[hsl(var(--advisory-shell-bg))] px-6 py-10"
      style={ADVISORY_LAYOUT_STYLE}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 工作区准备状态"
        className="text-sm font-medium text-[hsl(var(--advisory-foreground))]"
      >
        正在准备 ThinkTank 工作区
      </div>
    </section>
  )
}

function DesktopRequiredState() {
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    statusRef.current?.focus()
  }, [])

  return (
    <section
      className="flex min-h-[calc(100vh-var(--advisory-nav-height))] items-center justify-center bg-[hsl(var(--advisory-shell-bg))] px-6 py-10"
      style={ADVISORY_LAYOUT_STYLE}
    >
      <div
        ref={statusRef}
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 桌面端要求"
        tabIndex={-1}
        className="max-w-xl rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[hsl(var(--advisory-icon-bg))]">
            <BrainCircuit className="h-5 w-5 text-[hsl(var(--advisory-foreground))]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--advisory-foreground))]">
              ThinkTank MVP 当前需要桌面端宽屏使用
            </h1>
            <p className="mt-3 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
              请在宽度不小于 {ADVISORY_LAYOUT.desktopMinWidth}px
              的桌面浏览器中打开，以保持咨询导航、对话区和文档抽屉的稳定布局。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ReadingDensityControl({
  value,
  onChange,
}: {
  value: AdvisoryReadingDensity
  onChange: (value: AdvisoryReadingDensity) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-xs font-medium text-[hsl(var(--advisory-muted-foreground))]">
        阅读密度
      </span>
      <RadioGroup
        aria-label="阅读密度"
        value={value}
        onValueChange={(nextValue) => onChange(normalizeAdvisoryReadingDensity(nextValue))}
        className="grid grid-cols-3 gap-1 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-1"
      >
        {ADVISORY_READING_DENSITY_OPTIONS.map((option) => {
          const itemId = `advisory-reading-density-${option.value}`

          return (
            <div key={option.value} className="relative">
              <RadioGroupItem
                id={itemId}
                value={option.value}
                aria-label={option.label}
                className="peer sr-only"
                onKeyUp={(event) => {
                  if (event.key === ' ' || event.key === 'Space' || event.key === 'Enter') {
                    event.preventDefault()
                    if (value !== option.value) {
                      onChange(option.value)
                    }
                  }
                }}
              />
              <Label
                htmlFor={itemId}
                className="flex h-7 min-w-12 cursor-pointer items-center justify-center rounded-sm px-2 text-xs font-medium text-[hsl(var(--advisory-muted-foreground))] transition-colors peer-data-[state=checked]:bg-[hsl(var(--advisory-panel))] peer-data-[state=checked]:text-[hsl(var(--advisory-foreground))] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--ring))]"
              >
                {option.label}
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )
}

export default function AdvisoryWorkspaceShell() {
  const { data: session } = useSession()
  const isDesktop = useDesktopViewport()
  const userPreferenceIdentity =
    session?.user?.id ??
    (session?.user?.organizationId && session.user.email
      ? `${session.user.organizationId}:${session.user.email}`
      : (session?.user?.email ?? null))
  const organizationContextPreferenceIdentity =
    [
      session?.user?.tenantId,
      session?.user?.organizationId,
      session?.user?.id ?? session?.user?.email,
    ]
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(':') || null
  const advisorySessionIdentity =
    [
      session?.user?.tenantId,
      session?.user?.organizationId,
      session?.user?.id ?? session?.user?.email,
    ]
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(':') || null
  const [readingDensity, setReadingDensity] = useState<AdvisoryReadingDensity>(
    DEFAULT_ADVISORY_READING_DENSITY
  )
  const [workflowCatalogStatus, setWorkflowCatalogStatus] =
    useState<WorkflowCatalogStatus>('loading')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('quick-consult')
  const [workflows, setWorkflows] = useState<ThinkTankWorkflowCatalogItem[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [unfinishedSessionsStatus, setUnfinishedSessionsStatus] =
    useState<UnfinishedSessionsStatus>('idle')
  const [unfinishedSessions, setUnfinishedSessions] = useState<ThinkTankUnfinishedSessionCard[]>([])
  const [unfinishedSessionsError, setUnfinishedSessionsError] = useState<string | null>(null)
  const [historyStatus, setHistoryStatus] = useState<HistoryLoadStatus>('idle')
  const [historyItems, setHistoryItems] = useState<ThinkTankHistoryItem[]>([])
  const [historyMeta, setHistoryMeta] =
    useState<ThinkTankHistoryResult['meta']>(INITIAL_HISTORY_META)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historySearchDraft, setHistorySearchDraft] = useState('')
  const [historyTypeFilter, setHistoryTypeFilter] = useState<ThinkTankHistoryType>('all')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ThinkTankHistoryStatus>('all')
  const [historyWorkflowFilter, setHistoryWorkflowFilter] = useState('all')
  const [historyTimeFilter, setHistoryTimeFilter] = useState<HistoryTimeFilter>('all')
  const [openingHistoryItemKey, setOpeningHistoryItemKey] = useState<string | null>(null)
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<ThinkTankRecoveryMessage | null>(null)
  const [launchingWorkflowKey, setLaunchingWorkflowKey] = useState<string | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [activeLaunch, setActiveLaunch] = useState<ThinkTankWorkflowLaunchResult | null>(null)
  const [sessionMessagesStatus, setSessionMessagesStatus] = useState<SessionMessagesStatus>('idle')
  const [sessionMessages, setSessionMessages] = useState<ThinkTankConversationMessage[]>([])
  const [messageError, setMessageError] = useState<string | null>(null)
  const [checkpointWarningMessage, setCheckpointWarningMessage] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false)
  const [messageStreamingStatus, setMessageStreamingStatus] =
    useState<MessageStreamingStatus>('idle')
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamAnnouncement, setStreamAnnouncement] = useState('')
  const [partyModeReplyTarget, setPartyModeReplyTarget] = useState<PartyModeReplyTarget | null>(
    null
  )
  const [hasUnreadStreamContent, setHasUnreadStreamContent] = useState(false)
  const [showAllMessages, setShowAllMessages] = useState(false)
  const [selectedDecisionLabel, setSelectedDecisionLabel] = useState<string | null>(null)
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false)
  const [documentDrawerWidth, setDocumentDrawerWidth] = useState<number | string>(
    ADVISORY_LAYOUT.drawerDefaultWidth
  )
  const [workflowOutput, setWorkflowOutput] = useState<ThinkTankWorkflowOutput | null>(null)
  const [historyPreviewOutput, setHistoryPreviewOutput] = useState<ThinkTankWorkflowOutput | null>(
    null
  )
  const [hasUnreadDocumentContent, setHasUnreadDocumentContent] = useState(false)
  const [outputAnnouncement, setOutputAnnouncement] = useState('')
  const [outputCompletionFeedback, setOutputCompletionFeedback] = useState<string | undefined>()
  const [isCompletingOutput, setIsCompletingOutput] = useState(false)
  const [outputExportingFormat, setOutputExportingFormat] =
    useState<ThinkTankOutputExportFormat | null>(null)
  const [outputExportError, setOutputExportError] = useState<string | null>(null)
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<LifecycleAction | null>(null)
  const [lifecycleActionInFlight, setLifecycleActionInFlight] = useState(false)
  const [lifecycleActionError, setLifecycleActionError] = useState<string | null>(null)
  const [organizationContext, setOrganizationContext] = useState<OrganizationContextState | null>(
    null
  )
  const [organizationContextStatus, setOrganizationContextStatus] =
    useState<OrganizationContextStatus>('idle')
  const [organizationContextDialogOpen, setOrganizationContextDialogOpen] = useState(false)
  const [organizationContextDialogMode, setOrganizationContextDialogMode] = useState<
    'first-use' | 'settings'
  >('first-use')
  const [organizationContextError, setOrganizationContextError] = useState<string | null>(null)
  const [organizationContextErrorSource, setOrganizationContextErrorSource] = useState<
    'load' | 'save' | null
  >(null)
  const launchInFlightRef = useRef(false)
  const activeLaunchRef = useRef<ThinkTankWorkflowLaunchResult | null>(null)
  const organizationContextGateResolversRef = useRef<Array<(allowed: boolean) => void>>([])
  const lifecycleCancelButtonRef = useRef<HTMLButtonElement>(null)
  const quickConsultButtonRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const conversationFocusRef = useRef<HTMLDivElement>(null)
  const conversationScrollRef = useRef<HTMLDivElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const messageSubmitInFlightRef = useRef(false)
  const skipNextSessionMessagesLoadRef = useRef<string | null>(null)
  const skipNextOutputLoadRef = useRef<string | null>(null)
  const outputExportRequestIdRef = useRef(0)
  const messageStreamRequestIdRef = useRef(0)
  const resumeRequestIdRef = useRef(0)
  const historyRequestIdRef = useRef(0)
  const historyOpenRequestIdRef = useRef(0)
  const lastStreamAnnouncementAtRef = useRef(0)
  const pendingStreamAnnouncementRef = useRef<number | null>(null)
  const activeSessionId = activeLaunch?.sessionId ?? null

  const createHistoryQuery = (includeSearch: boolean, page = 1): ThinkTankHistoryQuery => {
    const query: ThinkTankHistoryQuery = {
      type: historyTypeFilter,
      status: historyStatusFilter,
      page,
      limit: THINKTANK_HISTORY_PAGE_SIZE,
    }
    if (historyWorkflowFilter !== 'all') {
      query.workflowKey = historyWorkflowFilter
    }
    if (includeSearch && historySearchDraft.trim()) {
      query.q = historySearchDraft.trim()
    }
    if (historyTimeFilter !== 'all') {
      const days = historyTimeFilter === '7d' ? 7 : 30
      query.from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    }

    return query
  }

  const openFirstConsult = () => {
    setWorkspaceMode('quick-consult')
    quickConsultButtonRef.current?.focus({ preventScroll: true })
  }

  const createHistoryWorkflowLaunch = (
    item: ThinkTankHistoryItem,
    currentStep?: ThinkTankWorkflowCurrentStep
  ): ThinkTankWorkflowLaunchResult => ({
    sessionId: item.sessionId,
    workflow: {
      key: item.workflowKey,
      displayName: item.workflowType,
      canonicalName: item.workflowType,
      scenarioLabel: item.status === 'active' ? '历史会话' : '历史记录',
      sourcePath: `workflow:${item.workflowKey}`,
    },
    status: item.status === 'paused' ? 'active' : item.status,
    sourceRefs: [`workflow:${item.workflowKey}`],
    firstPrompt:
      item.openTarget === 'view-output'
        ? `已打开历史报告：${item.title}`
        : `已打开历史会话：${item.title}`,
    currentStep: item.lastStep ?? currentStep ?? { index: 1, label: '历史记录' },
  })

  useEffect(() => {
    setReadingDensity(readAdvisoryPreferences(userPreferenceIdentity).readingDensity)
  }, [userPreferenceIdentity])

  const handleReadingDensityChange = (nextDensity: AdvisoryReadingDensity) => {
    setReadingDensity(nextDensity)
    writeAdvisoryPreferences(userPreferenceIdentity, { readingDensity: nextDensity })
  }

  useEffect(() => {
    if (isDesktop !== true) {
      return undefined
    }

    let isCancelled = false
    setWorkflowCatalogStatus('loading')
    setCatalogError(null)

    fetchThinkTankWorkflows()
      .then((catalog) => {
        if (isCancelled) return
        setWorkflows(catalog.workflows)
        setWorkflowCatalogStatus('ready')
      })
      .catch((error) => {
        if (isCancelled) return
        setWorkflows([])
        setCatalogError(readWorkflowErrorMessage(error, WORKFLOW_CATALOG_ERROR_MESSAGE))
        setWorkflowCatalogStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [isDesktop])

  useEffect(() => {
    setUnfinishedSessions([])
    setUnfinishedSessionsError(null)
    setHistoryItems([])
    setHistoryMeta(INITIAL_HISTORY_META)
    setHistoryLoadingMore(false)
    setHistoryError(null)
    setResumeError(null)
    setRecoveryMessage(null)
    setPendingLifecycleAction(null)
    setLifecycleActionError(null)
    setLifecycleActionInFlight(false)
    setActiveLaunch(null)
    activeLaunchRef.current = null
    setHistoryPreviewOutput(null)
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    messageStreamRequestIdRef.current += 1
    resumeRequestIdRef.current += 1
    historyRequestIdRef.current += 1
    historyOpenRequestIdRef.current += 1
    messageSubmitInFlightRef.current = false
    setIsSubmittingMessage(false)
    setMessageStreamingStatus('idle')
    setStreamingMessageId(null)
    setPartyModeReplyTarget(null)
    setResumingSessionId(null)
    setWorkspaceMode('quick-consult')

    if (isDesktop !== true || !advisorySessionIdentity) {
      setUnfinishedSessionsStatus('idle')
      return undefined
    }

    let isCancelled = false
    setUnfinishedSessionsStatus('loading')
    setUnfinishedSessionsError(null)

    fetchThinkTankUnfinishedSessions()
      .then((result) => {
        if (isCancelled) return
        setUnfinishedSessions(result.sessions)
        setUnfinishedSessionsStatus('ready')
      })
      .catch((error) => {
        if (isCancelled) return
        setUnfinishedSessions([])
        setUnfinishedSessionsError(
          readWorkflowErrorMessage(error, THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE)
        )
        setUnfinishedSessionsStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [advisorySessionIdentity, isDesktop])

  useEffect(() => {
    if (isDesktop !== true || !advisorySessionIdentity) {
      setHistoryStatus('idle')
      setHistoryItems([])
      setHistoryMeta(INITIAL_HISTORY_META)
      setHistoryLoadingMore(false)
      setHistoryError(null)
      return undefined
    }

    const requestId = historyRequestIdRef.current + 1
    historyRequestIdRef.current = requestId
    setHistoryStatus('loading')
    setHistoryError(null)
    setHistoryLoadingMore(false)

    const includeSearch = Boolean(historySearchDraft.trim())
    const request = includeSearch
      ? searchThinkTankHistory(createHistoryQuery(true))
      : fetchThinkTankSessionHistory(createHistoryQuery(false))

    request
      .then((result) => {
        if (historyRequestIdRef.current !== requestId) return
        setHistoryItems(result.items)
        setHistoryMeta(result.meta)
        setHistoryStatus('ready')
      })
      .catch((error) => {
        if (historyRequestIdRef.current !== requestId) return
        setHistoryItems([])
        setHistoryMeta(INITIAL_HISTORY_META)
        setHistoryError(readWorkflowErrorMessage(error, THINKTANK_HISTORY_LOAD_FAILED_MESSAGE))
        setHistoryStatus('error')
      })

    return () => {
      if (historyRequestIdRef.current === requestId) {
        historyRequestIdRef.current += 1
      }
    }
  }, [
    advisorySessionIdentity,
    isDesktop,
    historyTypeFilter,
    historyStatusFilter,
    historyWorkflowFilter,
    historyTimeFilter,
  ])

  useEffect(() => {
    if (isDesktop !== true) {
      return undefined
    }

    let isCancelled = false
    setOrganizationContext(null)
    setOrganizationContextStatus('loading')
    setOrganizationContextError(null)
    setOrganizationContextErrorSource(null)

    fetchOrganizationContext()
      .then((context) => {
        if (isCancelled) return
        setOrganizationContext(context)
        setOrganizationContextStatus('ready')
        setOrganizationContextErrorSource(null)
        const hasUsableContext = isOrganizationContextUsable(context)
        const hasSkippedContext = readOrganizationContextSkip(organizationContextPreferenceIdentity)
        if (hasUsableContext || hasSkippedContext) {
          setOrganizationContextDialogOpen(false)
          resolveOrganizationContextGate(true)
          return
        }
        if (!hasUsableContext && !hasSkippedContext) {
          setOrganizationContextDialogMode('first-use')
          setOrganizationContextDialogOpen(true)
        }
      })
      .catch((error) => {
        if (isCancelled) return
        setOrganizationContext(null)
        setOrganizationContextStatus('error')
        setOrganizationContextErrorSource('load')
        setOrganizationContextError(
          readWorkflowErrorMessage(error, ORGANIZATION_CONTEXT_LOAD_FAILED_MESSAGE)
        )
        if (organizationContextGateResolversRef.current.length > 0) {
          setOrganizationContextDialogOpen(false)
          resolveOrganizationContextGate(true)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isDesktop, organizationContextPreferenceIdentity])

  const executeLaunchWorkflow = async (
    workflowKey: string,
    options: ThinkTankWorkflowLaunchOptions = {}
  ) => {
    if (launchInFlightRef.current) {
      return
    }
    if (activeLaunchRef.current) {
      if (
        options.acceptedRecommendation === true ||
        options.manualChoice === true ||
        Boolean(options.quickConsultContextId)
      ) {
        throw new Error(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)
      }
      return
    }

    launchInFlightRef.current = true
    setLaunchError(null)
    setLaunchingWorkflowKey(workflowKey)

    try {
      const launch = await launchThinkTankWorkflow(workflowKey, options)
      activeLaunchRef.current = launch
      setSessionMessages([])
      setSessionMessagesStatus('loading')
      setMessageError(null)
      setCheckpointWarningMessage(null)
      setResumeError(null)
      setRecoveryMessage(null)
      setMessageStreamingStatus('idle')
      setStreamingMessageId(null)
      setStreamAnnouncement('')
      setHasUnreadStreamContent(false)
      setShowAllMessages(false)
      setSelectedDecisionLabel(null)
      setDocumentDrawerOpen(false)
      setWorkflowOutput(null)
      setHistoryPreviewOutput(null)
      setHasUnreadDocumentContent(false)
      setOutputAnnouncement('')
      setOutputCompletionFeedback(undefined)
      setOutputExportingFormat(null)
      setOutputExportError(null)
      outputExportRequestIdRef.current += 1
      setDraft(readStoredDraft(userPreferenceIdentity, launch.sessionId))
      setWorkspaceMode('workflow')
      setActiveLaunch(launch)
      showCheckpointWarning(launch.checkpointWarning)
    } catch (error) {
      setLaunchError(readWorkflowErrorMessage(error, THINKTANK_WORKFLOW_START_FAILED_MESSAGE))
    } finally {
      launchInFlightRef.current = false
      setLaunchingWorkflowKey(null)
    }
  }

  const shouldPromptForOrganizationContext = () =>
    !(organizationContextStatus === 'error' && organizationContextErrorSource === 'load') &&
    !isOrganizationContextUsable(organizationContext) &&
    !readOrganizationContextSkip(organizationContextPreferenceIdentity)

  const resolveOrganizationContextGate = (allowed: boolean) => {
    const resolvers = organizationContextGateResolversRef.current.splice(0)
    resolvers.forEach((resolve) => resolve(allowed))
  }

  const requestOrganizationContextGate = (): Promise<boolean> => {
    if (!shouldPromptForOrganizationContext()) {
      return Promise.resolve(true)
    }

    setOrganizationContextDialogMode('first-use')
    setOrganizationContextError(null)
    setOrganizationContextDialogOpen(true)

    return new Promise((resolve) => {
      organizationContextGateResolversRef.current.push(resolve)
    })
  }

  const handleLaunchWorkflow = async (
    workflowKey: string,
    options: ThinkTankWorkflowLaunchOptions = {}
  ) => {
    const canLaunch = await requestOrganizationContextGate()
    if (!canLaunch) {
      return
    }

    await executeLaunchWorkflow(workflowKey, options)
  }

  const handleResumeSession = async (sessionId: string) => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    messageStreamRequestIdRef.current += 1
    const resumeRequestId = resumeRequestIdRef.current + 1
    resumeRequestIdRef.current = resumeRequestId
    messageSubmitInFlightRef.current = false
    setIsSubmittingMessage(false)
    setMessageStreamingStatus('idle')
    setStreamingMessageId(null)
    setResumingSessionId(sessionId)
    setResumeError(null)
    setLaunchError(null)
    setMessageError(null)
    setCheckpointWarningMessage(null)
    setHistoryPreviewOutput(null)

    try {
      const resumed = await resumeThinkTankSession(sessionId)
      if (resumeRequestIdRef.current !== resumeRequestId) return
      const launch = toWorkflowLaunchFromResume(resumed)

      activeLaunchRef.current = launch
      skipNextSessionMessagesLoadRef.current = launch.sessionId
      skipNextOutputLoadRef.current = launch.sessionId
      setSessionMessages(resumed.messages)
      setSessionMessagesStatus('ready')
      setMessageStreamingStatus('idle')
      setStreamingMessageId(null)
      setStreamAnnouncement('')
      setHasUnreadStreamContent(false)
      setShowAllMessages(false)
      setSelectedDecisionLabel(null)
      setWorkflowOutput(resumed.output)
      setHasUnreadDocumentContent(false)
      setOutputAnnouncement('')
      setOutputCompletionFeedback(undefined)
      setOutputExportingFormat(null)
      setOutputExportError(null)
      setRecoveryMessage(resumed.recoveryMessage)
      outputExportRequestIdRef.current += 1
      setDraft(readStoredDraft(userPreferenceIdentity, launch.sessionId))
      setWorkspaceMode('workflow')
      setActiveLaunch(launch)
      showCheckpointWarning(resumed.checkpointWarning)
    } catch (error) {
      if (resumeRequestIdRef.current !== resumeRequestId) return
      setResumeError(readWorkflowErrorMessage(error, THINKTANK_RESUME_SESSION_FAILED_MESSAGE))
    } finally {
      if (resumeRequestIdRef.current === resumeRequestId) {
        setResumingSessionId(null)
      }
    }
  }

  const handleSearchHistory = async () => {
    const requestId = historyRequestIdRef.current + 1
    historyRequestIdRef.current = requestId
    setHistoryStatus('loading')
    setHistoryError(null)
    setHistoryLoadingMore(false)

    try {
      const result = historySearchDraft.trim()
        ? await searchThinkTankHistory(createHistoryQuery(true))
        : await fetchThinkTankSessionHistory(createHistoryQuery(false))
      if (historyRequestIdRef.current !== requestId) return
      setHistoryItems(result.items)
      setHistoryMeta(result.meta)
      setHistoryStatus('ready')
    } catch (error) {
      if (historyRequestIdRef.current !== requestId) return
      setHistoryItems([])
      setHistoryMeta(INITIAL_HISTORY_META)
      setHistoryError(
        readWorkflowErrorMessage(
          error,
          historySearchDraft.trim()
            ? THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE
            : THINKTANK_HISTORY_LOAD_FAILED_MESSAGE
        )
      )
      setHistoryStatus('error')
    }
  }

  const handleLoadMoreHistory = async () => {
    if (historyLoadingMore || historyStatus !== 'ready') return
    const nextPage = historyMeta.page + 1
    const requestId = historyRequestIdRef.current + 1
    historyRequestIdRef.current = requestId
    setHistoryLoadingMore(true)
    setHistoryError(null)

    try {
      const result = historySearchDraft.trim()
        ? await searchThinkTankHistory(createHistoryQuery(true, nextPage))
        : await fetchThinkTankSessionHistory(createHistoryQuery(false, nextPage))
      if (historyRequestIdRef.current !== requestId) return
      setHistoryItems((currentItems) => {
        const existingKeys = new Set(
          currentItems.map((currentItem) => getHistoryItemKey(currentItem))
        )
        const nextItems = result.items.filter(
          (nextItem) => !existingKeys.has(getHistoryItemKey(nextItem))
        )
        return [...currentItems, ...nextItems]
      })
      setHistoryMeta(result.meta)
      setHistoryStatus('ready')
    } catch (error) {
      if (historyRequestIdRef.current !== requestId) return
      setHistoryError(readWorkflowErrorMessage(error, THINKTANK_HISTORY_LOAD_FAILED_MESSAGE))
    } finally {
      if (historyRequestIdRef.current === requestId) {
        setHistoryLoadingMore(false)
      }
    }
  }

  const handleOpenHistoryItem = async (item: ThinkTankHistoryItem) => {
    if (item.openTarget === 'resume-session') {
      await handleResumeSession(item.sessionId)
      return
    }

    if (item.openTarget === 'view-output') {
      const openRequestId = historyOpenRequestIdRef.current + 1
      historyOpenRequestIdRef.current = openRequestId
      setOpeningHistoryItemKey(getHistoryItemKey(item))
      setHistoryError(null)

      try {
        const outputResult = await fetchThinkTankWorkflowOutput(item.sessionId, {
          outputId: item.outputId,
        })
        if (historyOpenRequestIdRef.current !== openRequestId) return
        setHistoryPreviewOutput(outputResult.output)
        setDocumentDrawerOpen(true)
        setHasUnreadDocumentContent(false)
        setOutputAnnouncement(`已打开历史报告：${item.title}`)
      } catch (error) {
        if (historyOpenRequestIdRef.current !== openRequestId) return
        setHistoryError(readWorkflowErrorMessage(error, THINKTANK_HISTORY_LOAD_FAILED_MESSAGE))
      } finally {
        if (historyOpenRequestIdRef.current === openRequestId) {
          setOpeningHistoryItemKey(null)
        }
      }
      return
    }

    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    messageStreamRequestIdRef.current += 1
    const openRequestId = historyOpenRequestIdRef.current + 1
    historyOpenRequestIdRef.current = openRequestId
    messageSubmitInFlightRef.current = false
    setIsSubmittingMessage(false)
    setMessageStreamingStatus('idle')
    setStreamingMessageId(null)
    setOpeningHistoryItemKey(getHistoryItemKey(item))
    setHistoryError(null)
    setLaunchError(null)
    setMessageError(null)
    setCheckpointWarningMessage(null)
    const isCurrentSession = activeLaunchRef.current?.sessionId === item.sessionId

    try {
      const [messagesResult, outputResult] = await Promise.all([
        fetchThinkTankSessionMessages(item.sessionId),
        fetchThinkTankWorkflowOutput(item.sessionId, { outputId: item.outputId }),
      ])
      if (historyOpenRequestIdRef.current !== openRequestId) return

      const launch = createHistoryWorkflowLaunch(item, messagesResult.currentStep)
      activeLaunchRef.current = launch
      skipNextSessionMessagesLoadRef.current = launch.sessionId
      skipNextOutputLoadRef.current = launch.sessionId
      setSessionMessages(messagesResult.messages)
      setSessionMessagesStatus('ready')
      setMessageStreamingStatus('idle')
      setStreamingMessageId(null)
      setStreamAnnouncement('')
      setHasUnreadStreamContent(false)
      setShowAllMessages(false)
      setSelectedDecisionLabel(null)
      setWorkflowOutput(outputResult.output)
      setHistoryPreviewOutput(null)
      setHasUnreadDocumentContent(false)
      setOutputAnnouncement('')
      setOutputCompletionFeedback(undefined)
      setOutputExportingFormat(null)
      setOutputExportError(null)
      if (!isCurrentSession) {
        setRecoveryMessage(null)
      }
      outputExportRequestIdRef.current += 1
      setDraft(readStoredDraft(userPreferenceIdentity, launch.sessionId))
      setWorkspaceMode('workflow')
      setActiveLaunch(launch)
      setDocumentDrawerOpen(false)
    } catch (error) {
      if (historyOpenRequestIdRef.current !== openRequestId) return
      setHistoryError(readWorkflowErrorMessage(error, THINKTANK_HISTORY_LOAD_FAILED_MESSAGE))
    } finally {
      if (historyOpenRequestIdRef.current === openRequestId) {
        setOpeningHistoryItemKey(null)
      }
    }
  }

  const invalidateWorkflowAsyncWork = () => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    messageStreamRequestIdRef.current += 1
    resumeRequestIdRef.current += 1
    historyRequestIdRef.current += 1
    historyOpenRequestIdRef.current += 1
    outputExportRequestIdRef.current += 1
    messageSubmitInFlightRef.current = false
    setIsSubmittingMessage(false)
    setMessageStreamingStatus('idle')
    setStreamingMessageId(null)
    setOpeningHistoryItemKey(null)
    setResumingSessionId(null)
    setOutputExportingFormat(null)
  }

  const clearActiveWorkflowStateIfSession = (sessionId: string) => {
    if (activeLaunchRef.current?.sessionId !== sessionId) return

    activeLaunchRef.current = null
    skipNextSessionMessagesLoadRef.current = null
    skipNextOutputLoadRef.current = null
    setActiveLaunch(null)
    setSessionMessages([])
    setSessionMessagesStatus('idle')
    setMessageError(null)
    setCheckpointWarningMessage(null)
    setDraft('')
    setMessageStreamingStatus('idle')
    setStreamingMessageId(null)
    setStreamAnnouncement('')
    setHasUnreadStreamContent(false)
    setShowAllMessages(false)
    setSelectedDecisionLabel(null)
    setDocumentDrawerOpen(false)
    setWorkflowOutput(null)
    setHistoryPreviewOutput(null)
    setHasUnreadDocumentContent(false)
    setOutputAnnouncement('')
    setOutputCompletionFeedback(undefined)
    setOutputExportError(null)
    setRecoveryMessage(null)
    setWorkspaceMode('quick-consult')
  }

  const upsertPausedUnfinishedSession = (
    launch: ThinkTankWorkflowLaunchResult | null,
    updatedAt: string
  ) => {
    if (!launch) return

    setUnfinishedSessions((currentSessions) => {
      const updated = currentSessions.map((sessionCard) =>
        sessionCard.sessionId === launch.sessionId
          ? {
              ...sessionCard,
              status: 'paused' as const,
              statusSummary: '已安全退出 - 可继续',
              lastActivityAt: updatedAt,
            }
          : sessionCard
      )
      if (updated.some((sessionCard) => sessionCard.sessionId === launch.sessionId)) {
        return updated
      }

      return [
        {
          sessionId: launch.sessionId,
          workflowKey: launch.workflow.key,
          workflowType: launch.workflow.displayName,
          title: launch.workflow.displayName,
          lastStep: launch.currentStep,
          status: 'paused' as const,
          statusSummary: '已安全退出 - 可继续',
          lastActivityAt: updatedAt,
          checkpointSource: 'fallback' as const,
        },
        ...updated,
      ]
    })
    setUnfinishedSessionsStatus('ready')
  }

  const updateHistorySessionPaused = (sessionId: string, updatedAt: string) => {
    setHistoryItems((currentItems) =>
      currentItems.map((item) =>
        item.sessionId === sessionId && item.resultType === 'session'
          ? {
              ...item,
              status: 'paused' as const,
              timestamp: updatedAt,
              summary: item.summary || '已安全退出 - 可继续',
            }
          : item
      )
    )
  }

  const refreshActiveSessionMessages = async (sessionId: string) => {
    if (activeLaunchRef.current?.sessionId !== sessionId) return

    try {
      const result = await fetchThinkTankSessionMessages(sessionId)
      if (activeLaunchRef.current?.sessionId !== sessionId) return
      setSessionMessages(result.messages)
      setSessionMessagesStatus('ready')
      setShowAllMessages(false)
      setHasUnreadStreamContent(false)
    } catch {
      if (activeLaunchRef.current?.sessionId !== sessionId) return
      setSessionMessages((currentMessages) =>
        currentMessages.filter((message) => message.metadata?.streaming !== true)
      )
      setSessionMessagesStatus('ready')
    }
  }

  const removeOutputFromVisibleState = (outputId: string, sessionId?: string) => {
    setHistoryItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.outputId !== outputId && !(item.resultType === 'output' && item.id === outputId)
      )
    )
    setWorkflowOutput((currentOutput) =>
      currentOutput?.id === outputId && (!sessionId || currentOutput.sessionId === sessionId)
        ? null
        : currentOutput
    )
    setHistoryPreviewOutput((currentOutput) =>
      currentOutput?.id === outputId && (!sessionId || currentOutput.sessionId === sessionId)
        ? null
        : currentOutput
    )
    if (documentDrawerOutput?.id === outputId) {
      setDocumentDrawerOpen(false)
    }
    setHasUnreadDocumentContent(false)
    setOutputCompletionFeedback(undefined)
    setOutputExportError(null)
  }

  const removeSessionFromVisibleState = (sessionId: string) => {
    setUnfinishedSessions((currentSessions) =>
      currentSessions.filter((sessionCard) => sessionCard.sessionId !== sessionId)
    )
    setHistoryItems((currentItems) => currentItems.filter((item) => item.sessionId !== sessionId))
    if (documentDrawerOutput?.sessionId === sessionId) {
      setDocumentDrawerOpen(false)
    }
    clearActiveWorkflowStateIfSession(sessionId)
    setWorkflowOutput((currentOutput) =>
      currentOutput?.sessionId === sessionId ? null : currentOutput
    )
    setHistoryPreviewOutput((currentOutput) =>
      currentOutput?.sessionId === sessionId ? null : currentOutput
    )
  }

  const openLifecycleDialog = (action: LifecycleAction) => {
    setLifecycleActionError(null)
    setPendingLifecycleAction(action)
  }

  const handleLifecycleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen || lifecycleActionInFlight) return

    setPendingLifecycleAction(null)
    setLifecycleActionError(null)
  }

  useEffect(() => {
    if (!pendingLifecycleAction) return

    const focusTimer = window.setTimeout(() => {
      lifecycleCancelButtonRef.current?.focus({ preventScroll: true })
    }, 0)
    const dismissIfAllowed = () => {
      if (!lifecycleActionInFlight) {
        setPendingLifecycleAction(null)
        setLifecycleActionError(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissIfAllowed()
      }
    }
    const handleBodyDismiss = (event: MouseEvent | PointerEvent) => {
      if (event.target === document.body) {
        dismissIfAllowed()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handleBodyDismiss)
    document.addEventListener('mousedown', handleBodyDismiss)
    document.addEventListener('click', handleBodyDismiss)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handleBodyDismiss)
      document.removeEventListener('mousedown', handleBodyDismiss)
      document.removeEventListener('click', handleBodyDismiss)
    }
  }, [pendingLifecycleAction, lifecycleActionInFlight])

  const closeLifecycleDialogBeforeStateTransition = () => {
    setPendingLifecycleAction(null)
  }

  const handleConfirmLifecycleAction = async () => {
    if (!pendingLifecycleAction || lifecycleActionInFlight) return

    const action = pendingLifecycleAction
    const shouldRefreshMessagesAfterFailure =
      activeLaunchRef.current?.sessionId === action.sessionId &&
      (Boolean(streamAbortRef.current) || messageSubmitInFlightRef.current)
    setLifecycleActionInFlight(true)
    setLifecycleActionError(null)

    try {
      if (action.type === 'safe-exit') {
        const launchSnapshot = activeLaunchRef.current
        invalidateWorkflowAsyncWork()
        const result = await safeExitThinkTankSession(action.sessionId)

        closeLifecycleDialogBeforeStateTransition()
        upsertPausedUnfinishedSession(launchSnapshot, result.updatedAt)
        updateHistorySessionPaused(result.sessionId, result.updatedAt)
        clearActiveWorkflowStateIfSession(result.sessionId)
        showCheckpointWarning(result.checkpointWarning)
        setOutputAnnouncement('工作流已安全退出，当前进度已自动保存。')
        toast.success('工作流已安全退出，进度已自动保存。')
      }

      if (action.type === 'session-delete') {
        if (activeLaunchRef.current?.sessionId === action.sessionId) {
          invalidateWorkflowAsyncWork()
        }
        const result = await deleteThinkTankSession(action.sessionId)

        closeLifecycleDialogBeforeStateTransition()
        removeSessionFromVisibleState(result.sessionId)
        setOutputAnnouncement('ThinkTank 会话已删除。')
        toast.success('会话已删除。')
      }

      if (action.type === 'output-delete') {
        if (activeLaunchRef.current?.sessionId === action.sessionId) {
          invalidateWorkflowAsyncWork()
        }
        const result = await deleteThinkTankSessionOutput(action.sessionId, action.outputId)

        closeLifecycleDialogBeforeStateTransition()
        removeOutputFromVisibleState(result.outputId, result.sessionId)
        setOutputAnnouncement('ThinkTank 报告已删除。')
        toast.success('报告已删除。')
      }
    } catch (error) {
      const fallback =
        action.type === 'safe-exit'
          ? THINKTANK_SAFE_EXIT_SESSION_FAILED_MESSAGE
          : action.type === 'session-delete'
            ? THINKTANK_DELETE_SESSION_FAILED_MESSAGE
            : THINKTANK_OUTPUT_DELETE_FAILED_MESSAGE
      setLifecycleActionError(readWorkflowErrorMessage(error, fallback))
      if (shouldRefreshMessagesAfterFailure) {
        void refreshActiveSessionMessages(action.sessionId)
      }
    } finally {
      setLifecycleActionInFlight(false)
    }
  }

  const handleSaveOrganizationContext = async (input: SaveOrganizationContextInput) => {
    setOrganizationContextStatus('saving')
    setOrganizationContextError(null)
    try {
      const savedContext = await saveOrganizationContext(input)
      setOrganizationContext(savedContext)
      setOrganizationContextStatus('ready')
      setOrganizationContextErrorSource(null)
      setOrganizationContextDialogOpen(false)
      resolveOrganizationContextGate(true)
    } catch (error) {
      setOrganizationContextStatus('error')
      setOrganizationContextErrorSource('save')
      setOrganizationContextError(
        readWorkflowErrorMessage(error, ORGANIZATION_CONTEXT_SAVE_FAILED_MESSAGE)
      )
    }
  }

  const handleSkipOrganizationContext = () => {
    writeOrganizationContextSkip(organizationContextPreferenceIdentity)
    setOrganizationContextDialogOpen(false)
    setOrganizationContextError(null)
    setOrganizationContextErrorSource(null)
    resolveOrganizationContextGate(true)
  }

  const handleOrganizationContextDialogOpenChange = (nextOpen: boolean) => {
    setOrganizationContextDialogOpen(nextOpen)
    if (nextOpen) return

    setOrganizationContextError(null)
    if (organizationContextErrorSource === 'save') {
      setOrganizationContextErrorSource(null)
      setOrganizationContextStatus('ready')
    }
    if (organizationContextDialogMode === 'first-use') {
      resolveOrganizationContextGate(false)
    }
  }

  const handleOpenOrganizationSettings = () => {
    setOrganizationContextDialogMode('settings')
    setOrganizationContextError(null)
    setOrganizationContextDialogOpen(true)
  }

  useEffect(() => {
    if (!activeSessionId) {
      setSessionMessages([])
      setSessionMessagesStatus('idle')
      setWorkflowOutput(null)
      setHistoryPreviewOutput(null)
      setHasUnreadDocumentContent(false)
      setOutputCompletionFeedback(undefined)
      setOutputExportingFormat(null)
      setOutputExportError(null)
      setRecoveryMessage(null)
      outputExportRequestIdRef.current += 1
      return undefined
    }

    if (skipNextSessionMessagesLoadRef.current === activeSessionId) {
      skipNextSessionMessagesLoadRef.current = null
      return undefined
    }

    let isCancelled = false
    setSessionMessagesStatus('loading')
    setMessageError(null)

    fetchThinkTankSessionMessages(activeSessionId)
      .then((result) => {
        if (isCancelled) return
        setSessionMessages(result.messages)
        setShowAllMessages(false)
        setHasUnreadStreamContent(false)
        setSessionMessagesStatus('ready')
      })
      .catch((error) => {
        if (isCancelled) return
        setMessageError(readWorkflowErrorMessage(error, SESSION_MESSAGES_ERROR_MESSAGE))
        setSessionMessagesStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [activeSessionId])

  useEffect(() => {
    if (!activeSessionId) return undefined

    if (skipNextOutputLoadRef.current === activeSessionId) {
      skipNextOutputLoadRef.current = null
      return undefined
    }

    let isCancelled = false

    fetchThinkTankWorkflowOutput(activeSessionId)
      .then((result) => {
        if (isCancelled) return
        setWorkflowOutput(result.output)
        setHistoryPreviewOutput(null)
        setHasUnreadDocumentContent(false)
      })
      .catch(() => {
        if (isCancelled) return
        setWorkflowOutput(null)
        setHistoryPreviewOutput(null)
        setHasUnreadDocumentContent(false)
      })

    return () => {
      isCancelled = true
    }
  }, [activeSessionId])

  useEffect(() => {
    if (!activeLaunch) return

    writeStoredDraft(userPreferenceIdentity, activeLaunch.sessionId, draft)
  }, [activeLaunch, draft, userPreferenceIdentity])

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
      streamAbortRef.current = null
      if (pendingStreamAnnouncementRef.current) {
        window.clearTimeout(pendingStreamAnnouncementRef.current)
        pendingStreamAnnouncementRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '52px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [activeLaunch, draft])

  const isConversationNearBottom = () => {
    const viewport = conversationScrollRef.current
    if (!viewport) return true

    return (
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
      THINKTANK_SCROLL_BOTTOM_TOLERANCE_PX
    )
  }

  const scrollConversationToBottom = () => {
    const viewport = conversationScrollRef.current
    if (!viewport) return

    viewport.scrollTop = viewport.scrollHeight
    setHasUnreadStreamContent(false)
  }

  const applyStreamingScrollBehavior = (shouldAutoScroll: boolean) => {
    if (shouldAutoScroll) {
      const schedule =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame
          : (callback: FrameRequestCallback) => window.setTimeout(callback, 0)
      schedule(() => scrollConversationToBottom())
      return
    }

    setShowAllMessages(true)
    setHasUnreadStreamContent(true)
  }

  const announceStreamStatus = (message: string, options: { immediate?: boolean } = {}) => {
    const announce = () => {
      if (pendingStreamAnnouncementRef.current) {
        window.clearTimeout(pendingStreamAnnouncementRef.current)
        pendingStreamAnnouncementRef.current = null
      }
      lastStreamAnnouncementAtRef.current = Date.now()
      setStreamAnnouncement(message)
    }

    if (options.immediate) {
      announce()
      return
    }

    const elapsed = Date.now() - lastStreamAnnouncementAtRef.current
    if (elapsed >= THINKTANK_STREAM_ANNOUNCEMENT_THROTTLE_MS) {
      announce()
      return
    }

    if (!pendingStreamAnnouncementRef.current) {
      pendingStreamAnnouncementRef.current = window.setTimeout(
        announce,
        THINKTANK_STREAM_ANNOUNCEMENT_THROTTLE_MS - elapsed
      )
    }
  }

  const applyBackendWorkflowOutput = (
    output: ThinkTankWorkflowOutput | undefined,
    options: { stepLabel?: string | null } = {}
  ) => {
    if (!output) return

    const latestSection = output.sections.at(-1)
    const stepLabel = options.stepLabel ?? latestSection?.heading ?? null
    const feedback = stepLabel ? `${stepLabel}已完成，报告草稿已更新。` : '报告草稿已更新。'
    setWorkflowOutput(output)
    setHistoryPreviewOutput(null)
    setHasUnreadDocumentContent(!documentDrawerOpen)
    setOutputCompletionFeedback(feedback)
    setOutputAnnouncement(feedback)
    announceStreamStatus(feedback, { immediate: true })
  }

  const isWorkflowReadyForExplicitCompletion = (launch: ThinkTankWorkflowLaunchResult | null) => {
    const currentStep = launch?.currentStep
    return currentStep?.isFinal === true || currentStep?.isFinalStep === true
  }

  const handleSubmitMessage = async (override: DecisionSubmitOverride = {}) => {
    if (
      !activeLaunch ||
      activeLaunch.status !== 'active' ||
      sessionMessagesStatus !== 'ready' ||
      isSubmittingMessage ||
      messageSubmitInFlightRef.current
    ) {
      return
    }

    const content = (override.content ?? draft).trim()
    if (!content) {
      setMessageError(THINKTANK_EMPTY_MESSAGE_MESSAGE)
      return
    }
    if (content.length > THINKTANK_MESSAGE_MAX_LENGTH) {
      setMessageError('内容过长，请精简到 5000 字符以内。')
      return
    }
    if (!override.decisionAction) {
      const shortcutSubmitOverride = createPartyModeShortcutSubmitOverride(content, sessionMessages)
      if (shortcutSubmitOverride) {
        setDraft('')
        return handleSubmitMessage(shortcutSubmitOverride)
      }
    }

    const isDecisionSubmit = Boolean(override.decisionAction)
    const selectedDecisionLabel = override.selectedDecisionLabel ?? null

    const userMessage: ThinkTankConversationMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content,
      workflowKey: activeLaunch.workflow.key,
      stepIndex: activeLaunch.currentStep.index,
    }
    const assistantMessageId = `local-assistant-${Date.now()}`
    const pendingAssistantMessage: ThinkTankConversationMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      workflowKey: activeLaunch.workflow.key,
      stepIndex: activeLaunch.currentStep.index,
      decisionOptions: [],
      metadata: { streaming: true },
    }
    const abortController = new AbortController()
    const addressedExpertHint =
      override.addressedExpertHint ??
      (!isDecisionSubmit && partyModeReplyTarget
        ? {
            advisorId: partyModeReplyTarget.advisorId,
            messageId: partyModeReplyTarget.messageId,
          }
        : undefined)
    const streamSessionId = activeLaunch.sessionId
    const streamWorkflowKey = activeLaunch.workflow.key
    const streamStep = activeLaunch.currentStep
    const streamRequestId = messageStreamRequestIdRef.current + 1
    let receivedDeltaCount = 0
    let streamEndedWithTerminalEvent = false
    let currentPendingAssistantMessageId = assistantMessageId
    const activeStreamMessageIds = new Set<string>([userMessage.id, assistantMessageId])
    const shouldAutoScrollOnSubmit = isConversationNearBottom()
    const isCurrentMessageStream = () =>
      streamAbortRef.current === abortController &&
      messageStreamRequestIdRef.current === streamRequestId &&
      activeLaunchRef.current?.sessionId === streamSessionId
    const isActiveStreamMessage = (message: ThinkTankConversationMessage) =>
      activeStreamMessageIds.has(message.id) || message.id === currentPendingAssistantMessageId

    messageSubmitInFlightRef.current = true
    messageStreamRequestIdRef.current = streamRequestId
    streamAbortRef.current?.abort()
    streamAbortRef.current = abortController
    setMessageError(null)
    setSelectedDecisionLabel(selectedDecisionLabel)
    setIsSubmittingMessage(true)
    setMessageStreamingStatus('submitting')
    setStreamingMessageId(assistantMessageId)
    announceStreamStatus('ThinkTank 顾问正在准备回复。', { immediate: true })
    setHasUnreadStreamContent(false)
    if (!isDecisionSubmit) {
      setDraft('')
      setPartyModeReplyTarget(null)
    }
    setSessionMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      pendingAssistantMessage,
    ])
    applyStreamingScrollBehavior(shouldAutoScrollOnSubmit)

    try {
      for await (const event of streamThinkTankSessionMessage(
        streamSessionId,
        {
          content,
          decisionAction: override.decisionAction,
          decisionSourceMessageId: override.decisionSourceMessageId,
          addressedExpertHint,
        },
        { signal: abortController.signal }
      )) {
        if (!isCurrentMessageStream()) return
        const shouldAutoScroll = isConversationNearBottom()

        if (event.event === 'message.started') {
          if (event.data.currentStep) {
            const startedCurrentStep = event.data.currentStep
            const nextLaunch = activeLaunchRef.current
              ? {
                  ...activeLaunchRef.current,
                  currentStep: startedCurrentStep,
                }
              : null
            if (nextLaunch) {
              activeLaunchRef.current = nextLaunch
            }
            setActiveLaunch((currentLaunch) =>
              currentLaunch ? { ...currentLaunch, currentStep: startedCurrentStep } : currentLaunch
            )
          }
          setMessageStreamingStatus('streaming')
          announceStreamStatus('正在生成顾问回复。', { immediate: true })
          continue
        }

        if (event.event === 'party_mode.current_speaker') {
          setMessageStreamingStatus('streaming')
          const nextPendingMessageId =
            currentPendingAssistantMessageId && receivedDeltaCount === 0
              ? currentPendingAssistantMessageId
              : `local-assistant-${Date.now()}-${event.data.round}-${event.data.speakerIndex}`
          currentPendingAssistantMessageId = nextPendingMessageId
          activeStreamMessageIds.add(nextPendingMessageId)
          receivedDeltaCount = 0
          setStreamingMessageId(nextPendingMessageId)
          setSessionMessages((currentMessages) => {
            const pendingMessage: ThinkTankConversationMessage = {
              id: nextPendingMessageId,
              role: 'assistant',
              content: '',
              workflowKey: streamWorkflowKey,
              stepIndex: streamStep.index,
              decisionOptions: [],
              metadata: {
                streaming: true,
                party_mode_message: true,
                party_mode_current_speaker: true,
                party_mode_round: event.data.round,
                party_mode_speaker_index: event.data.speakerIndex,
                party_mode_advisor_id: event.data.advisorId,
                party_mode_advisor_name: event.data.advisorName,
                party_mode_advisor_role: event.data.advisorRole,
              },
            }
            if (currentMessages.some((message) => message.id === nextPendingMessageId)) {
              return currentMessages.map((message) =>
                message.id === nextPendingMessageId ? pendingMessage : message
              )
            }
            return [...currentMessages, pendingMessage]
          })
          announceStreamStatus(`${event.data.advisorName}（${event.data.advisorRole}）正在发言。`, {
            immediate: true,
          })
          applyStreamingScrollBehavior(shouldAutoScroll)
          continue
        }

        if (event.event === 'party_mode.advisor_failed') {
          streamEndedWithTerminalEvent = true
          setMessageStreamingStatus('completing')
          announceStreamStatus(`${event.data.advisorName} 本轮未能完成回复。`, {
            immediate: true,
          })
          continue
        }

        if (event.event === 'message.delta') {
          receivedDeltaCount += 1
          setMessageStreamingStatus('streaming')
          const pendingMessageIdForDelta = currentPendingAssistantMessageId
          setSessionMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === pendingMessageIdForDelta
                ? { ...message, content: `${message.content}${event.data.delta}` }
                : message
            )
          )
          announceStreamStatus(`正在生成顾问回复。已收到 ${receivedDeltaCount} 段内容。`)
          applyStreamingScrollBehavior(shouldAutoScroll)
          continue
        }

        if (event.event === 'message.error') {
          streamEndedWithTerminalEvent = true
          if (!isDecisionSubmit) {
            setDraft(content)
          }
          setMessageStreamingStatus('error')
          setMessageError(event.data.message)
          announceStreamStatus('顾问回复生成失败。', { immediate: true })
          setSessionMessages((currentMessages) => [
            ...currentMessages.filter((message) => !isActiveStreamMessage(message)),
            {
              id: `stream-error-${Date.now()}`,
              role: 'system',
              content: event.data.message,
              workflowKey: streamWorkflowKey,
              stepIndex: streamStep.index,
            },
          ])
          applyStreamingScrollBehavior(shouldAutoScroll)
          return
        }

        if (event.event === 'message.completed') {
          const completedAssistantMessage = {
            ...event.data.assistantMessage,
            decisionOptions:
              (event.data.assistantMessage.decisionOptions?.length ?? 0) > 0
                ? event.data.assistantMessage.decisionOptions
                : (event.data.decisionOptions ?? []),
          }
          const isPartyModeMessage = completedAssistantMessage.metadata?.party_mode_message === true
          const isTerminalCompletedEvent =
            !isPartyModeMessage || event.data.partyModeTurnComplete === true
          if (isTerminalCompletedEvent) {
            streamEndedWithTerminalEvent = true
          }
          const pendingMessageIdForCompletion = currentPendingAssistantMessageId
          activeStreamMessageIds.add(completedAssistantMessage.id)
          setMessageStreamingStatus(isTerminalCompletedEvent ? 'completing' : 'streaming')
          setSessionMessages((currentMessages) => {
            const fallbackPendingMessage = currentMessages.find(
              (message) =>
                message.metadata?.streaming === true && activeStreamMessageIds.has(message.id)
            )
            const replacementMessageId =
              pendingMessageIdForCompletion &&
              currentMessages.some((message) => message.id === pendingMessageIdForCompletion)
                ? pendingMessageIdForCompletion
                : fallbackPendingMessage?.id
            let replacedMessage = false
            const nextMessages = currentMessages.flatMap((message) => {
              if (message.id === completedAssistantMessage.id) {
                if (replacedMessage) return []
                replacedMessage = true
                return [completedAssistantMessage]
              }
              if (replacementMessageId && message.id === replacementMessageId) {
                if (replacedMessage) return []
                replacedMessage = true
                return [completedAssistantMessage]
              }
              return [message]
            })

            return replacedMessage ? nextMessages : [...currentMessages, completedAssistantMessage]
          })
          currentPendingAssistantMessageId = ''
          if (event.data.currentStep) {
            const nextLaunch = activeLaunchRef.current
              ? {
                  ...activeLaunchRef.current,
                  currentStep: event.data.currentStep,
                }
              : null
            if (nextLaunch) {
              activeLaunchRef.current = nextLaunch
            }
            setActiveLaunch((currentLaunch) =>
              currentLaunch && event.data.currentStep
                ? { ...currentLaunch, currentStep: event.data.currentStep }
                : currentLaunch
            )
          }
          showCheckpointWarning(event.data.checkpointWarning)
          applyBackendWorkflowOutput(event.data.output, {
            stepLabel:
              event.data.appendedSection?.heading ??
              readMetadataText(completedAssistantMessage.metadata?.step_label),
          })
          if (event.data.appendedSection && !event.data.output) {
            try {
              const result = await fetchThinkTankWorkflowOutput(streamSessionId)
              if (isCurrentMessageStream()) {
                applyBackendWorkflowOutput(result.output, {
                  stepLabel: event.data.appendedSection.heading,
                })
                showCheckpointWarning(result.checkpointWarning)
              }
            } catch {
              if (isCurrentMessageStream()) {
                setOutputCompletionFeedback('报告草稿已更新，但右侧文稿刷新失败。')
              }
            }
          }
          announceStreamStatus('顾问回复已完成。', { immediate: true })
          setStreamingMessageId(isTerminalCompletedEvent ? null : currentPendingAssistantMessageId)
          applyStreamingScrollBehavior(shouldAutoScroll)
        }
      }
      if (!streamEndedWithTerminalEvent) {
        if (!isCurrentMessageStream()) return
        if (!isDecisionSubmit) {
          setDraft(content)
        }
        setMessageStreamingStatus('error')
        announceStreamStatus('顾问回复生成失败。', { immediate: true })
        setMessageError(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
        setSessionMessages((currentMessages) =>
          currentMessages.filter((message) => !isActiveStreamMessage(message))
        )
        return
      }
      if (override.decisionAction === 'accept-party-mode-conclusion') {
        try {
          const result = await fetchThinkTankWorkflowOutput(streamSessionId)
          if (!isCurrentMessageStream()) return
          const feedback = 'Party Mode 整合结论已写入报告草稿。'
          setWorkflowOutput(result.output)
          setHistoryPreviewOutput(null)
          setHasUnreadDocumentContent(!documentDrawerOpen)
          setOutputCompletionFeedback(feedback)
          setOutputAnnouncement(feedback)
          showCheckpointWarning(result.checkpointWarning)
          announceStreamStatus(feedback, { immediate: true })
        } catch (error) {
          if (!isCurrentMessageStream()) return
          void error
          const feedback = 'Party Mode 整合结论已提交，报告草稿刷新失败。'
          setOutputCompletionFeedback(feedback)
          setOutputAnnouncement(feedback)
          announceStreamStatus(feedback, { immediate: true })
        }
      }
      setSessionMessagesStatus('ready')
      textareaRef.current?.focus({ preventScroll: true })
    } catch (error) {
      if (!isCurrentMessageStream()) return
      if (!isDecisionSubmit) {
        setDraft(content)
      }
      setMessageStreamingStatus('error')
      announceStreamStatus('顾问回复生成失败。', { immediate: true })
      setMessageError(readMessageSubmitErrorMessage(error))
      setSessionMessages((currentMessages) =>
        currentMessages.filter((message) => !isActiveStreamMessage(message))
      )
    } finally {
      const isCurrentStream = streamAbortRef.current === abortController
      if (isCurrentStream) {
        streamAbortRef.current = null
        setIsSubmittingMessage(false)
        setMessageStreamingStatus((current) => (current === 'error' ? 'error' : 'idle'))
        setStreamingMessageId(null)
      }
      if (isCurrentStream || abortController.signal.aborted) {
        messageSubmitInFlightRef.current = false
      }
    }
  }

  const completeFinalWorkflowOutput = async () => {
    const launch = activeLaunchRef.current ?? activeLaunch
    if (
      !launch ||
      launch.status !== 'active' ||
      !isWorkflowReadyForExplicitCompletion(launch) ||
      workflowOutput?.status === 'completed' ||
      isCompletingOutput
    ) {
      return
    }

    setIsCompletingOutput(true)
    try {
      const result = await completeThinkTankSessionOutput(launch.sessionId, {
        outcome: 'success',
      })
      const completedLaunch = { ...launch, status: 'completed' as const }
      activeLaunchRef.current = completedLaunch
      setActiveLaunch(completedLaunch)
      setWorkflowOutput(result.output)
      setHistoryPreviewOutput(null)
      setHasUnreadDocumentContent(!documentDrawerOpen)
      setOutputCompletionFeedback('工作流已完成，报告草稿已归档。')
      setOutputAnnouncement('工作流已完成，报告草稿已归档。')
      showCheckpointWarning(result.checkpointWarning)
      announceStreamStatus('工作流已完成，报告草稿已归档。', { immediate: true })
    } catch (error) {
      setMessageError(readWorkflowErrorMessage(error, '暂时无法完成报告草稿，请稍后重试。'))
      announceStreamStatus('报告草稿完成失败。', { immediate: true })
    } finally {
      setIsCompletingOutput(false)
      textareaRef.current?.focus({ preventScroll: true })
    }
  }

  const syncOutputAssetState = (assetState: ThinkTankOutputAssetState) => {
    setWorkflowOutput((currentOutput) => applyOutputAssetState(currentOutput, assetState))
    setHistoryPreviewOutput((currentOutput) => applyOutputAssetState(currentOutput, assetState))
    setHistoryItems((currentItems) =>
      currentItems.map((item) => applyHistoryAssetState(item, assetState))
    )
  }

  const syncOutputKnowledgeBaseAssociationState = (
    knowledgeBaseAssociation: ThinkTankOutputKnowledgeBaseAssociationState
  ) => {
    setWorkflowOutput((currentOutput) =>
      applyOutputKnowledgeBaseAssociationState(currentOutput, knowledgeBaseAssociation)
    )
    setHistoryPreviewOutput((currentOutput) =>
      applyOutputKnowledgeBaseAssociationState(currentOutput, knowledgeBaseAssociation)
    )
    setHistoryItems((currentItems) =>
      currentItems.map((item) =>
        applyHistoryKnowledgeBaseAssociationState(item, knowledgeBaseAssociation)
      )
    )
  }

  const handleSubmitOutputRating = async (input: ThinkTankOutputRatingInput) => {
    const targetSessionId = documentDrawerOutput?.sessionId ?? activeSessionId
    if (!targetSessionId) {
      throw new Error('暂时无法确认报告所属会话，请重新打开报告后再试。')
    }

    const result = await rateThinkTankSessionOutput(targetSessionId, input)
    syncOutputAssetState(result.assetState)
    setOutputAnnouncement('报告评分已提交。')
  }

  const handleUpdateOutputFavorite = async (input: ThinkTankOutputFavoriteInput) => {
    const targetSessionId = documentDrawerOutput?.sessionId ?? activeSessionId
    if (!targetSessionId) {
      throw new Error('暂时无法确认报告所属会话，请重新打开报告后再试。')
    }

    const result = await updateThinkTankOutputFavorite(targetSessionId, input)
    syncOutputAssetState(result.assetState)
    setOutputAnnouncement(result.assetState.isFavorited ? '报告已收藏。' : '报告已取消收藏。')
  }

  const handleAssociateOutputWithKnowledgeBase = async (
    input: ThinkTankOutputKnowledgeBaseAssociationInput
  ) => {
    const targetSessionId = documentDrawerOutput?.sessionId ?? activeSessionId
    if (!targetSessionId) {
      throw new Error('暂时无法确认报告所属会话，请重新打开报告后再试。')
    }

    const result = await associateThinkTankOutputWithKnowledgeBase(targetSessionId, input)
    syncOutputKnowledgeBaseAssociationState(result.knowledgeBaseAssociation)
    const status = result.knowledgeBaseAssociation.status
    setOutputAnnouncement(
      status === 'associated'
        ? '报告已关联知识库。'
        : status === 'failed'
          ? '知识库关联失败，报告仍保留在 ThinkTank。'
          : '报告已进入知识库待同步状态。'
    )
  }

  const handleExportOutput = async (format: ThinkTankOutputExportFormat) => {
    if (!activeSessionId || outputExportingFormat) return

    const exportSessionId = activeSessionId
    const requestId = outputExportRequestIdRef.current + 1
    outputExportRequestIdRef.current = requestId
    setOutputExportingFormat(format)
    setOutputExportError(null)

    try {
      const result = await downloadThinkTankSessionOutput(exportSessionId, format)
      if (
        activeLaunchRef.current?.sessionId !== exportSessionId ||
        outputExportRequestIdRef.current !== requestId
      ) {
        return
      }
      const label = format === 'markdown' ? 'Markdown' : 'PDF'

      toast.success(`${label} 已导出：${result.fileName}`)
      setOutputAnnouncement(`${label} 报告已导出。`)
    } catch (error) {
      if (
        activeLaunchRef.current?.sessionId !== exportSessionId ||
        outputExportRequestIdRef.current !== requestId
      ) {
        return
      }
      setOutputExportError(readWorkflowErrorMessage(error, THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE))
    } finally {
      if (
        activeLaunchRef.current?.sessionId === exportSessionId &&
        outputExportRequestIdRef.current === requestId
      ) {
        setOutputExportingFormat(null)
      }
      textareaRef.current?.focus({ preventScroll: true })
    }
  }

  const showCheckpointWarning = (warning: ThinkTankCheckpointWarning | undefined) => {
    const message = readThinkTankCheckpointWarningMessage(warning)
    if (!message) return

    setCheckpointWarningMessage(message)
    toast.warning('自动保存检查点暂时不可用', {
      description: message,
    })
  }

  const handleContinueRecoveredSession = () => {
    textareaRef.current?.focus({ preventScroll: true })
  }

  const handleReviewRecoveredDocument = () => {
    setDocumentDrawerOpen(true)
    setHasUnreadDocumentContent(false)
  }

  const handleDecisionOption = (
    option: ThinkTankDecisionOption,
    sourceMessage?: ThinkTankConversationMessage
  ) => {
    if (!option.enabled) return
    const latestDecisionOptions = getLatestDecisionOptions(sessionMessages)
    if (!latestDecisionOptions.some((candidate) => isSameDecisionOption(candidate, option))) {
      return
    }

    if (option.action === 'party-mode') {
      void handleSubmitMessage({
        content: '启动 Party Mode',
        decisionAction: 'party-mode',
        selectedDecisionLabel: option.label,
      })
      textareaRef.current?.focus({ preventScroll: true })
      return
    }

    if (option.action === 'return-to-workflow') {
      void handleSubmitMessage({
        content: '返回原工作流',
        decisionAction: 'return-to-workflow',
        decisionSourceMessageId: sourceMessage?.id,
        selectedDecisionLabel: option.label,
      })
      textareaRef.current?.focus({ preventScroll: true })
      return
    }

    if (option.action === 'retry-party-mode-advisor') {
      void handleSubmitMessage({
        content: option.label,
        decisionAction: 'retry-party-mode-advisor',
        decisionSourceMessageId: sourceMessage?.id,
        selectedDecisionLabel: option.label,
      })
      textareaRef.current?.focus({ preventScroll: true })
      return
    }

    if (option.action === 'continue-party-mode') {
      void handleSubmitMessage({
        content: option.label,
        decisionAction: 'continue-party-mode',
        decisionSourceMessageId: sourceMessage?.id,
        selectedDecisionLabel: option.label,
      })
      textareaRef.current?.focus({ preventScroll: true })
      return
    }

    if (option.action === 'integrate-party-mode') {
      void handleSubmitMessage({
        content: '进入观点整合',
        decisionAction: 'integrate-party-mode',
        decisionSourceMessageId: sourceMessage?.id,
        selectedDecisionLabel: option.label,
      })
      textareaRef.current?.focus({ preventScroll: true })
      return
    }

    if (option.action === 'accept-party-mode-conclusion') {
      void handleSubmitMessage({
        content: '接受整合结论',
        decisionAction: 'accept-party-mode-conclusion',
        decisionSourceMessageId: sourceMessage?.id,
        selectedDecisionLabel: option.label,
      })
      textareaRef.current?.focus({ preventScroll: true })
      return
    }

    setSelectedDecisionLabel(option.label)
    if (option.action === 'continue') {
      void handleSubmitMessage({
        content: option.shortcut ?? option.label,
        decisionAction: 'continue',
        selectedDecisionLabel: option.label,
      })
    }
    textareaRef.current?.focus({ preventScroll: true })
  }

  const handleReplyToExpert = (message: ThinkTankConversationMessage) => {
    const target = readPartyModeReplyTarget(message)
    if (!target) return

    setPartyModeReplyTarget(target)
    setMessageError(null)
    textareaRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!activeLaunch) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (workspaceMode !== 'workflow') return

      const key = event.key.toLowerCase()

      if (event.key === 'Escape') {
        setMessageError(null)
        return
      }

      if (event.altKey || event.ctrlKey || event.metaKey || isTextEditingTarget(event.target)) {
        return
      }

      const option = getLatestDecisionOptions(sessionMessages).find(
        (candidate) => candidate.shortcut?.toLowerCase() === key
      )
      if (!option?.enabled) return

      event.preventDefault()
      handleDecisionOption(option)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeLaunch, sessionMessages, workspaceMode])

  const readingDensityLabel = getAdvisoryReadingDensityLabel(readingDensity)
  const activeWorkflowName = activeLaunch?.workflow.displayName ?? null
  const documentStateSummary = workflowOutput
    ? `报告草稿${workflowOutput.sections.length > 0 ? '已更新' : '已创建'}。`
    : '咨询文档抽屉为空。'
  const advisoryStateSummary = activeLaunch
    ? `ThinkTank 已启用。活动会话：${activeWorkflowName}。当前步骤：${activeLaunch.currentStep.label}。${documentStateSummary}`
    : 'ThinkTank 已启用。暂无活动会话。Quick Consult 已准备。咨询文档抽屉为空。'
  const decisionStateSummary = selectedDecisionLabel ? `已选择：${selectedDecisionLabel}。` : ''
  const workflowStatusSummary =
    workflowCatalogStatus === 'loading'
      ? '正在加载工作流目录。'
      : workflowCatalogStatus === 'error'
        ? '工作流目录加载失败。'
        : `已加载 ${workflows.length} 个工作流。`
  const lazyHiddenMessageCount = Math.max(
    0,
    sessionMessages.length - THINKTANK_MESSAGE_LAZY_RENDER_THRESHOLD
  )
  const visibleSessionMessages =
    lazyHiddenMessageCount > 0 && !showAllMessages
      ? sessionMessages.slice(-THINKTANK_MESSAGE_LAZY_RENDER_THRESHOLD)
      : sessionMessages
  const latestDecisionMessageId = getLatestDecisionMessageId(sessionMessages)
  const isStreamingActive =
    messageStreamingStatus === 'submitting' ||
    messageStreamingStatus === 'streaming' ||
    messageStreamingStatus === 'completing'
  const canSubmitMessage =
    activeLaunch?.status === 'active' && sessionMessagesStatus === 'ready' && !isSubmittingMessage
  const documentDrawerOutput = historyPreviewOutput ?? workflowOutput
  const hasHistoryPreviewOutput = Boolean(historyPreviewOutput)
  const canCompleteWorkflowOutput =
    Boolean(documentDrawerOutput?.sections.length) &&
    activeLaunch?.status === 'active' &&
    isWorkflowReadyForExplicitCompletion(activeLaunch) &&
    !isStreamingActive &&
    !isSubmittingMessage &&
    !isCompletingOutput
  const hasMoreHistoryItems = historyItems.length < historyMeta.total
  const showQuickConsult = workspaceMode === 'quick-consult' || !activeLaunch
  const documentColumnWidth = documentDrawerOpen
    ? typeof documentDrawerWidth === 'number'
      ? `${documentDrawerWidth}px`
      : documentDrawerWidth
    : `${ADVISORY_LAYOUT.documentRailWidth}px`
  const savedOrganizationContext: OrganizationContextSaved | null =
    organizationContext && isOrganizationContextUsable(organizationContext)
      ? organizationContext
      : null

  if (isDesktop === null) {
    return <ViewportCheckingState />
  }

  if (!isDesktop) {
    return <DesktopRequiredState />
  }

  return (
    <section
      className="min-h-[calc(100vh-var(--advisory-nav-height))] bg-[hsl(var(--advisory-shell-bg))] p-4 lg:p-6"
      style={ADVISORY_LAYOUT_STYLE}
    >
      <EnterpriseBackgroundDialog
        open={organizationContextDialogOpen}
        mode={organizationContextDialogMode}
        initialContext={savedOrganizationContext}
        saving={organizationContextStatus === 'saving'}
        error={organizationContextError}
        onOpenChange={handleOrganizationContextDialogOpenChange}
        onSave={handleSaveOrganizationContext}
        onSkip={handleSkipOrganizationContext}
      />
      {pendingLifecycleAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleLifecycleDialogOpenChange(false)
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="thinktank-lifecycle-dialog-title"
            aria-describedby="thinktank-lifecycle-dialog-description"
            className="relative grid w-full max-w-lg gap-4 rounded-sm border border-slate-200 bg-white p-6 shadow-lg"
          >
            <button
              type="button"
              aria-label="Close"
              disabled={lifecycleActionInFlight}
              onClick={() => handleLifecycleDialogOpenChange(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none"
            >
              <span aria-hidden="true">x</span>
              <span className="sr-only">Close</span>
            </button>
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2
                id="thinktank-lifecycle-dialog-title"
                className="text-lg font-semibold leading-none tracking-tight"
              >
                {getLifecycleDialogTitle(pendingLifecycleAction)}
              </h2>
              <p id="thinktank-lifecycle-dialog-description" className="text-sm text-slate-500">
                {getLifecycleDialogDescription(pendingLifecycleAction)}
              </p>
            </div>
            {lifecycleActionError && (
              <p
                role="alert"
                className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-sm leading-6 text-[hsl(var(--destructive))]"
              >
                {lifecycleActionError}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <Button
                ref={lifecycleCancelButtonRef}
                type="button"
                variant="outline"
                disabled={lifecycleActionInFlight}
                onClick={() => handleLifecycleDialogOpenChange(false)}
              >
                继续编辑
              </Button>
              <Button
                type="button"
                variant={pendingLifecycleAction?.type === 'safe-exit' ? 'default' : 'destructive'}
                disabled={lifecycleActionInFlight}
                onClick={() => {
                  void handleConfirmLifecycleAction()
                }}
              >
                {lifecycleActionInFlight
                  ? '处理中'
                  : getLifecycleConfirmLabel(pendingLifecycleAction)}
              </Button>
            </div>
          </div>
        </div>
      )}
      <p
        id={ADVISORY_STATE_SUMMARY_ID}
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 工作台状态"
        className="sr-only"
      >
        {advisoryStateSummary}
        {workflowStatusSummary}
        {decisionStateSummary}
        {launchingWorkflowKey ? '正在启动工作流。' : ''}
        {launchError ? '工作流启动失败。' : ''}
        阅读密度：
        {readingDensityLabel}。
      </p>
      <p
        role="status"
        aria-live="polite"
        aria-label="ThinkTank streaming status"
        className="sr-only"
      >
        {streamAnnouncement}
      </p>
      <p
        role="status"
        aria-live="polite"
        aria-label="ThinkTank step completion status"
        className="sr-only"
      >
        {outputCompletionFeedback ?? ''}
      </p>
      <div
        aria-hidden={pendingLifecycleAction ? true : undefined}
        className={shellGridVariants({ density: readingDensity })}
        style={{
          gridTemplateColumns: `${ADVISORY_LAYOUT.sidebarWidth}px minmax(${ADVISORY_LAYOUT.chatMinWidth}px, 1fr) ${documentColumnWidth}`,
        }}
      >
        <aside
          aria-label="咨询工作流导航"
          className="flex min-w-0 flex-col overflow-y-auto border-r border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))]"
        >
          <div className="border-b border-[hsl(var(--advisory-border))] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[hsl(var(--advisory-foreground))]">
                <BrainCircuit className="h-5 w-5 text-[hsl(var(--advisory-panel))]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[hsl(var(--advisory-foreground))]">
                  ThinkTank
                </p>
                <p className="text-xs text-[hsl(var(--advisory-muted-foreground))]">咨询工作台</p>
              </div>
            </div>
          </div>

          <nav aria-label="咨询工作流" className="flex-1 p-4">
            <button
              ref={quickConsultButtonRef}
              type="button"
              aria-label="Quick Consult"
              aria-pressed={workspaceMode === 'quick-consult'}
              onClick={() => setWorkspaceMode('quick-consult')}
              className={cn(
                'mb-4 flex min-h-14 w-full items-center gap-3 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 text-left text-sm text-[hsl(var(--advisory-foreground))] transition-colors hover:bg-[hsl(var(--advisory-icon-bg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]',
                workspaceMode === 'quick-consult' &&
                  'border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))]'
              )}
            >
              <MessageSquareText className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">Quick Consult</span>
                <span className="mt-1 block text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                  Problem intake
                </span>
              </span>
            </button>
            <section
              role="region"
              aria-label="历史记录"
              className="mb-4 border-b border-[hsl(var(--advisory-border))] pb-4"
            >
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-[hsl(var(--advisory-muted-foreground))]">
                <HistoryIcon className="h-4 w-4" />
                ThinkTank 历史
              </div>
              <form
                role="search"
                aria-label="搜索历史记录"
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSearchHistory()
                }}
              >
                <Input
                  type="search"
                  role="searchbox"
                  aria-label="搜索历史记录"
                  value={historySearchDraft}
                  onChange={(event) => setHistorySearchDraft(event.target.value)}
                  placeholder="搜索历史"
                  className="h-8 rounded-sm bg-[hsl(var(--advisory-panel))] text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Label className="text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                    时间范围
                    <Select
                      value={historyTimeFilter}
                      onValueChange={(value) => setHistoryTimeFilter(value as HistoryTimeFilter)}
                    >
                      <SelectTrigger
                        aria-label="历史时间范围"
                        className="mt-1 h-8 rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-2 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="7d">近7天</SelectItem>
                        <SelectItem value="30d">近30天</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                    类型
                    <Select
                      value={historyTypeFilter}
                      onValueChange={(value) => setHistoryTypeFilter(value as ThinkTankHistoryType)}
                    >
                      <SelectTrigger
                        aria-label="历史类型"
                        className="mt-1 h-8 rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-2 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="session">会话</SelectItem>
                        <SelectItem value="output">报告</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                    工作流
                    <Select value={historyWorkflowFilter} onValueChange={setHistoryWorkflowFilter}>
                      <SelectTrigger
                        aria-label="历史工作流"
                        className="mt-1 h-8 rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-2 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        {workflows.map((workflow) => (
                          <SelectItem key={workflow.key} value={workflow.key}>
                            {workflow.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                    状态
                    <Select
                      value={historyStatusFilter}
                      onValueChange={(value) =>
                        setHistoryStatusFilter(value as ThinkTankHistoryStatus)
                      }
                    >
                      <SelectTrigger
                        aria-label="历史状态"
                        className="mt-1 h-8 rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-2 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="active">进行中</SelectItem>
                        <SelectItem value="paused">已暂停</SelectItem>
                        <SelectItem value="completed">已完成</SelectItem>
                        <SelectItem value="draft">草稿</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-sm px-3 text-xs"
                >
                  <Search className="h-3.5 w-3.5" />
                  搜索历史
                </Button>
              </form>
              <div className="mt-3">
                {historyStatus === 'loading' && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]"
                  >
                    正在加载历史记录
                  </div>
                )}
                {historyStatus === 'error' && historyError && (
                  <p
                    role="alert"
                    className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--destructive))]"
                  >
                    {historyError}
                  </p>
                )}
                {historyStatus === 'ready' && historyItems.length === 0 && (
                  <div
                    role="status"
                    aria-label="ThinkTank 历史空状态"
                    className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]"
                  >
                    <p className="font-medium text-[hsl(var(--advisory-foreground))]">
                      暂无历史记录
                    </p>
                    <p className="mt-1">从 Quick Consult 开始第一次咨询后，历史会显示在这里。</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openFirstConsult}
                      className="mt-3 h-8 rounded-sm px-3 text-xs"
                    >
                      开始第一次咨询
                    </Button>
                  </div>
                )}
                {historyItems.length > 0 && (
                  <ul className="space-y-2">
                    {historyItems.map((item) => {
                      const itemKey = getHistoryItemKey(item)
                      const isOpening = openingHistoryItemKey === itemKey
                      const isActive = activeLaunch?.sessionId === item.sessionId
                      const canDeleteHistoryItem =
                        item.resultType === 'output' ||
                        item.status === 'active' ||
                        item.status === 'paused'

                      return (
                        <li key={itemKey} className="relative">
                          <button
                            type="button"
                            aria-label={getHistoryActionLabel(item)}
                            aria-pressed={isActive && workspaceMode === 'workflow'}
                            disabled={Boolean(openingHistoryItemKey) || Boolean(resumingSessionId)}
                            onClick={() => {
                              void handleOpenHistoryItem(item)
                            }}
                            className={cn(
                              'flex min-h-24 w-full flex-col gap-2 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 pr-11 text-left text-xs text-[hsl(var(--advisory-foreground))] transition-colors hover:bg-[hsl(var(--advisory-icon-bg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-60',
                              isActive &&
                                workspaceMode === 'workflow' &&
                                'border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))]'
                            )}
                          >
                            <span className="flex w-full items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {item.title}
                                </span>
                                <span className="mt-1 block truncate text-[11px] text-[hsl(var(--advisory-muted-foreground))]">
                                  {item.workflowType}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[hsl(var(--advisory-muted-foreground))]">
                                <FileText className="h-3 w-3" />
                                {getHistoryResultTypeLabel(item)}
                              </span>
                            </span>
                            <span className="line-clamp-2 text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                              {item.summary}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                              <Clock3 className="h-3 w-3" />
                              <span>{getHistoryStatusLabel(item.status)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatSessionActivityTime(item.timestamp)}</span>
                              {item.assetState?.isFavorited && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>已收藏</span>
                                </>
                              )}
                              {item.knowledgeBaseAssociation?.status && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {item.knowledgeBaseAssociation.status === 'associated'
                                      ? '已关联知识库'
                                      : item.knowledgeBaseAssociation.status === 'failed'
                                        ? '知识库关联失败'
                                        : '知识库待同步'}
                                  </span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span>{isOpening ? '打开中' : isActive ? '已打开' : '打开'}</span>
                            </span>
                          </button>
                          {canDeleteHistoryItem && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={
                                item.resultType === 'output'
                                  ? `删除报告 ${item.title}`
                                  : `删除会话 ${item.title}`
                              }
                              title={item.resultType === 'output' ? '删除报告' : '删除会话'}
                              disabled={
                                Boolean(openingHistoryItemKey) ||
                                Boolean(resumingSessionId) ||
                                lifecycleActionInFlight
                              }
                              onClick={() =>
                                openLifecycleDialog(
                                  item.resultType === 'output' && item.outputId
                                    ? {
                                        type: 'output-delete',
                                        sessionId: item.sessionId,
                                        outputId: item.outputId,
                                        title: item.title,
                                      }
                                    : {
                                        type: 'session-delete',
                                        sessionId: item.sessionId,
                                        title: item.title,
                                      }
                                )
                              }
                              className="absolute right-2 top-2 h-7 w-7 rounded-sm text-[hsl(var(--destructive))]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {hasMoreHistoryItems && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyLoadingMore}
                    onClick={() => {
                      void handleLoadMoreHistory()
                    }}
                    className="mt-2 h-8 w-full rounded-sm px-3 text-xs"
                  >
                    {historyLoadingMore ? '加载中' : '加载更多历史'}
                  </Button>
                )}
              </div>
            </section>
            {(unfinishedSessionsStatus === 'loading' ||
              unfinishedSessions.length > 0 ||
              resumeError) && (
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-[hsl(var(--advisory-muted-foreground))]">
                  <RotateCcw className="h-4 w-4" />
                  未完成会话
                </div>
                {unfinishedSessionsStatus === 'loading' && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]"
                  >
                    正在加载未完成会话
                  </div>
                )}
                {unfinishedSessionsStatus === 'error' && unfinishedSessionsError && (
                  <p
                    role="alert"
                    className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--destructive))]"
                  >
                    {unfinishedSessionsError}
                  </p>
                )}
                {unfinishedSessions.length > 0 && (
                  <ul className="space-y-2">
                    {unfinishedSessions.map((sessionCard) => {
                      const isResuming = resumingSessionId === sessionCard.sessionId
                      const isActive = activeLaunch?.sessionId === sessionCard.sessionId

                      return (
                        <li key={sessionCard.sessionId} className="relative">
                          <button
                            type="button"
                            aria-label={`继续 ${sessionCard.title}`}
                            aria-pressed={isActive && workspaceMode === 'workflow'}
                            disabled={Boolean(resumingSessionId)}
                            onClick={() => {
                              void handleResumeSession(sessionCard.sessionId)
                            }}
                            className={cn(
                              'flex min-h-24 w-full flex-col gap-2 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 pr-11 text-left text-xs text-[hsl(var(--advisory-foreground))] transition-colors hover:bg-[hsl(var(--advisory-icon-bg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-60',
                              isActive &&
                                workspaceMode === 'workflow' &&
                                'border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))]'
                            )}
                          >
                            <span className="flex w-full items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {sessionCard.title}
                                </span>
                                <span className="mt-1 block truncate text-[11px] text-[hsl(var(--advisory-muted-foreground))]">
                                  {sessionCard.workflowType}
                                </span>
                              </span>
                              <span className="shrink-0 text-[11px] font-medium text-[hsl(var(--advisory-muted-foreground))]">
                                {isResuming ? '恢复中' : isActive ? '已打开' : '继续'}
                              </span>
                            </span>
                            <span className="block text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                              {sessionCard.lastStep.label}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
                              <Clock3 className="h-3 w-3" />
                              <span>{sessionCard.statusSummary}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatSessionActivityTime(sessionCard.lastActivityAt)}</span>
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`移除会话 ${sessionCard.title}`}
                            title="移除会话"
                            disabled={Boolean(resumingSessionId) || lifecycleActionInFlight}
                            onClick={() =>
                              openLifecycleDialog({
                                type: 'session-delete',
                                sessionId: sessionCard.sessionId,
                                title: sessionCard.title,
                              })
                            }
                            className="absolute right-2 top-2 h-7 w-7 rounded-sm text-[hsl(var(--destructive))]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {resumeError && (
                  <p
                    role="alert"
                    className="mt-2 rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--destructive))]"
                  >
                    {resumeError}
                  </p>
                )}
              </div>
            )}
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase text-[hsl(var(--advisory-muted-foreground))]">
              <Workflow className="h-4 w-4" />
              工作流
            </div>
            {workflowCatalogStatus === 'loading' && (
              <div className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-4 text-sm leading-6 text-[hsl(var(--advisory-muted-foreground))]">
                正在加载工作流目录
              </div>
            )}
            {workflowCatalogStatus === 'error' && (
              <div
                role="alert"
                className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-4 text-sm leading-6 text-[hsl(var(--destructive))]"
              >
                {catalogError ?? WORKFLOW_CATALOG_ERROR_MESSAGE}
              </div>
            )}
            {workflowCatalogStatus === 'ready' && (
              <ul className="space-y-2">
                {workflows.map((workflow) => {
                  const isActive = activeLaunch?.workflow.key === workflow.key
                  const isLaunching = launchingWorkflowKey === workflow.key
                  const isDisabled =
                    Boolean(launchingWorkflowKey) || (Boolean(activeLaunch) && !isActive)

                  return (
                    <li key={workflow.key}>
                      <button
                        type="button"
                        aria-label={`${isActive ? '查看' : '启动'} ${workflow.displayName}（${workflow.scenarioLabel}）`}
                        aria-pressed={isActive && workspaceMode === 'workflow'}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isActive) {
                            setWorkspaceMode('workflow')
                            return
                          }
                          void handleLaunchWorkflow(workflow.key)
                        }}
                        className={cn(
                          'flex min-h-16 w-full items-start justify-between gap-3 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-3 text-left text-sm text-[hsl(var(--advisory-foreground))] transition-colors hover:bg-[hsl(var(--advisory-icon-bg))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-60',
                          isActive &&
                            workspaceMode === 'workflow' &&
                            'border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))]'
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium">{workflow.displayName}</span>
                          <span className="mt-1 block text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                            {workflow.scenarioLabel}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-[hsl(var(--advisory-muted-foreground))]">
                          {isLaunching ? '启动中' : isActive ? '查看' : '启动'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {launchError && (
              <p
                role="alert"
                className="mt-3 rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--destructive))]"
              >
                {launchError}
              </p>
            )}
          </nav>

          <div className="border-t border-[hsl(var(--advisory-border))] p-4 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
            {activeLaunch ? `活动会话：${activeLaunch.workflow.displayName}` : '暂无活动会话'}
          </div>
        </aside>

        <section
          aria-label="咨询对话工作区"
          data-reading-density={readingDensity}
          className="flex min-w-0 flex-col overflow-hidden bg-[hsl(var(--advisory-panel))]"
        >
          <div className="border-b border-[hsl(var(--advisory-border))] px-6 py-4">
            <div className="flex min-h-14 items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-[hsl(var(--advisory-foreground))]">
                  ThinkTank
                </h1>
                <p className="mt-1 text-sm text-[hsl(var(--advisory-muted-foreground))]">
                  桌面咨询工作台
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  aria-label="企业背景设置"
                  title="企业背景设置"
                  disabled={organizationContextStatus === 'loading'}
                  onClick={handleOpenOrganizationSettings}
                  className="h-9 rounded-sm px-3 text-xs"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  企业背景设置
                </Button>
                <ReadingDensityControl
                  value={readingDensity}
                  onChange={handleReadingDensityChange}
                />
                <div className="rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] px-3 py-1 text-xs font-medium text-[hsl(var(--advisory-success-foreground))]">
                  已启用
                </div>
              </div>
            </div>
          </div>

          {showQuickConsult ? (
            <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
              <QuickConsultProblemIntake
                userIdentity={userPreferenceIdentity}
                onBeforeStartQuickConsult={requestOrganizationContextGate}
                onOpenEnterpriseBackgroundSettings={handleOpenOrganizationSettings}
                onAcceptRecommendation={handleLaunchWorkflow}
              />
            </div>
          ) : activeLaunch ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={conversationScrollRef}
                role="region"
                aria-label="咨询消息列表"
                className="flex-1 overflow-y-auto p-6"
                onScroll={() => {
                  if (isConversationNearBottom()) {
                    setHasUnreadStreamContent(false)
                  }
                }}
              >
                <div
                  ref={conversationFocusRef}
                  tabIndex={-1}
                  className={cn(
                    activePromptSurfaceVariants({ density: readingDensity }),
                    'focus:outline-none'
                  )}
                >
                  <ol
                    role="list"
                    aria-label="工作流当前步骤"
                    className="mb-5 flex items-center gap-2"
                  >
                    <li className="flex min-h-9 items-center gap-2 rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] px-3 text-xs font-medium text-[hsl(var(--advisory-success-foreground))]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--advisory-success-foreground))] text-[10px] text-[hsl(var(--advisory-success-bg))]">
                        {activeLaunch.currentStep.index}
                      </span>
                      <span>{activeLaunch.currentStep.label}</span>
                    </li>
                  </ol>
                  <div className="space-y-4">
                    <article
                      aria-label={`${activeLaunch.workflow.displayName} 首个提示`}
                      className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] p-5"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[hsl(var(--advisory-icon-bg))]">
                            <MessageSquareText className="h-5 w-5 text-[hsl(var(--advisory-foreground))]" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-[hsl(var(--advisory-foreground))]">
                              {activeLaunch.workflow.displayName}
                            </h2>
                            <p className="truncate text-xs text-[hsl(var(--advisory-muted-foreground))]">
                              {activeLaunch.workflow.scenarioLabel}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label="安全退出工作流"
                          onClick={() =>
                            openLifecycleDialog({
                              type: 'safe-exit',
                              sessionId: activeLaunch.sessionId,
                              title: activeLaunch.workflow.displayName,
                            })
                          }
                          className="h-8 shrink-0 rounded-sm px-3 text-xs"
                        >
                          <LogOut className="h-4 w-4" />
                          安全退出
                        </Button>
                      </div>
                      <div className="whitespace-pre-wrap text-[length:inherit] leading-[inherit] text-[hsl(var(--advisory-foreground))]">
                        {getPublicLaunchPrompt(activeLaunch)}
                      </div>
                    </article>

                    {recoveryMessage && (
                      <article
                        aria-label="ThinkTank 会话恢复摘要"
                        className="rounded-sm border border-[hsl(var(--advisory-success-border))] bg-[hsl(var(--advisory-success-bg))] p-5 text-[hsl(var(--advisory-success-foreground))]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[hsl(var(--advisory-panel))] text-[hsl(var(--advisory-foreground))]">
                            <RotateCcw className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-base font-semibold">{recoveryMessage.title}</h2>
                            <p className="mt-2 whitespace-pre-wrap text-[length:inherit] leading-[inherit]">
                              {recoveryMessage.content}
                            </p>
                            {recoveryMessage.keyConclusions.length > 0 && (
                              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
                                {recoveryMessage.keyConclusions.map((conclusion) => (
                                  <li key={conclusion}>{conclusion}</li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {recoveryMessage.actions.map((action) => (
                                <Button
                                  key={action.key}
                                  type="button"
                                  variant={action.key === 'continue' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={
                                    action.key === 'continue'
                                      ? handleContinueRecoveredSession
                                      : handleReviewRecoveredDocument
                                  }
                                  className="h-8 rounded-sm px-3 text-xs"
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </article>
                    )}

                    {sessionMessagesStatus === 'loading' && (
                      <div
                        role="status"
                        aria-live="polite"
                        aria-label="ThinkTank 会话消息加载状态"
                        className="rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-4 py-3 text-sm text-[hsl(var(--advisory-muted-foreground))]"
                      >
                        正在加载会话消息
                      </div>
                    )}

                    {sessionMessagesStatus === 'error' && messageError && (
                      <p
                        role="alert"
                        className="rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-4 py-3 text-sm text-[hsl(var(--destructive))]"
                      >
                        {messageError}
                      </p>
                    )}

                    {lazyHiddenMessageCount > 0 && !showAllMessages && (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`显示较早 ${lazyHiddenMessageCount} 条消息`}
                          onClick={() => setShowAllMessages(true)}
                          className="h-8 rounded-sm px-3 text-xs"
                        >
                          显示较早 {lazyHiddenMessageCount} 条消息
                        </Button>
                      </div>
                    )}

                    {visibleSessionMessages.map((message) => (
                      <AdvisoryChatMessage
                        key={message.id}
                        message={message}
                        isStreaming={isStreamingActive && message.id === streamingMessageId}
                        decisionOptionsAreCurrent={message.id === latestDecisionMessageId}
                        onDecisionOption={handleDecisionOption}
                        onReplyToExpert={handleReplyToExpert}
                      />
                    ))}
                  </div>
                </div>
                {hasUnreadStreamContent && (
                  <div className="sticky bottom-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="查看新回复"
                      onClick={scrollConversationToBottom}
                      className="h-8 rounded-sm bg-[hsl(var(--advisory-panel))] px-3 text-xs shadow-sm"
                    >
                      查看新回复
                    </Button>
                  </div>
                )}
              </div>

              <form
                aria-label="发送 ThinkTank 回答"
                className="border-t border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] px-6 py-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSubmitMessage()
                }}
              >
                <div className="mx-auto max-w-5xl">
                  {partyModeReplyTarget && (
                    <div
                      role="status"
                      aria-live="polite"
                      aria-label="当前回复对象"
                      className="mb-2 flex items-center justify-between gap-3 rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs text-[hsl(var(--advisory-foreground))]"
                    >
                      <span className="min-w-0 truncate">
                        回复 {partyModeReplyTarget.advisorName}，{partyModeReplyTarget.advisorRole}
                        {partyModeReplyTarget.round ? `，第 ${partyModeReplyTarget.round} 轮` : ''}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="取消专家回复对象"
                        onClick={() => setPartyModeReplyTarget(null)}
                        className="h-6 shrink-0 rounded-sm px-2 text-xs"
                      >
                        取消
                      </Button>
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <Textarea
                      ref={textareaRef}
                      aria-label="输入你的回答"
                      value={draft}
                      maxLength={THINKTANK_MESSAGE_MAX_LENGTH}
                      placeholder="输入你的回答"
                      disabled={isSubmittingMessage}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void handleSubmitMessage()
                        }
                      }}
                      className="min-h-[52px] max-h-[200px] resize-none rounded-sm border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] text-[length:inherit] leading-6 text-[hsl(var(--advisory-foreground))]"
                    />
                    <Button
                      type="submit"
                      disabled={!canSubmitMessage || draft.trim().length === 0}
                      title="提交回答"
                      className="h-[52px] shrink-0 rounded-sm px-4"
                    >
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      {isSubmittingMessage ? '发送中' : '发送'}
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[hsl(var(--advisory-muted-foreground))]">
                    <span>快捷键：Enter 提交，Shift+Enter 换行</span>
                    <span>
                      {draft.length}/{THINKTANK_MESSAGE_MAX_LENGTH}
                    </span>
                  </div>
                  {messageError && sessionMessagesStatus !== 'error' && (
                    <p
                      role="alert"
                      className="mt-2 rounded-sm border border-[hsl(var(--destructive))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--destructive))]"
                    >
                      {messageError}
                    </p>
                  )}
                  {checkpointWarningMessage && (
                    <p
                      role="status"
                      aria-live="polite"
                      aria-label="ThinkTank checkpoint warning"
                      className="mt-2 rounded-sm border border-[hsl(var(--advisory-warning-border))] bg-[hsl(var(--advisory-panel))] px-3 py-2 text-xs leading-5 text-[hsl(var(--advisory-foreground))]"
                    >
                      {checkpointWarningMessage}
                    </p>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              <div className={cn(readingSurfaceVariants({ density: readingDensity }))}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-[hsl(var(--advisory-icon-bg))]">
                  <MessageSquareText className="h-6 w-6 text-[hsl(var(--advisory-foreground))]" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-[hsl(var(--advisory-foreground))]">
                  等待开始咨询
                </h2>
                <p className="mt-2 text-[length:inherit] leading-[inherit] text-[hsl(var(--advisory-muted-foreground))]">
                  选择一个工作流后，对话将在这里开始。
                </p>
                <Separator className="my-5" />
                <p className="text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
                  暂无咨询内容。
                </p>
              </div>
            </div>
          )}
        </section>

        <AdvisoryDocumentDrawer
          open={documentDrawerOpen}
          width={documentDrawerWidth}
          output={documentDrawerOutput}
          hasNewContent={hasHistoryPreviewOutput ? false : hasUnreadDocumentContent}
          completionFeedback={hasHistoryPreviewOutput ? undefined : outputCompletionFeedback}
          liveAnnouncement={outputAnnouncement}
          conversationInputRef={textareaRef}
          exportingFormat={hasHistoryPreviewOutput ? null : outputExportingFormat}
          completingOutput={isCompletingOutput}
          exportError={hasHistoryPreviewOutput ? null : outputExportError}
          onOpenChange={(open) => {
            setDocumentDrawerOpen(open)
            if (!open) {
              setHistoryPreviewOutput(null)
            }
          }}
          onWidthChange={setDocumentDrawerWidth}
          onClearNewContent={() => setHasUnreadDocumentContent(false)}
          onExportOutput={hasHistoryPreviewOutput ? undefined : handleExportOutput}
          onCompleteOutput={
            hasHistoryPreviewOutput ||
            documentDrawerOutput?.status === 'completed' ||
            !canCompleteWorkflowOutput
              ? undefined
              : completeFinalWorkflowOutput
          }
          onDismissExportError={() => setOutputExportError(null)}
          onSubmitOutputRating={handleSubmitOutputRating}
          onUpdateOutputFavorite={handleUpdateOutputFavorite}
          onAssociateOutputWithKnowledgeBase={handleAssociateOutputWithKnowledgeBase}
        />
      </div>
    </section>
  )
}
