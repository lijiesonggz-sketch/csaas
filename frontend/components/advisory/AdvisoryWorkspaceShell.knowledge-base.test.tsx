import React, { type ReactElement, type ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import { fetchThinkTankSessionHistory } from '@/lib/advisory/history'
import { fetchThinkTankSessionMessages } from '@/lib/advisory/workflows'
import {
  associateThinkTankOutputWithKnowledgeBase,
  fetchThinkTankWorkflowOutput,
} from '@/lib/advisory/outputs'

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
    onAssociateOutputWithKnowledgeBase,
  }: {
    open: boolean
    output?: {
      id: string
      title?: string
      knowledgeBaseAssociation?: { status?: string | null }
    } | null
    onAssociateOutputWithKnowledgeBase?: (input: { outputId: string }) => void
  }) => (
    <div aria-label="Mock document drawer">
      {open ? `Document drawer open: ${output?.title ?? 'No output'}` : 'Document drawer closed'}
      <span>Drawer KB: {output?.knowledgeBaseAssociation?.status ?? 'none'}</span>
      {output && (
        <button
          type="button"
          onClick={() =>
            onAssociateOutputWithKnowledgeBase?.({
              outputId: output.id,
            })
          }
        >
          mock save knowledge base
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
  associateThinkTankOutputWithKnowledgeBase: jest.fn(),
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
const mockAssociateKnowledgeBase = associateThinkTankOutputWithKnowledgeBase as jest.Mock

function createAssociation(outputId: string, status: 'associated' | 'pending' | 'failed' | null) {
  return {
    outputId,
    status,
    destinationKey: status ? 'enterprise-knowledge-base' : null,
    externalReferenceId: status === 'associated' ? `kb-ref-${outputId}` : null,
    message: status === 'failed' ? '知识库暂不可用，报告仍保留在 ThinkTank，可稍后重试。' : null,
    retryCount: status ? 1 : 0,
    updatedAt: status ? '2026-05-21T08:05:00.000Z' : null,
    associatedAt: status === 'associated' ? '2026-05-21T08:05:00.000Z' : null,
  }
}

function createHistoryItem(
  outputId: string,
  title: string,
  status: 'associated' | 'pending' | null
) {
  return {
    id: outputId,
    resultType: 'output',
    sessionId: 'session-1',
    outputId,
    workflowKey: 'problem-solving',
    workflowType: 'Problem Solving',
    title,
    summary: 'Users drop after setup.',
    status: 'completed',
    timestamp: outputId === 'output-1' ? '2026-05-21T01:08:00.000Z' : '2026-05-21T01:07:00.000Z',
    openTarget: 'view-output',
    knowledgeBaseAssociation: createAssociation(outputId, status),
  }
}

function createOutput(outputId = 'output-1') {
  return {
    sessionId: 'session-1',
    output: {
      id: outputId,
      sessionId: 'session-1',
      workflowKey: 'problem-solving',
      status: 'completed',
      title: outputId === 'output-1' ? 'Retention Diagnosis' : 'Second Diagnosis',
      summary: 'Users drop after setup.',
      contentMarkdown: '# Retention Diagnosis',
      sections: [],
      aiLabelMetadata: { visible_label: '[AI Generated]' },
      metadata: {},
      knowledgeBaseAssociation: createAssociation(outputId, null),
    },
  }
}

describe('AdvisoryWorkspaceShell knowledge-base association synchronization', () => {
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
      items: [
        createHistoryItem('output-1', 'Retention Diagnosis', null),
        createHistoryItem('output-2', 'Second Diagnosis', 'pending'),
      ],
      meta: { page: 1, limit: 20, total: 2 },
    })
    mockFetchOutput.mockResolvedValue(createOutput('output-1'))
    mockAssociateKnowledgeBase.mockResolvedValue({
      sessionId: 'session-1',
      knowledgeBaseAssociation: createAssociation('output-1', 'associated'),
    })
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
  })

  test('[P1][4.5-FE-010][AC3] syncs association state only to matching active output preview and history rows', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    const historyRegion = await screen.findByRole('region', { name: '历史记录' })
    expect(within(historyRegion).queryByText('已关联知识库')).not.toBeInTheDocument()
    expect(within(historyRegion).getByText('知识库待同步')).toBeInTheDocument()

    await user.click(
      within(historyRegion).getByRole('button', { name: /打开报告 Retention Diagnosis/ })
    )
    await screen.findByText('Document drawer open: Retention Diagnosis')
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent('Drawer KB: none')

    await user.click(screen.getByRole('button', { name: 'mock save knowledge base' }))

    await waitFor(() =>
      expect(mockAssociateKnowledgeBase).toHaveBeenCalledWith('session-1', {
        outputId: 'output-1',
      })
    )
    await waitFor(() => expect(within(historyRegion).getByText('已关联知识库')).toBeInTheDocument())
    expect(within(historyRegion).getByText('知识库待同步')).toBeInTheDocument()
    expect(screen.getByLabelText('Mock document drawer')).toHaveTextContent('Drawer KB: associated')
    expect(mockFetchMessages).not.toHaveBeenCalled()
  })
})
