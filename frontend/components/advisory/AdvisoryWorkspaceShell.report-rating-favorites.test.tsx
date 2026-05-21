import React, { type ReactElement, type ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import { fetchThinkTankSessionHistory } from '@/lib/advisory/history'
import { fetchThinkTankSessionMessages } from '@/lib/advisory/workflows'
import { fetchThinkTankWorkflowOutput, updateThinkTankOutputFavorite } from '@/lib/advisory/outputs'

let mockSessionData: {
  user: {
    id: string
    email: string
    tenantId: string
    organizationId: string
  }
} | null = null

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockSessionData }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/advisory/QuickConsultProblemIntake', () => ({
  QuickConsultProblemIntake: () => <div>Quick Consult Ready</div>,
}))

jest.mock('@/components/advisory/AdvisoryDocumentDrawer', () => ({
  AdvisoryDocumentDrawer: ({
    open,
    output,
    onUpdateOutputFavorite,
  }: {
    open: boolean
    output?: {
      id: string
      title?: string
      assetState?: { isFavorited?: boolean }
    } | null
    onUpdateOutputFavorite?: (input: { outputId: string; isFavorited: boolean }) => void
  }) => (
    <div aria-label="Mock document drawer">
      {open ? `Document drawer open: ${output?.title ?? 'No output'}` : 'Document drawer closed'}
      <span>Drawer favorite: {output?.assetState?.isFavorited ? 'true' : 'false'}</span>
      {output && (
        <button
          type="button"
          onClick={() =>
            onUpdateOutputFavorite?.({
              outputId: output.id,
              isFavorited: !output.assetState?.isFavorited,
            })
          }
        >
          mock toggle favorite
        </button>
      )}
    </div>
  ),
}))

jest.mock('@/components/ui/select', () => {
  const SelectItem = ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  )
  const SelectContent = ({ children }: { children: ReactNode }) => <>{children}</>
  const SelectTrigger = ({ children }: { children: ReactNode; 'aria-label'?: string }) => (
    <>{children}</>
  )
  const SelectValue = () => null
  const collectItems = (children: ReactNode): ReactElement[] => {
    const items: ReactElement[] = []
    React.Children.forEach(children, (child: ReactNode) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectItem) {
        items.push(child)
        return
      }
      items.push(...collectItems(child.props.children))
    })
    return items
  }
  const findTriggerLabel = (children: ReactNode): string | undefined => {
    let label: string | undefined
    React.Children.forEach(children, (child: ReactNode) => {
      if (!React.isValidElement(child)) return
      if (child.type === SelectTrigger) label = child.props['aria-label']
    })
    return label
  }
  const Select = ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <select
      aria-label={findTriggerLabel(children)}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {collectItems(children)}
    </select>
  )

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

jest.mock('@/lib/advisory/organization-context', () => ({
  fetchOrganizationContext: jest.fn().mockResolvedValue(null),
  saveOrganizationContext: jest.fn(),
  readOrganizationContextSkip: jest.fn(() => true),
  writeOrganizationContextSkip: jest.fn(),
  isOrganizationContextUsable: jest.fn(() => false),
}))

jest.mock('@/lib/advisory/workflows', () => ({
  THINKTANK_EMPTY_MESSAGE_MESSAGE: '请输入你的回答后再提交。',
  THINKTANK_MESSAGE_MAX_LENGTH: 5000,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE:
    '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。',
  fetchThinkTankWorkflows: jest.fn().mockResolvedValue({
    workflows: [
      ['brainstorming', 'Brainstorming'],
      ['domain-research', 'Domain Research'],
      ['market-research', 'Market Research'],
      ['product-brief', 'Product Brief'],
      ['prd', 'PRD'],
      ['problem-solving', 'Problem Solving'],
      ['design-thinking', 'Design Thinking'],
      ['storytelling', 'Storytelling'],
    ].map(([key, displayName]) => ({
      key,
      displayName,
      canonicalName: displayName,
      scenarioLabel: 'Systematic diagnosis',
      sourcePath: `workflow:${key}`,
    })),
  }),
  fetchThinkTankSessionMessages: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    currentStep: { index: 2, label: 'Map constraints' },
    messages: [],
  }),
  launchThinkTankWorkflow: jest.fn(),
}))

jest.mock('@/lib/advisory/streaming', () => ({
  THINKTANK_STREAM_ERROR_MESSAGE: 'stream failed',
  streamThinkTankSessionMessage: jest.fn(),
}))

jest.mock('@/lib/advisory/outputs', () => ({
  THINKTANK_OUTPUT_APPEND_FAILED_MESSAGE: 'append failed',
  THINKTANK_OUTPUT_EXPORT_FAILED_MESSAGE: 'export failed',
  appendThinkTankWorkflowOutputSection: jest.fn(),
  completeThinkTankSessionOutput: jest.fn(),
  downloadThinkTankSessionOutput: jest.fn(),
  fetchThinkTankWorkflowOutput: jest.fn(),
  rateThinkTankSessionOutput: jest.fn(),
  updateThinkTankOutputFavorite: jest.fn(),
}))

jest.mock('@/lib/advisory/sessions', () => ({
  THINKTANK_RESUME_SESSION_FAILED_MESSAGE: '暂时无法恢复该 ThinkTank 会话，请稍后重试。',
  THINKTANK_UNFINISHED_SESSIONS_LOAD_FAILED_MESSAGE:
    '暂时无法加载未完成的 ThinkTank 会话，请稍后重试。',
  fetchThinkTankUnfinishedSessions: jest.fn().mockResolvedValue({ sessions: [] }),
  resumeThinkTankSession: jest.fn(),
  toWorkflowLaunchFromResume: jest.fn(),
}))

jest.mock('@/lib/advisory/history', () => ({
  THINKTANK_HISTORY_LOAD_FAILED_MESSAGE: '暂时无法加载 ThinkTank 历史记录，请稍后重试。',
  THINKTANK_HISTORY_SEARCH_FAILED_MESSAGE: '暂时无法搜索 ThinkTank 历史记录，请稍后重试。',
  fetchThinkTankSessionHistory: jest.fn(),
  searchThinkTankHistory: jest.fn(),
}))

const mockFetchHistory = fetchThinkTankSessionHistory as jest.Mock
const mockFetchOutput = fetchThinkTankWorkflowOutput as jest.Mock
const mockFetchMessages = fetchThinkTankSessionMessages as jest.Mock
const mockUpdateFavorite = updateThinkTankOutputFavorite as jest.Mock

function createHistoryItem() {
  return {
    id: 'output-1',
    resultType: 'output',
    sessionId: 'session-1',
    outputId: 'output-1',
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    title: 'Retention Diagnosis',
    summary: 'Users drop after setup.',
    status: 'completed',
    timestamp: '2026-05-21T01:08:00.000Z',
    openTarget: 'view-output',
    assetState: {
      outputId: 'output-1',
      rating: null,
      feedbackTextPresent: false,
      isFavorited: false,
      updatedAt: null,
    },
  }
}

function createOutput(isFavorited = false) {
  return {
    sessionId: 'session-1',
    output: {
      id: 'output-1',
      sessionId: 'session-1',
      workflowKey: 'problem-solving',
      status: 'completed',
      title: 'Retention Diagnosis',
      summary: 'Users drop after setup.',
      contentMarkdown: '# Retention Diagnosis',
      sections: [],
      aiLabelMetadata: { visible_label: '[AI Generated]' },
      metadata: {},
      assetState: {
        outputId: 'output-1',
        rating: null,
        feedbackTextPresent: false,
        isFavorited,
        updatedAt: isFavorited ? '2026-05-21T06:10:00.000Z' : null,
      },
    },
  }
}

describe('AdvisoryWorkspaceShell report rating and favorites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionData = {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
    }
    mockFetchHistory.mockResolvedValue({
      items: [createHistoryItem()],
      meta: { page: 1, limit: 20, total: 1 },
    })
    mockFetchOutput.mockResolvedValue(createOutput(false))
    mockUpdateFavorite.mockResolvedValue({
      sessionId: 'session-1',
      assetState: {
        outputId: 'output-1',
        rating: null,
        feedbackTextPresent: false,
        isFavorited: true,
        updatedAt: '2026-05-21T06:10:00.000Z',
      },
    })
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
  })

  test('[P0][4.4-FE-015][AC2] synchronizes favorite state between report drawer and history list', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await screen.findByRole('region', { name: '历史记录' })
    expect(within(historyRegion).queryByText('已收藏')).not.toBeInTheDocument()

    await user.click(
      within(historyRegion).getByRole('button', { name: /打开报告 Retention Diagnosis/ })
    )
    await screen.findByText('Document drawer open: Retention Diagnosis')
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent(
      'Drawer favorite: false'
    )

    await user.click(screen.getByRole('button', { name: 'mock toggle favorite' }))

    await waitFor(() =>
      expect(mockUpdateFavorite).toHaveBeenCalledWith('session-1', {
        outputId: 'output-1',
        isFavorited: true,
      })
    )
    await waitFor(() => expect(within(historyRegion).getByText('已收藏')).toBeInTheDocument())
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent('Drawer favorite: true')
    expect(mockFetchMessages).not.toHaveBeenCalled()
  })
})
