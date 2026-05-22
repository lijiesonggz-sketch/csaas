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
})
