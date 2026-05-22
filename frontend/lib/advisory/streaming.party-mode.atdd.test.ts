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
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-1","role":"assistant","content":"先确认权限边界","metadata":{"party_mode_message":true,"party_mode_round":1,"party_mode_advisor_id":"security-architect","party_mode_advisor_name":"张岚","party_mode_advisor_role":"安全架构师"}},"partyModeTurnComplete":true}\n\n',
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
    expect(events[1]).toEqual({ event: 'message.delta', data: { index: 0, delta: '先确认权限边界' } })
  })

  test('[P0][5.3-FE-004][AC3] sends addressed expert hint as server-validated advisor and message ids', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-2","role":"assistant","content":"已回应","metadata":{"party_mode_message":true}},"partyModeTurnComplete":true}\n\n',
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
      }),
    )
  })

  test('[P0][5.3-FE-005][AC2] treats a partial Party Mode stream as malformed until the final expert completes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: party_mode.current_speaker\ndata: {"sessionId":"session-1","round":1,"speakerIndex":1,"advisorId":"security-architect","advisorName":"张岚","advisorRole":"安全架构师"}\n\n',
        'event: message.delta\ndata: {"index":0,"delta":"第一位专家完成，但后续专家未返回"}\n\n',
        'event: message.completed\ndata: {"assistantMessage":{"id":"advisor-message-1","role":"assistant","content":"第一位专家完成，但后续专家未返回","metadata":{"party_mode_message":true,"party_mode_round":1,"party_mode_advisor_id":"security-architect"}},"partyModeTurnComplete":false}\n\n',
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
})
