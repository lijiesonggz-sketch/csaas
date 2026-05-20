import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType, RefObject } from 'react'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'

type Story28OutputSection = {
  id: string
  stepIndex: number
  heading: string
  contentMarkdown: string
  aiLabel: '[AI Generated]'
  metadata: {
    workflowKey: string
    stepLabel: string
    provider: string
    model: string
    generatedAt: string
  }
  createdAt: string
}

type Story28WorkflowOutput = {
  id: string
  status: 'draft' | 'completed'
  title: string
  summary: string
  contentMarkdown: string
  sections: Story28OutputSection[]
  aiLabelMetadata: {
    label: 'AI Generated'
    visibleLabel: '[AI Generated]'
    generator: string
    provider: string
    model: string
    generatedAt: string
    workflowKey: string
    sessionId: string
  }
  metadata: {
    sectionCount: number
    lastStepIndex: number
  }
}

type Story28DrawerProps = {
  open: boolean
  width?: number | string
  output: Story28WorkflowOutput | null
  hasNewContent: boolean
  completionFeedback?: string
  liveAnnouncement?: string
  conversationInputRef?: RefObject<HTMLTextAreaElement>
  onOpenChange: (open: boolean) => void
  onWidthChange?: (width: number) => void
  onClearNewContent?: () => void
}

function loadDocumentDrawer(): ComponentType<Story28DrawerProps> {
  return (
    jest.requireActual('@/components/advisory/AdvisoryDocumentDrawer') as {
      AdvisoryDocumentDrawer: ComponentType<Story28DrawerProps>
    }
  ).AdvisoryDocumentDrawer
}

function createStory28Section(overrides: Partial<Story28OutputSection> = {}): Story28OutputSection {
  return {
    id: 'section-opportunity',
    stepIndex: 1,
    heading: '1. 机会梳理',
    contentMarkdown: '企业客户预算触发点来自合规整改窗口。',
    aiLabel: '[AI Generated]',
    metadata: {
      workflowKey: 'brainstorming',
      stepLabel: '机会梳理',
      provider: 'openai',
      model: 'gpt-4o-mini',
      generatedAt: '2026-05-20T07:44:42+08:00',
    },
    createdAt: '2026-05-20T07:44:42+08:00',
    ...overrides,
  }
}

function createStory28Output(
  sections: Story28OutputSection[] = [createStory28Section()]
): Story28WorkflowOutput {
  const lastSection = sections[sections.length - 1] ?? createStory28Section()

  return {
    id: 'output-brainstorming',
    status: 'draft',
    title: 'Brainstorming 决策报告草稿',
    summary: '已生成阶段性决策草稿。',
    contentMarkdown: sections.map((section) => section.contentMarkdown).join('\n\n'),
    sections,
    aiLabelMetadata: {
      label: 'AI Generated',
      visibleLabel: '[AI Generated]',
      generator: 'ThinkTank',
      provider: lastSection.metadata.provider,
      model: lastSection.metadata.model,
      generatedAt: lastSection.metadata.generatedAt,
      workflowKey: lastSection.metadata.workflowKey,
      sessionId: 'session-brainstorming',
    },
    metadata: {
      sectionCount: sections.length,
      lastStepIndex: lastSection.stepIndex,
    },
  }
}

function renderDrawer(overrides: Partial<Story28DrawerProps> = {}) {
  const AdvisoryDocumentDrawer = loadDocumentDrawer()
  const conversationInput = document.createElement('textarea')
  conversationInput.setAttribute('aria-label', '输入你的回答')
  document.body.appendChild(conversationInput)

  const onOpenChange = jest.fn()
  const onWidthChange = jest.fn()
  const onClearNewContent = jest.fn()
  const props: Story28DrawerProps = {
    open: true,
    width: ADVISORY_LAYOUT.drawerDefaultWidth,
    output: createStory28Output(),
    hasNewContent: false,
    completionFeedback: undefined,
    liveAnnouncement: undefined,
    conversationInputRef: { current: conversationInput },
    onOpenChange,
    onWidthChange,
    onClearNewContent,
    ...overrides,
  }

  const view = render(<AdvisoryDocumentDrawer {...props} />)

  return {
    ...view,
    props,
    conversationInput,
    onOpenChange,
    onWidthChange,
    onClearNewContent,
  }
}

function firePointerEventWithClientX(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number
) {
  const event = new Event(type, { bubbles: true, cancelable: true })

  Object.defineProperties(event, {
    clientX: { value: clientX },
    pageX: { value: clientX },
    pointerId: { value: 1 },
  })

  fireEvent(target, event)
}

describe('AdvisoryDocumentDrawer Story 2.8 ATDD RED', () => {
  afterEach(() => {
    document.body.querySelectorAll('textarea[aria-label="输入你的回答"]').forEach((node) => {
      node.remove()
    })
    jest.restoreAllMocks()
  })

  test('[P0] shows collapsed right-edge trigger with a new-content hint and opens the latest draft', async () => {
    const user = userEvent.setup()
    const { onOpenChange, onClearNewContent } = renderDrawer({
      open: false,
      hasNewContent: true,
      output: createStory28Output([
        createStory28Section({
          id: 'section-latest',
          stepIndex: 2,
          heading: '2. 方案收敛',
          contentMarkdown: '建议优先验证企业客户的预算触发点。',
        }),
      ]),
    })

    const trigger = screen.getByRole('button', { name: /打开咨询文档抽屉.*新报告内容/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('title', expect.stringMatching(/咨询文档|报告草稿/))

    const hint = screen.getByRole('status', { name: '咨询文档新内容提示' })
    expect(hint).toHaveAttribute('aria-live', 'polite')
    expect(hint).toHaveTextContent('新的报告章节已生成')

    await user.click(trigger)

    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(onClearNewContent).toHaveBeenCalledTimes(1)
  })

  test('[P0] renders the latest generated section with visible AI label and metadata summary', () => {
    const output = createStory28Output([
      createStory28Section(),
      createStory28Section({
        id: 'section-solution',
        stepIndex: 2,
        heading: '2. 方案收敛',
        contentMarkdown: '建议优先验证企业客户的预算触发点。\n\n- 验证预算窗口\n- 记录关键风险',
        metadata: {
          workflowKey: 'brainstorming',
          stepLabel: '方案收敛',
          provider: 'openai',
          model: 'gpt-4o-mini',
          generatedAt: '2026-05-20T08:00:00+08:00',
        },
      }),
    ])

    renderDrawer({ open: true, output })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(
      within(drawer).getByRole('heading', { name: 'Brainstorming 决策报告草稿' })
    ).toBeVisible()
    expect(within(drawer).getByRole('heading', { name: '2. 方案收敛' })).toBeVisible()
    expect(within(drawer).getByText('建议优先验证企业客户的预算触发点。')).toBeVisible()
    expect(within(drawer).getAllByText('[AI Generated]').length).toBeGreaterThan(0)
    expect(within(drawer).getByText(/ThinkTank/)).toBeVisible()
    expect(within(drawer).getByText(/Brainstorming|brainstorming/)).toBeVisible()
    expect(within(drawer).getByText(/gpt-4o-mini/)).toBeVisible()
    expect(within(drawer).getByText(/Step 2|步骤 2/)).toBeVisible()
    expect(within(drawer).queryByText('报告草稿接入后开放')).not.toBeInTheDocument()
  })

  test('[P0] scrolls to an appended section without stealing conversation input focus and announces completion', async () => {
    const scrollIntoView = jest.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView
    const firstSection = createStory28Section()
    const nextSection = createStory28Section({
      id: 'section-solution',
      stepIndex: 2,
      heading: '2. 方案收敛',
      contentMarkdown: '第二步报告内容已经写入草稿。',
    })

    try {
      const { conversationInput, props, rerender } = renderDrawer({
        open: true,
        output: createStory28Output([firstSection]),
      })
      const AdvisoryDocumentDrawer = loadDocumentDrawer()

      conversationInput.focus()
      rerender(
        <AdvisoryDocumentDrawer
          {...props}
          output={createStory28Output([firstSection, nextSection])}
          liveAnnouncement="已完成：方案收敛，报告草稿已更新。"
          completionFeedback="方案收敛已完成，报告草稿已更新。"
        />
      )

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
      expect(conversationInput).toHaveFocus()
      expect(screen.getByRole('status', { name: 'ThinkTank 输出草稿更新状态' })).toHaveTextContent(
        '已完成：方案收敛，报告草稿已更新。'
      )
      expect(screen.getByText('方案收敛已完成，报告草稿已更新。')).toBeVisible()
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  test('[P1] closes with Escape and toggles with Ctrl+D while preserving draft input focus', () => {
    const { conversationInput, onOpenChange, props, rerender } = renderDrawer({ open: true })
    const AdvisoryDocumentDrawer = loadDocumentDrawer()

    conversationInput.value = 'Keep this draft.'
    conversationInput.focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(conversationInput).toHaveFocus()
    expect(conversationInput).toHaveValue('Keep this draft.')

    onOpenChange.mockClear()
    rerender(<AdvisoryDocumentDrawer {...props} open={false} />)
    fireEvent.keyDown(document, { key: 'd', ctrlKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(conversationInput).toHaveFocus()
  })

  test('[P1] exposes stable resize semantics and clamps drawer width to 320px through 50vw', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1440,
    })
    const { onWidthChange } = renderDrawer({
      open: true,
      width: ADVISORY_LAYOUT.drawerDefaultWidth,
    })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(drawer).toHaveStyle(`width: ${ADVISORY_LAYOUT.drawerDefaultWidth}`)
    expect(drawer).toHaveStyle(`min-width: ${ADVISORY_LAYOUT.drawerMinWidth}px`)
    expect(drawer).toHaveStyle(`max-width: ${ADVISORY_LAYOUT.drawerMaxWidth}`)

    const resizeHandle = screen.getByRole('separator', { name: '调整咨询文档抽屉宽度' })
    expect(resizeHandle).toHaveAttribute('aria-valuemin', String(ADVISORY_LAYOUT.drawerMinWidth))
    expect(resizeHandle).toHaveAttribute(
      'aria-valuemax',
      String(Math.round(window.innerWidth * 0.5))
    )

    firePointerEventWithClientX(resizeHandle, 'pointerdown', 1000)
    firePointerEventWithClientX(window, 'pointermove', 0)
    expect(onWidthChange).toHaveBeenCalledWith(720)

    firePointerEventWithClientX(window, 'pointermove', 1300)
    expect(onWidthChange).toHaveBeenLastCalledWith(ADVISORY_LAYOUT.drawerMinWidth)
    firePointerEventWithClientX(window, 'pointerup', 1300)
  })

  test('[P2] renders an empty report draft state before the first generated section', () => {
    renderDrawer({ open: true, output: null, hasNewContent: false })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(within(drawer).getByRole('heading', { name: '报告草稿' })).toBeVisible()
    expect(within(drawer).getByText('完成工作流步骤后，报告章节会显示在这里。')).toBeVisible()
    expect(within(drawer).queryByText('[AI Generated]')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('报告草稿接入后开放')).not.toBeInTheDocument()
  })
})
