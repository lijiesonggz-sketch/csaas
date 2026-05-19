'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BrainCircuit,
  FileText,
  MessageSquareText,
  PanelRightOpen,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const DESKTOP_QUERY = '(min-width: 1024px)'
const ADVISORY_STATE_SUMMARY_ID = 'advisory-state-summary'
const DOCUMENT_DRAWER_DESCRIPTION_ID = 'advisory-document-drawer-disabled-description'

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

    const mediaQuery = window.matchMedia(DESKTOP_QUERY)
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
    <section className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#FEFDFB] px-6 py-10">
      <div
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 工作区准备状态"
        className="text-sm font-medium text-[#1E3A5F]"
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
    <section className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#FEFDFB] px-6 py-10">
      <div
        ref={statusRef}
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 桌面端要求"
        tabIndex={-1}
        className="max-w-xl rounded-sm border border-[#E2E8F0] bg-white p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#EEF4F9]">
            <BrainCircuit className="h-5 w-5 text-[#1E3A5F]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1E3A5F]">
              ThinkTank MVP 当前需要桌面端宽屏使用
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#64748B]">
              请在宽度不小于 1024px 的桌面浏览器中打开，以保持咨询导航、对话区和文档抽屉的稳定布局。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AdvisoryWorkspaceShell() {
  const isDesktop = useDesktopViewport()

  if (isDesktop === null) {
    return <ViewportCheckingState />
  }

  if (!isDesktop) {
    return <DesktopRequiredState />
  }

  return (
    <section className="min-h-[calc(100vh-64px)] bg-[#FEFDFB] p-4 lg:p-6">
      <p
        id={ADVISORY_STATE_SUMMARY_ID}
        role="status"
        aria-live="polite"
        aria-label="ThinkTank 工作台状态"
        className="sr-only"
      >
        ThinkTank 已启用。暂无活动会话。等待开始咨询。咨询文档抽屉为空。
      </p>
      <div className="grid h-[calc(100vh-112px)] min-h-[560px] grid-cols-[260px_minmax(0,1fr)_64px] overflow-hidden rounded-sm border border-[#E2E8F0] bg-white shadow-sm">
        <aside
          aria-label="咨询工作流导航"
          className="flex min-w-0 flex-col overflow-y-auto border-r border-[#E2E8F0] bg-[#F8FAFC]"
        >
          <div className="border-b border-[#E2E8F0] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#1E3A5F]">
                <BrainCircuit className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1E3A5F]">ThinkTank</p>
                <p className="text-xs text-[#64748B]">咨询工作台</p>
              </div>
            </div>
          </div>

          <nav aria-label="咨询工作流" className="flex-1 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase text-[#64748B]">
              <Workflow className="h-4 w-4" />
              工作流
            </div>
            <ul className="space-y-2">
              {['结构化咨询', '研究分析', '问题解决'].map((label) => (
                <li
                  key={label}
                  aria-label={`${label} 待接入`}
                  className="flex h-10 items-center justify-between rounded-sm border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E3A5F]"
                >
                  <span>{label}</span>
                  <span className="text-xs text-[#64748B]">待接入</span>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-[#E2E8F0] p-4 text-xs leading-5 text-[#64748B]">
            暂无活动会话
          </div>
        </aside>

        <section
          aria-label="咨询对话工作区"
          className="flex min-w-0 flex-col overflow-hidden bg-white"
        >
          <div className="border-b border-[#E2E8F0] px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-[#1E3A5F]">ThinkTank</h1>
                <p className="mt-1 text-sm text-[#64748B]">桌面咨询工作台</p>
              </div>
              <div className="rounded-sm border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-1 text-xs font-medium text-[#047857]">
                已启用
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
            <div className="max-w-lg text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-[#EEF4F9]">
                <MessageSquareText className="h-6 w-6 text-[#1E3A5F]" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[#1E3A5F]">等待开始咨询</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">
                选择一个工作流后，对话将在这里开始。
              </p>
              <Separator className="my-5" />
              <p className="text-xs leading-5 text-[#64748B]">
                工作流选择、AI 引导、流式响应和报告生成将在后续 Story 中接入。
              </p>
            </div>
          </div>
        </section>

        <aside
          aria-label="咨询文档抽屉"
          aria-describedby={DOCUMENT_DRAWER_DESCRIPTION_ID}
          className="flex min-w-0 flex-col items-center border-l border-[#E2E8F0] bg-[#F8FAFC] px-2 py-4"
        >
          <p id={DOCUMENT_DRAWER_DESCRIPTION_ID} className="sr-only">
            文档抽屉将在报告草稿接入后开放
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="展开咨询文档抽屉"
            aria-describedby={DOCUMENT_DRAWER_DESCRIPTION_ID}
            title="文档抽屉将在报告草稿接入后开放"
            className="text-[#1E3A5F]"
            disabled
          >
            <PanelRightOpen className="h-5 w-5" />
          </Button>
          <div className="mt-4 flex flex-col items-center gap-2 text-[#64748B]">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium [writing-mode:vertical-rl]">文档</span>
            <span className="text-xs font-medium [writing-mode:vertical-rl]">暂无文档</span>
            <span className="sr-only">文档抽屉将在报告草稿接入后开放</span>
          </div>
          <p className="mt-4 max-w-11 text-center text-[10px] leading-4 text-[#64748B]">
            报告草稿接入后开放
          </p>
        </aside>
      </div>
    </section>
  )
}
