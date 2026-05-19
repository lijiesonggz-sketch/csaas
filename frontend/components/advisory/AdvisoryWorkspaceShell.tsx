'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { cva } from 'class-variance-authority'
import { BrainCircuit, FileText, MessageSquareText, PanelRightOpen, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
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
import { cn } from '@/lib/utils'

const ADVISORY_STATE_SUMMARY_ID = 'advisory-state-summary'
const DOCUMENT_DRAWER_DESCRIPTION_ID = 'advisory-document-drawer-disabled-description'

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
  const [readingDensity, setReadingDensity] = useState<AdvisoryReadingDensity>(
    DEFAULT_ADVISORY_READING_DENSITY
  )

  useEffect(() => {
    setReadingDensity(readAdvisoryPreferences(userPreferenceIdentity).readingDensity)
  }, [userPreferenceIdentity])

  const handleReadingDensityChange = (nextDensity: AdvisoryReadingDensity) => {
    setReadingDensity(nextDensity)
    writeAdvisoryPreferences(userPreferenceIdentity, { readingDensity: nextDensity })
  }

  const readingDensityLabel = getAdvisoryReadingDensityLabel(readingDensity)

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
      <p
        id={ADVISORY_STATE_SUMMARY_ID}
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 工作台状态"
        className="sr-only"
      >
        ThinkTank 已启用。暂无活动会话。等待开始咨询。咨询文档抽屉为空。阅读密度：
        {readingDensityLabel}。
      </p>
      <div className={shellGridVariants({ density: readingDensity })}>
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
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase text-[hsl(var(--advisory-muted-foreground))]">
              <Workflow className="h-4 w-4" />
              工作流
            </div>
            <ul className="space-y-2">
              {['结构化咨询', '研究分析', '问题解决'].map((label) => (
                <li
                  key={label}
                  aria-label={`${label} 待接入`}
                  className="flex h-10 items-center justify-between rounded-sm border border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-panel))] px-3 text-sm text-[hsl(var(--advisory-foreground))]"
                >
                  <span>{label}</span>
                  <span className="text-xs text-[hsl(var(--advisory-muted-foreground))]">
                    待接入
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-[hsl(var(--advisory-border))] p-4 text-xs leading-5 text-[hsl(var(--advisory-muted-foreground))]">
            暂无活动会话
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
                工作流选择、AI 引导、流式响应和报告生成将在后续 Story 中接入。
              </p>
            </div>
          </div>
        </section>

        <aside
          aria-label="咨询文档抽屉"
          aria-describedby={DOCUMENT_DRAWER_DESCRIPTION_ID}
          className="flex min-w-0 flex-col items-center border-l border-[hsl(var(--advisory-border))] bg-[hsl(var(--advisory-muted-bg))] px-2 py-4"
        >
          <p id={DOCUMENT_DRAWER_DESCRIPTION_ID} className="sr-only">
            文档抽屉将在报告草稿接入后开放
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="展开咨询文档抽屉"
            aria-disabled="true"
            aria-describedby={DOCUMENT_DRAWER_DESCRIPTION_ID}
            title="文档抽屉将在报告草稿接入后开放"
            className="text-[hsl(var(--advisory-foreground))] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={(event) => event.preventDefault()}
          >
            <PanelRightOpen className="h-5 w-5" />
          </Button>
          <div className="mt-4 flex flex-col items-center gap-2 text-[hsl(var(--advisory-muted-foreground))]">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium [writing-mode:vertical-rl]">文档</span>
            <span className="text-xs font-medium [writing-mode:vertical-rl]">暂无文档</span>
            <span className="sr-only">文档抽屉将在报告草稿接入后开放</span>
          </div>
          <p className="mt-4 max-w-11 text-center text-[10px] leading-4 text-[hsl(var(--advisory-muted-foreground))]">
            报告草稿接入后开放
          </p>
        </aside>
      </div>
    </section>
  )
}
