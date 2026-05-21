'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { cva } from 'class-variance-authority'
import { BrainCircuit, MessageSquareText, SendHorizontal, Settings, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AdvisoryChatMessage } from '@/components/advisory/AdvisoryChatMessage'
import { AdvisoryDocumentDrawer } from '@/components/advisory/AdvisoryDocumentDrawer'
import { EnterpriseBackgroundDialog } from '@/components/advisory/EnterpriseBackgroundDialog'
import { QuickConsultProblemIntake } from '@/components/advisory/QuickConsultProblemIntake'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
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
  type ThinkTankWorkflowLaunchResult,
  type ThinkTankWorkflowLaunchOptions,
} from '@/lib/advisory/workflows'
import {
  THINKTANK_STREAM_ERROR_MESSAGE,
  streamThinkTankSessionMessage,
} from '@/lib/advisory/streaming'
import {
  THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE,
  THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE,
  appendThinkTankWorkflowOutputSection,
  completeThinkTankSessionOutput,
  downloadThinkTankSessionOutput,
  fetchThinkTankWorkflowOutput,
  type ThinkTankOutputExportFormat,
  type ThinkTankWorkflowOutput,
} from '@/lib/advisory/outputs'
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
const THINKTANK_SCROLL_BOTTOM_TOLERANCE_PX = 48
const THINKTANK_STREAM_ANNOUNCEMENT_THROTTLE_MS = 1000

type WorkflowCatalogStatus = 'loading' | 'ready' | 'error'
type SessionMessagesStatus = 'idle' | 'loading' | 'ready' | 'error'
type MessageStreamingStatus = 'idle' | 'submitting' | 'streaming' | 'completing' | 'error'
type WorkspaceMode = 'quick-consult' | 'workflow'
type OrganizationContextStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error'

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

function getLatestDecisionOptions(
  messages: ThinkTankConversationMessage[]
): ThinkTankDecisionOption[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'assistant' && message.decisionOptions?.length) {
      return message.decisionOptions
    }
  }

  return []
}

function readProviderMetadata(message: ThinkTankConversationMessage): Record<string, unknown> {
  const metadata = message.providerMetadata ?? {}

  return {
    provider: metadata.provider,
    model: metadata.model,
    latencyMs: metadata.latencyMs ?? metadata.latency_ms,
    inputTokens: metadata.inputTokens ?? metadata.input_tokens,
    outputTokens: metadata.outputTokens ?? metadata.output_tokens,
    totalTokens: metadata.totalTokens ?? metadata.total_tokens,
    estimatedCost: metadata.estimatedCost ?? metadata.estimated_cost,
    cacheStatus: metadata.cacheStatus ?? metadata.cache_status,
    cacheStrategy: metadata.cacheStrategy ?? metadata.cache_strategy,
    cacheKey: metadata.cacheKey ?? metadata.cache_key,
    cacheBypassReason: metadata.cacheBypassReason ?? metadata.cache_bypass_reason,
    cacheReadInputTokens: metadata.cacheReadInputTokens ?? metadata.cache_read_input_tokens,
    cacheCreationInputTokens:
      metadata.cacheCreationInputTokens ?? metadata.cache_creation_input_tokens,
    cachedInputTokens: metadata.cachedInputTokens ?? metadata.cached_input_tokens,
    cacheEligibleInputTokens:
      metadata.cacheEligibleInputTokens ?? metadata.cache_eligible_input_tokens,
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
  const [readingDensity, setReadingDensity] = useState<AdvisoryReadingDensity>(
    DEFAULT_ADVISORY_READING_DENSITY
  )
  const [workflowCatalogStatus, setWorkflowCatalogStatus] =
    useState<WorkflowCatalogStatus>('loading')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('quick-consult')
  const [workflows, setWorkflows] = useState<ThinkTankWorkflowCatalogItem[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [launchingWorkflowKey, setLaunchingWorkflowKey] = useState<string | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [activeLaunch, setActiveLaunch] = useState<ThinkTankWorkflowLaunchResult | null>(null)
  const [sessionMessagesStatus, setSessionMessagesStatus] = useState<SessionMessagesStatus>('idle')
  const [sessionMessages, setSessionMessages] = useState<ThinkTankConversationMessage[]>([])
  const [messageError, setMessageError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false)
  const [messageStreamingStatus, setMessageStreamingStatus] =
    useState<MessageStreamingStatus>('idle')
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamAnnouncement, setStreamAnnouncement] = useState('')
  const [hasUnreadStreamContent, setHasUnreadStreamContent] = useState(false)
  const [showAllMessages, setShowAllMessages] = useState(false)
  const [selectedDecisionLabel, setSelectedDecisionLabel] = useState<string | null>(null)
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false)
  const [documentDrawerWidth, setDocumentDrawerWidth] = useState<number | string>(
    ADVISORY_LAYOUT.drawerDefaultWidth
  )
  const [workflowOutput, setWorkflowOutput] = useState<ThinkTankWorkflowOutput | null>(null)
  const [hasUnreadDocumentContent, setHasUnreadDocumentContent] = useState(false)
  const [outputAnnouncement, setOutputAnnouncement] = useState('')
  const [outputCompletionFeedback, setOutputCompletionFeedback] = useState<string | undefined>()
  const [outputExportingFormat, setOutputExportingFormat] =
    useState<ThinkTankOutputExportFormat | null>(null)
  const [outputExportError, setOutputExportError] = useState<string | null>(null)
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const conversationFocusRef = useRef<HTMLDivElement>(null)
  const conversationScrollRef = useRef<HTMLDivElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const messageSubmitInFlightRef = useRef(false)
  const appendedOutputSourceMessageIdsRef = useRef<Set<string>>(new Set())
  const outputExportRequestIdRef = useRef(0)
  const lastStreamAnnouncementAtRef = useRef(0)
  const pendingStreamAnnouncementRef = useRef<number | null>(null)
  const activeSessionId = activeLaunch?.sessionId ?? null

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
      setMessageStreamingStatus('idle')
      setStreamingMessageId(null)
      setStreamAnnouncement('')
      setHasUnreadStreamContent(false)
      setShowAllMessages(false)
      setSelectedDecisionLabel(null)
      setDocumentDrawerOpen(false)
      setWorkflowOutput(null)
      setHasUnreadDocumentContent(false)
      setOutputAnnouncement('')
      setOutputCompletionFeedback(undefined)
      setOutputExportingFormat(null)
      setOutputExportError(null)
      outputExportRequestIdRef.current += 1
      appendedOutputSourceMessageIdsRef.current.clear()
      setDraft(readStoredDraft(userPreferenceIdentity, launch.sessionId))
      setWorkspaceMode('workflow')
      setActiveLaunch(launch)
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
      setHasUnreadDocumentContent(false)
      setOutputCompletionFeedback(undefined)
      setOutputExportingFormat(null)
      setOutputExportError(null)
      outputExportRequestIdRef.current += 1
      appendedOutputSourceMessageIdsRef.current.clear()
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

    let isCancelled = false

    fetchThinkTankWorkflowOutput(activeSessionId)
      .then((result) => {
        if (isCancelled) return
        setWorkflowOutput(result.output)
        setHasUnreadDocumentContent(false)
      })
      .catch(() => {
        if (isCancelled) return
        setWorkflowOutput(null)
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

  const appendAssistantOutputSection = async (
    assistantMessage: ThinkTankConversationMessage,
    currentStep = activeLaunch?.currentStep
  ): Promise<ThinkTankWorkflowOutput | null> => {
    if (!activeLaunch || !currentStep || !assistantMessage.content.trim()) return null
    if (appendedOutputSourceMessageIdsRef.current.has(assistantMessage.id)) {
      textareaRef.current?.focus({ preventScroll: true })
      return workflowOutput
    }

    const stepLabel = currentStep.label || `Step ${currentStep.index}`
    const feedback = `${stepLabel}已完成，报告草稿已更新。`

    try {
      const result = await appendThinkTankWorkflowOutputSection(activeLaunch.sessionId, {
        stepIndex: currentStep.index,
        stepLabel,
        contentMarkdown: assistantMessage.content,
        sourceMessageId: assistantMessage.id,
        providerMetadata: readProviderMetadata(assistantMessage),
        aiLabelMetadata: {
          label: 'AI Generated',
          visibleLabel: '[AI Generated]',
        },
      })
      appendedOutputSourceMessageIdsRef.current.add(assistantMessage.id)
      setWorkflowOutput(result.output)
      setHasUnreadDocumentContent(!documentDrawerOpen)
      setOutputCompletionFeedback(feedback)
      setOutputAnnouncement(`已完成：${stepLabel}，报告草稿已更新。`)
      announceStreamStatus(feedback, { immediate: true })
      textareaRef.current?.focus({ preventScroll: true })
      return result.output
    } catch (error) {
      setMessageError(readWorkflowErrorMessage(error, THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE))
      announceStreamStatus('报告草稿更新失败。', { immediate: true })
      return null
    }
  }

  const handleSubmitMessage = async () => {
    if (
      !activeLaunch ||
      sessionMessagesStatus !== 'ready' ||
      isSubmittingMessage ||
      messageSubmitInFlightRef.current
    ) {
      return
    }

    const content = draft.trim()
    if (!content) {
      setMessageError(THINKTANK_EMPTY_MESSAGE_MESSAGE)
      return
    }
    if (content.length > THINKTANK_MESSAGE_MAX_LENGTH) {
      setMessageError('内容过长，请精简到 5000 字符以内。')
      return
    }

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
    let receivedDeltaCount = 0
    let streamEndedWithTerminalEvent = false
    const shouldAutoScrollOnSubmit = isConversationNearBottom()

    messageSubmitInFlightRef.current = true
    streamAbortRef.current?.abort()
    streamAbortRef.current = abortController
    setMessageError(null)
    setSelectedDecisionLabel(null)
    setIsSubmittingMessage(true)
    setMessageStreamingStatus('submitting')
    setStreamingMessageId(assistantMessageId)
    announceStreamStatus('ThinkTank 顾问正在准备回复。', { immediate: true })
    setHasUnreadStreamContent(false)
    setDraft('')
    setSessionMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      pendingAssistantMessage,
    ])
    applyStreamingScrollBehavior(shouldAutoScrollOnSubmit)

    try {
      for await (const event of streamThinkTankSessionMessage(
        activeLaunch.sessionId,
        { content },
        { signal: abortController.signal }
      )) {
        const shouldAutoScroll = isConversationNearBottom()

        if (event.event === 'message.started') {
          setMessageStreamingStatus('streaming')
          announceStreamStatus('正在生成顾问回复。', { immediate: true })
          continue
        }

        if (event.event === 'message.delta') {
          receivedDeltaCount += 1
          setMessageStreamingStatus('streaming')
          setSessionMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantMessageId
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
          setMessageStreamingStatus('error')
          setMessageError(event.data.message)
          announceStreamStatus('顾问回复生成失败。', { immediate: true })
          setSessionMessages((currentMessages) => [
            ...currentMessages.filter((message) => message.id !== assistantMessageId),
            {
              id: `stream-error-${Date.now()}`,
              role: 'system',
              content: event.data.message,
              workflowKey: activeLaunch.workflow.key,
              stepIndex: activeLaunch.currentStep.index,
            },
          ])
          applyStreamingScrollBehavior(shouldAutoScroll)
          return
        }

        if (event.event === 'message.completed') {
          streamEndedWithTerminalEvent = true
          setMessageStreamingStatus('completing')
          const completedAssistantMessage = {
            ...event.data.assistantMessage,
            decisionOptions:
              (event.data.assistantMessage.decisionOptions?.length ?? 0) > 0
                ? event.data.assistantMessage.decisionOptions
                : (event.data.decisionOptions ?? []),
          }
          setSessionMessages((currentMessages) => {
            const foundPendingMessage = currentMessages.some(
              (message) => message.id === assistantMessageId
            )
            if (!foundPendingMessage) {
              return [...currentMessages, completedAssistantMessage]
            }

            return currentMessages.map((message) =>
              message.id === assistantMessageId ? completedAssistantMessage : message
            )
          })
          if (event.data.currentStep) {
            setActiveLaunch((currentLaunch) =>
              currentLaunch
                ? (() => {
                    const nextLaunch = {
                      ...currentLaunch,
                      currentStep: event.data.currentStep ?? currentLaunch.currentStep,
                    }
                    activeLaunchRef.current = nextLaunch
                    return nextLaunch
                  })()
                : currentLaunch
            )
          }
          announceStreamStatus('顾问回复已完成。', { immediate: true })
          setStreamingMessageId(null)
          applyStreamingScrollBehavior(shouldAutoScroll)
        }
      }
      if (!streamEndedWithTerminalEvent) {
        setDraft(content)
        setMessageStreamingStatus('error')
        announceStreamStatus('顾问回复生成失败。', { immediate: true })
        setMessageError(THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
        setSessionMessages((currentMessages) =>
          currentMessages.filter(
            (message) => message.id !== userMessage.id && message.id !== assistantMessageId
          )
        )
        return
      }
      setSessionMessagesStatus('ready')
      textareaRef.current?.focus({ preventScroll: true })
    } catch (error) {
      setDraft(content)
      setMessageStreamingStatus('error')
      announceStreamStatus('顾问回复生成失败。', { immediate: true })
      setMessageError(readMessageSubmitErrorMessage(error))
      setSessionMessages((currentMessages) =>
        currentMessages.filter(
          (message) => message.id !== userMessage.id && message.id !== assistantMessageId
        )
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

  const findLatestAssistantMessage = () => {
    for (let index = sessionMessages.length - 1; index >= 0; index -= 1) {
      const message = sessionMessages[index]
      if (message.role === 'assistant') return message
    }

    return null
  }

  const isFinalWorkflowStep = (step: ThinkTankWorkflowLaunchResult['currentStep']) => {
    const metadata = step as typeof step & {
      isFinal?: boolean
      isFinalStep?: boolean
      final?: boolean
      totalSteps?: number
    }

    return (
      metadata.isFinal === true ||
      metadata.isFinalStep === true ||
      metadata.final === true ||
      (typeof metadata.totalSteps === 'number' && metadata.index >= metadata.totalSteps)
    )
  }

  const completeFinalWorkflowOutput = async () => {
    if (!activeLaunch) return

    try {
      const result = await completeThinkTankSessionOutput(activeLaunch.sessionId, {
        outcome: 'success',
      })
      setWorkflowOutput(result.output)
      setHasUnreadDocumentContent(!documentDrawerOpen)
      setOutputCompletionFeedback('工作流已完成，报告草稿已归档。')
      setOutputAnnouncement('工作流已完成，报告草稿已归档。')
      announceStreamStatus('工作流已完成，报告草稿已归档。', { immediate: true })
    } catch (error) {
      setMessageError(readWorkflowErrorMessage(error, '暂时无法完成报告草稿，请稍后重试。'))
      announceStreamStatus('报告草稿完成失败。', { immediate: true })
    } finally {
      textareaRef.current?.focus({ preventScroll: true })
    }
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

  const handleDecisionOption = (option: ThinkTankDecisionOption) => {
    if (!option.enabled) return

    setSelectedDecisionLabel(option.label)
    if (option.action === 'continue') {
      const latestAssistantMessage = findLatestAssistantMessage()
      if (latestAssistantMessage) {
        void appendAssistantOutputSection(latestAssistantMessage, activeLaunch?.currentStep).then(
          (output) => {
            if (
              output &&
              activeLaunch?.currentStep &&
              isFinalWorkflowStep(activeLaunch.currentStep)
            ) {
              void completeFinalWorkflowOutput()
            }
          }
        )
      }
    }
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
  const isStreamingActive =
    messageStreamingStatus === 'submitting' ||
    messageStreamingStatus === 'streaming' ||
    messageStreamingStatus === 'completing'
  const canSubmitMessage = sessionMessagesStatus === 'ready' && !isSubmittingMessage
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
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[hsl(var(--advisory-icon-bg))]">
                          <MessageSquareText className="h-5 w-5 text-[hsl(var(--advisory-foreground))]" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-[hsl(var(--advisory-foreground))]">
                            {activeLaunch.workflow.displayName}
                          </h2>
                          <p className="text-xs text-[hsl(var(--advisory-muted-foreground))]">
                            {activeLaunch.workflow.scenarioLabel}
                          </p>
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap text-[length:inherit] leading-[inherit] text-[hsl(var(--advisory-foreground))]">
                        {activeLaunch.firstPrompt}
                      </div>
                    </article>

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
                        onDecisionOption={handleDecisionOption}
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
          output={workflowOutput}
          hasNewContent={hasUnreadDocumentContent}
          completionFeedback={outputCompletionFeedback}
          liveAnnouncement={outputAnnouncement}
          conversationInputRef={textareaRef}
          exportingFormat={outputExportingFormat}
          exportError={outputExportError}
          onOpenChange={setDocumentDrawerOpen}
          onWidthChange={setDocumentDrawerWidth}
          onClearNewContent={() => setHasUnreadDocumentContent(false)}
          onExportOutput={handleExportOutput}
          onDismissExportError={() => setOutputExportError(null)}
        />
      </div>
    </section>
  )
}
