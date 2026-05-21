import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdvisoryDocumentDrawer } from './AdvisoryDocumentDrawer'
import { ADVISORY_LAYOUT } from '@/lib/advisory/layout'

function createOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'output-1',
    sessionId: 'session-1',
    workflowKey: 'problem-solving',
    status: 'completed',
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    contentMarkdown: '# Retention Diagnosis',
    sections: [
      {
        id: 'section-1',
        stepIndex: 1,
        heading: 'Diagnose retention',
        contentMarkdown: '[AI Generated]\n\nUsers drop after setup.',
        aiLabel: '[AI Generated]',
        metadata: {},
        createdAt: '2026-05-21T05:10:00.000Z',
      },
    ],
    aiLabelMetadata: {
      visible_label: '[AI Generated]',
      generator: 'ThinkTank',
    },
    metadata: {},
    knowledgeBaseAssociation: {
      outputId: 'output-1',
      status: null,
      destinationKey: null,
      externalReferenceId: null,
      message: null,
      retryCount: 0,
      updatedAt: null,
      associatedAt: null,
    },
    ...overrides,
  }
}

function renderDrawer(overrides: Record<string, unknown> = {}) {
  const onAssociateOutputWithKnowledgeBase = jest.fn().mockResolvedValue(undefined)
  const conversationInput = document.createElement('textarea')
  document.body.appendChild(conversationInput)
  const Drawer = AdvisoryDocumentDrawer as unknown as (
    props: Record<string, unknown>
  ) => JSX.Element

  const view = render(
    <Drawer
      open
      width={ADVISORY_LAYOUT.drawerDefaultWidth}
      output={createOutput()}
      hasNewContent={false}
      conversationInputRef={{ current: conversationInput }}
      onOpenChange={jest.fn()}
      onAssociateOutputWithKnowledgeBase={onAssociateOutputWithKnowledgeBase}
      {...overrides}
    />
  )

  return {
    ...view,
    onAssociateOutputWithKnowledgeBase,
  }
}

describe('AdvisoryDocumentDrawer knowledge-base association', () => {
  afterEach(() => {
    document.body.querySelectorAll('textarea').forEach((node) => node.remove())
    jest.restoreAllMocks()
  })

  test('[P0][4.5-FE-007][AC1] saves the current report artifact to enterprise knowledge base', async () => {
    const user = userEvent.setup()
    const { onAssociateOutputWithKnowledgeBase } = renderDrawer()
    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })

    await user.click(within(drawer).getByRole('button', { name: '保存到知识库' }))

    await waitFor(() =>
      expect(onAssociateOutputWithKnowledgeBase).toHaveBeenCalledWith({
        outputId: 'output-1',
      })
    )
  })

  test('[P0][4.5-FE-008][AC2] shows retry copy when association is pending or failed', () => {
    renderDrawer({
      output: createOutput({
        knowledgeBaseAssociation: {
          outputId: 'output-1',
          status: 'failed',
          destinationKey: 'enterprise-knowledge-base',
          externalReferenceId: null,
          message: '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。',
          retryCount: 2,
          updatedAt: '2026-05-21T08:00:00.000Z',
          associatedAt: null,
        },
      }),
    })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(within(drawer).getByText(/关联失败/)).toBeVisible()
    expect(
      within(drawer).getByText('知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。')
    ).toBeVisible()
    expect(within(drawer).getByRole('button', { name: '重试保存' })).toBeVisible()
  })

  test('[P1][4.5-FE-009][AC3] shows associated status without exposing raw report content', () => {
    renderDrawer({
      output: createOutput({
        knowledgeBaseAssociation: {
          outputId: 'output-1',
          status: 'associated',
          destinationKey: 'enterprise-knowledge-base',
          externalReferenceId: 'kb-ref-1',
          message: null,
          retryCount: 1,
          updatedAt: '2026-05-21T08:05:00.000Z',
          associatedAt: '2026-05-21T08:05:00.000Z',
        },
      }),
    })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(within(drawer).getByText(/已关联/)).toBeVisible()
    expect(
      within(drawer).queryByText(/rawPrompt|contentMarkdown|raw section/)
    ).not.toBeInTheDocument()
  })

  test('[P0][4.5-FE-010][AC1] disables knowledge-base save for an empty draft', () => {
    renderDrawer({
      output: createOutput({
        status: 'draft',
        contentMarkdown: '',
        sections: [],
      }),
    })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(within(drawer).getByRole('button', { name: '保存到知识库' })).toBeDisabled()
  })

  test('[P0][4.5-FE-011][AC2] does not apply stale knowledge-base mutation feedback after switching outputs', async () => {
    const user = userEvent.setup()
    let resolveMutation: () => void = () => undefined
    const onAssociateOutputWithKnowledgeBase = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve
        })
    )
    const conversationInput = document.createElement('textarea')
    document.body.appendChild(conversationInput)
    const Drawer = AdvisoryDocumentDrawer as unknown as (
      props: Record<string, unknown>
    ) => JSX.Element
    const baseProps = {
      open: true,
      width: ADVISORY_LAYOUT.drawerDefaultWidth,
      hasNewContent: false,
      conversationInputRef: { current: conversationInput },
      onOpenChange: jest.fn(),
      onAssociateOutputWithKnowledgeBase,
    }

    const { rerender } = render(<Drawer {...baseProps} output={createOutput({ id: 'output-1' })} />)
    await user.click(screen.getByRole('button', { name: '保存到知识库' }))
    rerender(<Drawer {...baseProps} output={createOutput({ id: 'output-2' })} />)

    resolveMutation()

    await waitFor(() => expect(screen.queryByText('知识库关联状态已更新')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '保存到知识库' })).not.toBeDisabled()
  })
})
