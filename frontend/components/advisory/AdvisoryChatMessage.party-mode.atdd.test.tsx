import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdvisoryChatMessage } from './AdvisoryChatMessage'
import type { ThinkTankConversationMessage } from '@/lib/advisory/workflows'

describe('AdvisoryChatMessage Party Mode ATDD', () => {
  test('[P0][5.3-FE-001][AC1] renders expert identity with name, role, round, and non-color-only structure', () => {
    const message: ThinkTankConversationMessage = {
      id: 'advisor-message-1',
      role: 'assistant',
      content: '我建议先把数据流向和权限边界拆开确认。',
      workflowKey: 'design-thinking',
      stepIndex: 4,
      metadata: {
        party_mode_message: true,
        party_mode_round: 2,
        party_mode_speaker_index: 1,
        party_mode_advisor_id: 'security-architect',
        party_mode_advisor_name: '张岚',
        party_mode_advisor_role: '安全架构师',
        party_mode_advisor_perspective: '风险与控制',
        party_mode_current_speaker: false,
      },
    }

    render(<AdvisoryChatMessage message={message} />)

    const article = screen.getByRole('article', {
      name: /专家消息.*张岚.*安全架构师.*第 2 轮/,
    })
    expect(within(article).getByText('张岚')).toBeInTheDocument()
    expect(within(article).getByText('安全架构师')).toBeInTheDocument()
    expect(within(article).getByText(/第 2 轮/)).toBeInTheDocument()
    expect(within(article).getByText(/发言 1/)).toBeInTheDocument()
    expect(within(article).getByText('风险与控制')).toBeInTheDocument()
  })

  test('[P0][5.3-FE-002][AC2] announces the current streaming expert by name and role in a polite live region', () => {
    const message: ThinkTankConversationMessage = {
      id: 'advisor-streaming-1',
      role: 'assistant',
      content: '正在展开供应商访问控制建议',
      workflowKey: 'design-thinking',
      stepIndex: 4,
      metadata: {
        party_mode_message: true,
        party_mode_round: 1,
        party_mode_speaker_index: 2,
        party_mode_advisor_id: 'ops-advisor',
        party_mode_advisor_name: '陈晨',
        party_mode_advisor_role: '运维负责人',
        party_mode_current_speaker: true,
      },
    }

    render(<AdvisoryChatMessage message={message} isStreaming />)

    const article = screen.getByRole('article', { name: /陈晨.*运维负责人.*第 1 轮/ })
    const status = within(article).getByRole('status', {
      name: /当前发言人.*陈晨.*运维负责人/,
    })
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('陈晨')
    expect(status).toHaveTextContent('运维负责人')
  })

  test('[P0][5.3-FE-004][AC3] exposes an accessible reply action for a previous expert message', async () => {
    const onReplyToExpert = jest.fn()
    const message: ThinkTankConversationMessage = {
      id: 'advisor-message-2',
      role: 'assistant',
      content: '我补充运维落地风险。',
      workflowKey: 'design-thinking',
      stepIndex: 4,
      metadata: {
        party_mode_message: true,
        party_mode_round: 1,
        party_mode_speaker_index: 2,
        party_mode_advisor_id: 'ops-advisor',
        party_mode_advisor_name: '陈晨',
        party_mode_advisor_role: '运维负责人',
      },
    }

    render(<AdvisoryChatMessage message={message} onReplyToExpert={onReplyToExpert} />)

    await userEvent.click(screen.getByRole('button', { name: /回复陈晨.*运维负责人/ }))

    expect(onReplyToExpert).toHaveBeenCalledWith(message)
  })

  test('[P0][5.4-FE-001][AC1,AC2] renders Party Mode framework and AI-generated integration label accessibly', () => {
    const advisorMessage: ThinkTankConversationMessage = {
      id: 'advisor-framework-message',
      role: 'assistant',
      content: '我会先从技术可行性拆解落地风险。',
      workflowKey: 'problem-solving',
      stepIndex: 2,
      metadata: {
        party_mode_message: true,
        party_mode_round: 1,
        party_mode_speaker_index: 2,
        party_mode_advisor_id: 'architect',
        party_mode_advisor_name: 'Winston',
        party_mode_advisor_role: 'System Architect',
        party_mode_analysis_framework: 'Technical feasibility and architecture',
      },
    }
    const integrationMessage: ThinkTankConversationMessage = {
      id: 'integration-message',
      role: 'assistant',
      content: 'Consensus: onboarding is the primary blocker.\nRisks: roadmap distraction.',
      workflowKey: 'problem-solving',
      stepIndex: 2,
      metadata: {
        ai_generated: true,
        party_mode_integration: true,
        party_mode_integration_status: 'draft',
        ai_label_visible: '[AI Generated]',
      },
      decisionOptions: [
        {
          key: 'accept-party-mode-conclusion',
          action: 'accept-party-mode-conclusion',
          label: '接受整合结论',
          enabled: true,
        },
      ],
    }

    const { rerender } = render(<AdvisoryChatMessage message={advisorMessage} />)
    expect(screen.getByText('Technical feasibility and architecture')).toBeInTheDocument()

    rerender(<AdvisoryChatMessage message={integrationMessage} />)
    expect(screen.getByRole('article', { name: /Party Mode 整合结论/ })).toBeInTheDocument()
    expect(screen.getByText('[AI Generated]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /接受整合结论/ })).toBeInTheDocument()
  })

  test('[P0][5.5-FE-001][AC1,AC2] renders advisor failure, omitted advisors, remaining budget, and recovery controls accessibly', async () => {
    const onDecisionOption = jest.fn()
    const message: ThinkTankConversationMessage = {
      id: 'party-failure-message-1',
      role: 'assistant',
      content: '陈晨未能完成本轮回复，已保留前面专家的结论。',
      workflowKey: 'problem-solving',
      stepIndex: 2,
      metadata: {
        party_mode_message: true,
        party_mode_failure: true,
        party_mode_round: 1,
        party_mode_speaker_index: 2,
        party_mode_failed_advisor_id: 'ops-advisor',
        party_mode_failed_advisor_name: '陈晨',
        party_mode_failed_advisor_role: '运维负责人',
        party_mode_failure_category: 'timeout',
        party_mode_failure_retryable: true,
        party_mode_omitted_advisor_ids: 'finance-advisor',
        party_mode_omitted_advisor_names: '财务顾问',
        party_mode_budget_remaining_tokens: 3200,
        party_mode_budget_max_tokens: 8000,
        party_mode_budget_remaining_cost: 0.42,
        party_mode_budget_max_cost: 1,
      },
      decisionOptions: [
        {
          key: 'retry-party-mode-advisor',
          action: 'retry-party-mode-advisor',
          label: '重试陈晨',
          enabled: true,
        },
        {
          key: 'continue-party-mode',
          action: 'continue-party-mode',
          label: '继续讨论',
          enabled: true,
        },
        {
          key: 'return-to-workflow',
          action: 'return-to-workflow',
          label: '返回原工作流',
          enabled: true,
        },
      ],
    }

    render(<AdvisoryChatMessage message={message} onDecisionOption={onDecisionOption} />)

    const article = screen.getByRole('article', {
      name: /专家失败.*陈晨.*运维负责人.*第 1 轮/,
    })
    expect(within(article).getAllByText(/陈晨/).length).toBeGreaterThan(0)
    expect(within(article).getAllByText(/运维负责人/).length).toBeGreaterThan(0)
    expect(within(article).getByText(/timeout|超时/)).toBeInTheDocument()
    expect(within(article).getByText(/财务顾问/)).toBeInTheDocument()
    expect(within(article).getByText(/剩余.*3200.*8000/)).toBeInTheDocument()
    expect(within(article).getByText(/0\.42.*1/)).toBeInTheDocument()

    await userEvent.click(within(article).getByRole('button', { name: /重试陈晨/ }))
    expect(onDecisionOption).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retry-party-mode-advisor' }),
      message
    )

    await userEvent.click(within(article).getByRole('button', { name: /继续讨论/ }))
    expect(onDecisionOption).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'continue-party-mode' }),
      message
    )

    await userEvent.click(within(article).getByRole('button', { name: /返回原工作流/ }))
    expect(onDecisionOption).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'return-to-workflow' }),
      message
    )
  })
})
