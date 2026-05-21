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
      provider: 'fake',
      model: 'fake-thinktank-model',
    },
    metadata: {},
    assetState: {
      outputId: 'output-1',
      rating: null,
      feedbackTextPresent: false,
      isFavorited: false,
      updatedAt: null,
    },
    ...overrides,
  }
}

function renderDrawer(overrides: Record<string, unknown> = {}) {
  const onOpenChange = jest.fn()
  const onSubmitOutputRating = jest.fn().mockResolvedValue(undefined)
  const onUpdateOutputFavorite = jest.fn().mockResolvedValue(undefined)
  const conversationInput = document.createElement('textarea')
  document.body.appendChild(conversationInput)

  const view = render(
    <AdvisoryDocumentDrawer
      open
      width={ADVISORY_LAYOUT.drawerDefaultWidth}
      output={createOutput() as never}
      hasNewContent={false}
      conversationInputRef={{ current: conversationInput }}
      onOpenChange={onOpenChange}
      onSubmitOutputRating={onSubmitOutputRating}
      onUpdateOutputFavorite={onUpdateOutputFavorite}
      {...overrides}
    />
  )

  return {
    ...view,
    conversationInput,
    onOpenChange,
    onSubmitOutputRating,
    onUpdateOutputFavorite,
  }
}

describe('AdvisoryDocumentDrawer rating and favorites', () => {
  afterEach(() => {
    document.body.querySelectorAll('textarea').forEach((node) => node.remove())
    jest.restoreAllMocks()
  })

  test('[P0][4.4-FE-012][AC1] submits a selected 1-5 rating with optional feedback and no default rating', async () => {
    const user = userEvent.setup()
    const { onSubmitOutputRating } = renderDrawer()
    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })

    const submit = within(drawer).getByRole('button', { name: '提交评分' })
    expect(submit).toBeDisabled()

    await user.click(within(drawer).getByRole('button', { name: '评分 5 分' }))
    await user.type(within(drawer).getByLabelText('评分反馈（可选）'), '高管摘要很有帮助')
    await user.click(submit)

    await waitFor(() =>
      expect(onSubmitOutputRating).toHaveBeenCalledWith({
        outputId: 'output-1',
        rating: 5,
        feedbackText: '高管摘要很有帮助',
      })
    )
  })

  test('[P0][4.4-FE-013][AC2] toggles favorite state from the drawer header', async () => {
    const user = userEvent.setup()
    const { onUpdateOutputFavorite } = renderDrawer()

    await user.click(screen.getByRole('button', { name: '收藏报告' }))

    await waitFor(() =>
      expect(onUpdateOutputFavorite).toHaveBeenCalledWith({
        outputId: 'output-1',
        isFavorited: true,
      })
    )
  })

  test('[P1][4.4-FE-014][AC1,AC2] renders existing current-user asset state without raw feedback text', () => {
    renderDrawer({
      output: createOutput({
        assetState: {
          outputId: 'output-1',
          rating: 4,
          feedbackTextPresent: true,
          isFavorited: true,
          updatedAt: '2026-05-21T06:00:00.000Z',
        },
      }),
    })

    const drawer = screen.getByRole('complementary', { name: '咨询文档抽屉' })
    expect(within(drawer).getByRole('button', { name: '取消收藏报告' })).toBeVisible()
    expect(within(drawer).getByRole('button', { name: '评分 4 分' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(drawer).getByText('已提交文字反馈')).toBeVisible()
    expect(within(drawer).queryByText(/raw feedback|高管摘要很有帮助/)).not.toBeInTheDocument()
  })
})
