import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType, RefObject } from 'react'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'

type ExportFormat = 'markdown' | 'pdf'

type Story29Section = {
  id: string
  stepIndex: number
  heading: string
  contentMarkdown: string
  aiLabel: '[AI Generated]'
  metadata: Record<string, unknown>
  createdAt: string
}

type Story29Output = {
  id: string
  status: 'draft' | 'completed'
  title: string
  summary: string
  contentMarkdown: string
  sections: Story29Section[]
  aiLabelMetadata: Record<string, unknown>
  metadata: Record<string, unknown>
}

type Story29DrawerProps = {
  open: boolean
  width?: number | string
  output: Story29Output | null
  hasNewContent: boolean
  completionFeedback?: string
  liveAnnouncement?: string
  conversationInputRef?: RefObject<HTMLTextAreaElement>
  exportingFormat?: ExportFormat | null
  exportError?: string | null
  onExportOutput?: (format: ExportFormat) => Promise<void> | void
  onDismissExportError?: () => void
  onOpenChange: (open: boolean) => void
  onWidthChange?: (width: number) => void
  onClearNewContent?: () => void
}

function loadDocumentDrawer(): ComponentType<Story29DrawerProps> {
  return (
    jest.requireActual('@/components/advisory/AdvisoryDocumentDrawer') as {
      AdvisoryDocumentDrawer: ComponentType<Story29DrawerProps>
    }
  ).AdvisoryDocumentDrawer
}

function createSection(overrides: Partial<Story29Section> = {}): Story29Section {
  return {
    id: 'section-1',
    stepIndex: 1,
    heading: '1. 诊断与机会',
    contentMarkdown: '[AI Generated]\n\n优先验证企业客户预算触发点。',
    aiLabel: '[AI Generated]',
    metadata: {
      workflow_key: 'problem-solving',
      step_label: '诊断与机会',
      provider: 'openai',
      model: 'gpt-4o-mini',
      generated_at: '2026-05-20T03:00:00.000Z',
    },
    createdAt: '2026-05-20T03:00:00.000Z',
    ...overrides,
  }
}

function createOutput(sections: Story29Section[] = [createSection()]): Story29Output {
  return {
    id: 'output-1',
    status: 'draft',
    title: 'Problem Solving Report Draft',
    summary: 'Live report draft for the problem-solving workflow.',
    contentMarkdown: sections.map((section) => section.contentMarkdown).join('\n\n'),
    sections,
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      ai_generated: true,
      machine_readable: true,
      workflow_key: 'problem-solving',
    },
    metadata: { section_count: sections.length },
  }
}

function renderDrawer(overrides: Partial<Story29DrawerProps> = {}) {
  const AdvisoryDocumentDrawer = loadDocumentDrawer()
  const conversationInput = document.createElement('textarea')
  conversationInput.setAttribute('aria-label', '输入你的回答')
  document.body.appendChild(conversationInput)

  const props: Story29DrawerProps = {
    open: true,
    width: ADVISORY_LAYOUT.drawerDefaultWidth,
    output: createOutput(),
    hasNewContent: false,
    conversationInputRef: { current: conversationInput },
    exportingFormat: null,
    exportError: null,
    onExportOutput: jest.fn(),
    onDismissExportError: jest.fn(),
    onOpenChange: jest.fn(),
    onWidthChange: jest.fn(),
    onClearNewContent: jest.fn(),
    ...overrides,
  }

  return {
    ...render(<AdvisoryDocumentDrawer {...props} />),
    props,
    conversationInput,
  }
}

describe('AdvisoryDocumentDrawer Story 2.9 export controls (ATDD RED)', () => {
  afterEach(() => {
    document.body.querySelectorAll('textarea[aria-label="输入你的回答"]').forEach((node) => {
      node.remove()
    })
    jest.restoreAllMocks()
  })

  test('[P0] renders compact Markdown and PDF export buttons only when a report section exists', () => {
    renderDrawer()

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(
      within(drawer).getByRole('button', { name: /导出 Markdown|下载 Markdown/i })
    ).toBeEnabled()
    expect(within(drawer).getByRole('button', { name: /导出 PDF|下载 PDF/i })).toBeEnabled()
    expect(within(drawer).getAllByText('[AI Generated]').length).toBeGreaterThan(0)
  })

  test('[P0] disables export actions for empty reports and while an export is running', () => {
    const { rerender, props } = renderDrawer({ output: createOutput([]) })
    const AdvisoryDocumentDrawer = loadDocumentDrawer()

    expect(screen.getByRole('button', { name: /导出 Markdown|下载 Markdown/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /导出 PDF|下载 PDF/i })).toBeDisabled()

    rerender(<AdvisoryDocumentDrawer {...props} output={createOutput()} exportingFormat="pdf" />)
    expect(screen.getByRole('button', { name: /导出 Markdown|下载 Markdown/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /导出 PDF|下载 PDF/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /导出 PDF|下载 PDF/i })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })

  test('[P0] invokes the export handler without closing the drawer or stealing conversation focus', async () => {
    const user = userEvent.setup()
    const onExportOutput = jest.fn().mockResolvedValue(undefined)
    const { conversationInput } = renderDrawer({ onExportOutput })

    conversationInput.focus()
    await user.click(screen.getByRole('button', { name: /导出 Markdown|下载 Markdown/i }))

    await waitFor(() => expect(onExportOutput).toHaveBeenCalledWith('markdown'))
    expect(screen.getByRole('complementary', { name: '咨询文档抽屉' })).toBeVisible()
    expect(conversationInput).toHaveFocus()
  })

  test('[P1] shows persistent recoverable export errors with next-step guidance', () => {
    renderDrawer({ exportError: '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('报告导出失败')
    expect(alert).toHaveTextContent(/重试|检查网络|联系管理员/)
    expect(within(alert).getByRole('button', { name: /关闭|隐藏/ })).toBeVisible()
  })

  test('[P1] keeps workflow completion feedback and decision state visible after a successful export', async () => {
    const user = userEvent.setup()
    const onExportOutput = jest.fn().mockResolvedValue(undefined)
    renderDrawer({
      completionFeedback: '方案收敛已完成，报告草稿已更新。',
      liveAnnouncement: '已完成：方案收敛，报告草稿已更新。',
      onExportOutput,
    })

    await user.click(screen.getByRole('button', { name: /导出 PDF|下载 PDF/i }))

    await waitFor(() => expect(onExportOutput).toHaveBeenCalledWith('pdf'))
    expect(screen.getByText('方案收敛已完成，报告草稿已更新。')).toBeVisible()
    expect(screen.getByRole('status', { name: 'ThinkTank 输出草稿更新状态' })).toHaveTextContent(
      '已完成：方案收敛，报告草稿已更新。'
    )
  })
})
