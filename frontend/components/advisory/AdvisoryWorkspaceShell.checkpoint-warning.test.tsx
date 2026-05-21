import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvisoryWorkspaceShell from './AdvisoryWorkspaceShell'
import { launchThinkTankWorkflow } from '@/lib/advisory/workflows'
import { toast } from 'sonner'

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      },
    },
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
  },
}))

jest.mock('@/components/advisory/QuickConsultProblemIntake', () => ({
  QuickConsultProblemIntake: () => <div>Quick Consult Ready</div>,
}))

jest.mock('@/components/advisory/AdvisoryDocumentDrawer', () => ({
  AdvisoryDocumentDrawer: () => null,
}))

jest.mock('@/lib/advisory/organization-context', () => ({
  fetchOrganizationContext: jest.fn().mockResolvedValue({
    id: 'context-1',
    organizationName: 'Tenant 1',
    industry: 'Data security',
    size: null,
    completenessScore: 67,
    completeness: {
      requiredFieldsComplete: true,
      missingFields: ['size'],
      updatedAt: '2026-05-21T00:00:00.000Z',
    },
    appliedToPrompts: false,
  }),
  saveOrganizationContext: jest.fn(),
  readOrganizationContextSkip: jest.fn(() => false),
  writeOrganizationContextSkip: jest.fn(),
  isOrganizationContextUsable: jest.fn(() => true),
}))

jest.mock('@/lib/advisory/workflows', () => ({
  THINKTANK_EMPTY_MESSAGE_MESSAGE: '请输入你的回答后再提交。',
  THINKTANK_MESSAGE_MAX_LENGTH: 5000,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE: '暂时无法生成 ThinkTank 顾问回复，请稍后重试。',
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE:
    '暂时无法启动该 ThinkTank 工作流，请稍后重试或选择其他工作流。',
  fetchThinkTankWorkflows: jest.fn().mockResolvedValue({
    workflows: [
      {
        key: 'design-thinking',
        displayName: 'Design Thinking',
        canonicalName: 'Design Thinking',
        scenarioLabel: 'Improve onboarding',
        sourcePath: 'workflow:design-thinking',
      },
    ],
  }),
  fetchThinkTankSessionMessages: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
    messages: [],
  }),
  launchThinkTankWorkflow: jest.fn().mockResolvedValue({
    sessionId: 'session-1',
    workflow: {
      key: 'design-thinking',
      displayName: 'Design Thinking',
      canonicalName: 'Design Thinking',
      scenarioLabel: 'Improve onboarding',
      sourcePath: 'workflow:design-thinking',
    },
    status: 'active',
    sourceRefs: ['workflow:design-thinking'],
    firstPrompt: 'Start design thinking.',
    currentStep: {
      index: 1,
      label: '当前步骤',
      sourceRef: 'current-step:1',
    },
    checkpointWarning: {
      code: 'THINKTANK_CHECKPOINT_PERSISTENCE_DEGRADED',
      errorCategory: 'hot_store',
      recoveryGuidance: '当前操作已完成，但自动恢复检查点暂时不可用。请继续工作。',
    },
  }),
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
  fetchThinkTankWorkflowOutput: jest.fn().mockResolvedValue({ output: null }),
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
  fetchThinkTankSessionHistory: jest.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 20, total: 0 },
  }),
  searchThinkTankHistory: jest.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 20, total: 0 },
  }),
}))

const mockLaunchThinkTankWorkflow = launchThinkTankWorkflow as jest.Mock
const mockToastWarning = toast.warning as jest.Mock

describe('AdvisoryWorkspaceShell checkpoint warning', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
  })

  it('[P0][4.1-FE-001][AC4] shows a non-destructive recovery warning when launch returns checkpoint metadata', async () => {
    const user = userEvent.setup()
    render(<AdvisoryWorkspaceShell />)

    await user.click(await screen.findByRole('button', { name: /启动 Design Thinking/ }))

    await waitFor(() =>
      expect(mockLaunchThinkTankWorkflow).toHaveBeenCalledWith('design-thinking', {})
    )
    expect(
      await screen.findByRole('status', { name: 'ThinkTank checkpoint warning' })
    ).toHaveTextContent('当前操作已完成，但自动恢复检查点暂时不可用。请继续工作。')
    expect(mockToastWarning).toHaveBeenCalledWith('自动保存检查点暂时不可用', {
      description: '当前操作已完成，但自动恢复检查点暂时不可用。请继续工作。',
    })
  })
})
