import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { streamThinkTankSessionMessage } from './streaming'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

function streamFromText(...chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)))
      controller.close()
    },
  })
}

describe('ThinkTank Party Mode streaming metadata ATDD', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][5.3-FE-003][AC2] parses current-speaker metadata before advisor deltas', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: party_mode.current_speaker\ndata: {"sessionId":"session-1","round":1,"speakerIndex":1,"advisorId":"security-architect","advisorName":"张岚","advisorRole":"安全架构师"}\n\n',
        'event: message.delta\ndata: {"index":0,"delta":"先确认权限边界"}\n\n',
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-1","role":"assistant","content":"先确认权限边界","metadata":{"party_mode_message":true,"party_mode_round":1,"party_mode_advisor_id":"security-architect","party_mode_advisor_name":"张岚","party_mode_advisor_role":"安全架构师"}},"partyModeTurnComplete":true}\n\n'
      ),
    })

    const events = []
    for await (const event of streamThinkTankSessionMessage('session-1', {
      content: '请各位专家继续',
    })) {
      events.push(event)
    }

    expect(events[0]).toEqual({
      event: 'party_mode.current_speaker',
      data: {
        sessionId: 'session-1',
        round: 1,
        speakerIndex: 1,
        advisorId: 'security-architect',
        advisorName: '张岚',
        advisorRole: '安全架构师',
      },
    })
    expect(events[1]).toEqual({
      event: 'message.delta',
      data: { index: 0, delta: '先确认权限边界' },
    })
  })

  test('[P0][5.3-FE-004][AC3] sends addressed expert hint as server-validated advisor and message ids', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-2","role":"assistant","content":"已回应","metadata":{"party_mode_message":true}},"partyModeTurnComplete":true}\n\n'
      ),
    })

    for await (const _event of streamThinkTankSessionMessage('session-1', {
      content: '请陈晨展开运维风险。',
      addressedExpertHint: {
        advisorId: 'ops-advisor',
        messageId: 'advisor-message-1',
      },
    })) {
      // consume stream
    }

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session-1/messages/stream',
      expect.objectContaining({
        body: JSON.stringify({
          content: '请陈晨展开运维风险。',
          decisionAction: undefined,
          addressedAdvisorId: 'ops-advisor',
          addressedMessageId: 'advisor-message-1',
        }),
      })
    )
  })

  test('[P0][5.3-FE-005][AC2] treats a partial Party Mode stream as malformed until the final expert completes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: party_mode.current_speaker\ndata: {"sessionId":"session-1","round":1,"speakerIndex":1,"advisorId":"security-architect","advisorName":"张岚","advisorRole":"安全架构师"}\n\n',
        'event: message.delta\ndata: {"index":0,"delta":"第一位专家完成，但后续专家未返回"}\n\n',
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-1","role":"assistant","content":"第一位专家完成，但后续专家未返回","metadata":{"party_mode_message":true,"party_mode_round":1,"party_mode_advisor_id":"security-architect"}},"partyModeTurnComplete":false}\n\n'
      ),
    })

    await expect(async () => {
      for await (const _event of streamThinkTankSessionMessage('session-1', {
        content: '请各位专家继续',
      })) {
        // consume stream
      }
    }).rejects.toThrow('ThinkTank streaming response was malformed. Please retry.')
  })

  test('[P0][5.5-FE-003][AC2,AC3] parses party_mode.advisor_failed before the terminal persisted failure message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: party_mode.current_speaker\ndata: {"sessionId":"session-1","round":1,"speakerIndex":1,"advisorId":"security-architect","advisorName":"张岚","advisorRole":"安全架构师"}\n\n',
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-1","role":"assistant","content":"第一位专家已完成","metadata":{"party_mode_message":true,"party_mode_round":1,"party_mode_advisor_id":"security-architect","party_mode_advisor_name":"张岚","party_mode_advisor_role":"安全架构师"}},"partyModeTurnComplete":false}\n\n',
        'event: party_mode.advisor_failed\ndata: {"sessionId":"session-1","round":1,"advisorId":"ops-advisor","advisorName":"陈晨","advisorRole":"运维负责人","failureCategory":"timeout","retryable":true,"omittedAdvisorIds":["finance-advisor"],"remainingBudget":{"tokens":2400,"maxTokens":8000,"cost":0.42,"maxCost":1}}\n\n',
        'event: message.completed\ndata: {"assistantMessage":{"id":"party-failure-message-1","role":"assistant","content":"陈晨本轮超时，已保留前面专家结论。","metadata":{"party_mode_message":true,"party_mode_failure":true,"party_mode_round":1,"party_mode_failed_advisor_id":"ops-advisor","party_mode_failed_advisor_name":"陈晨","party_mode_failed_advisor_role":"运维负责人","party_mode_failure_category":"timeout","party_mode_failure_retryable":true,"party_mode_budget_remaining_tokens":2400,"party_mode_budget_max_tokens":8000},"decisionOptions":[{"key":"retry-party-mode-advisor","action":"retry-party-mode-advisor","label":"重试陈晨","enabled":true},{"key":"continue-party-mode","action":"continue-party-mode","label":"继续讨论","enabled":true},{"key":"return-to-workflow","action":"return-to-workflow","label":"返回原工作流","enabled":true}]},"partyModeTurnComplete":true}\n\n'
      ),
    })

    const events = []
    for await (const event of streamThinkTankSessionMessage('session-1', {
      content: '请各位专家继续',
    })) {
      events.push(event)
    }

    expect(events).toContainEqual({
      event: 'party_mode.advisor_failed',
      data: {
        sessionId: 'session-1',
        round: 1,
        advisorId: 'ops-advisor',
        advisorName: '陈晨',
        advisorRole: '运维负责人',
        failureCategory: 'timeout',
        retryable: true,
        omittedAdvisorIds: ['finance-advisor'],
        remainingBudget: { tokens: 2400, maxTokens: 8000, cost: 0.42, maxCost: 1 },
      },
    })
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'message.completed',
        data: expect.objectContaining({
          partyModeTurnComplete: true,
          assistantMessage: expect.objectContaining({
            id: 'party-failure-message-1',
            metadata: expect.objectContaining({ party_mode_failure: true }),
          }),
        }),
      })
    )
  })

  test('[P0][5.5-FE-006][AC2,AC3] rejects advisor_failed without a persisted terminal failure message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: party_mode.current_speaker\ndata: {"sessionId":"session-1","round":1,"speakerIndex":1,"advisorId":"ops-advisor","advisorName":"陈晨","advisorRole":"运维负责人"}\n\n',
        'event: party_mode.advisor_failed\ndata: {"sessionId":"session-1","round":1,"advisorId":"ops-advisor","advisorName":"陈晨","advisorRole":"运维负责人","failureCategory":"timeout","retryable":true}\n\n'
      ),
    })

    await expect(async () => {
      for await (const _event of streamThinkTankSessionMessage('session-1', {
        content: '请各位专家继续',
      })) {
        // consume stream
      }
    }).rejects.toThrow('ThinkTank streaming response was malformed. Please retry.')
  })

  test('[P0][5.5-FE-004][AC1,AC2] treats a persisted Party Mode failure assistant message as terminal and exposes failure metadata', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: message.completed\ndata: {"assistantMessage":{"id":"party-failure-message-1","role":"assistant","content":"陈晨本轮超时，已保留前面专家结论。","metadata":{"party_mode_message":true,"party_mode_failure":true,"party_mode_round":1,"party_mode_failed_advisor_id":"ops-advisor","party_mode_failed_advisor_name":"陈晨","party_mode_failed_advisor_role":"运维负责人","party_mode_failure_category":"timeout","party_mode_failure_retryable":true,"party_mode_budget_remaining_tokens":2400,"party_mode_budget_max_tokens":8000},"decisionOptions":[{"key":"retry-party-mode-advisor","action":"retry-party-mode-advisor","label":"重试陈晨","enabled":true},{"key":"continue-party-mode","action":"continue-party-mode","label":"继续讨论","enabled":true},{"key":"return-to-workflow","action":"return-to-workflow","label":"返回原工作流","enabled":true}]},"partyModeTurnComplete":true}\n\n'
      ),
    })

    const events = []
    for await (const event of streamThinkTankSessionMessage('session-1', {
      content: '请各位专家继续',
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      expect.objectContaining({
        event: 'message.completed',
        data: expect.objectContaining({
          partyModeTurnComplete: true,
          assistantMessage: expect.objectContaining({
            id: 'party-failure-message-1',
            metadata: expect.objectContaining({
              party_mode_failure: true,
              party_mode_failed_advisor_id: 'ops-advisor',
              party_mode_budget_remaining_tokens: 2400,
            }),
            decisionOptions: expect.arrayContaining([
              expect.objectContaining({ action: 'retry-party-mode-advisor' }),
              expect.objectContaining({ action: 'continue-party-mode' }),
              expect.objectContaining({ action: 'return-to-workflow' }),
            ]),
          }),
        }),
      }),
    ])
  })
})
