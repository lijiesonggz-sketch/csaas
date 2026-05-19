import { fetchThinkTankSessionMessages, sendThinkTankSessionMessage } from './workflows'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('ThinkTank session message client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0] retrieves tenant-scoped session messages through the advisory proxy envelope', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          currentStep: { index: 1, label: '当前步骤' },
          messages: [
            {
              id: 'message-1',
              role: 'assistant',
              content: 'Start with the first prompt.',
              decisionOptions: [],
            },
          ],
        },
      }),
    })

    await expect(fetchThinkTankSessionMessages('session-1')).resolves.toEqual({
      sessionId: 'session-1',
      currentStep: { index: 1, label: '当前步骤' },
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          content: 'Start with the first prompt.',
          decisionOptions: [],
        },
      ],
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/messages', {
      headers: { Authorization: 'Bearer session-token' },
      cache: 'no-store',
    })
  })

  test('[P0] submits a user answer and unwraps streamed advisor response data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessionId: 'session-1',
          currentStep: { index: 1, label: '当前步骤' },
          assistantMessage: {
            id: 'assistant-1',
            role: 'assistant',
            content: 'Here is a summary.',
            decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
          },
          stream: [{ index: 0, delta: 'Here is a summary.', done: true }],
          decisionOptions: [{ action: 'continue', label: '继续', shortcut: 'C', enabled: true }],
        },
      }),
    })

    await expect(
      sendThinkTankSessionMessage('session-1', {
        content: 'We need to inspect onboarding friction.',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        assistantMessage: expect.objectContaining({ content: 'Here is a summary.' }),
        stream: [expect.objectContaining({ done: true })],
      })
    )
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'We need to inspect onboarding friction.',
      }),
      cache: 'no-store',
    })
  })

  test('[P1] rejects empty or over-length drafts before calling the network', async () => {
    await expect(sendThinkTankSessionMessage('session-1', { content: '   ' })).rejects.toThrow(
      '请输入你的回答后再提交。'
    )
    await expect(
      sendThinkTankSessionMessage('session-1', { content: 'x'.repeat(5001) })
    ).rejects.toThrow('内容过长，请精简到 5000 字符以内。')

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
