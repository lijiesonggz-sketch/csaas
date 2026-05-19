import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { THINKTANK_STREAM_ERROR_MESSAGE, streamThinkTankSessionMessage } from './streaming'

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

describe('ThinkTank SSE streaming client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0] parses split named SSE frames in order', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: message.started\ndata: {"sessionId":"session-1"}\n\n',
        'event: message.delta\ndata: {"index":0,"delta":"Hel',
        'lo"}\n\n',
        'event: message.completed\ndata: {"assistantMessage":{"id":"a1","role":"assistant","content":"Hello"}}\n\n'
      ),
    })

    const events = []
    for await (const event of streamThinkTankSessionMessage('session-1', {
      content: 'Say hello',
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { event: 'message.started', data: { sessionId: 'session-1' } },
      { event: 'message.delta', data: { index: 0, delta: 'Hello' } },
      {
        event: 'message.completed',
        data: { assistantMessage: { id: 'a1', role: 'assistant', content: 'Hello' } },
      },
    ])
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/messages/stream', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ content: 'Say hello', decisionAction: undefined }),
      cache: 'no-store',
      signal: undefined,
    })
  })

  test('[P0] surfaces stream error events without swallowing the payload', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText(
        'event: message.error\ndata: {"code":"THINKTANK_STREAM_FAILED","message":"Provider failed","retryable":true}\n\n'
      ),
    })

    const events = []
    for await (const event of streamThinkTankSessionMessage('session-1', {
      content: 'Trigger error',
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      {
        event: 'message.error',
        data: {
          code: 'THINKTANK_STREAM_FAILED',
          message: 'Provider failed',
          retryable: true,
        },
      },
    ])
  })

  test('[P1] throws a deterministic error for malformed SSE JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText('event: message.delta\ndata: {"delta":\n\n'),
    })

    await expect(async () => {
      for await (const _event of streamThinkTankSessionMessage('session-1', {
        content: 'Malformed response',
      })) {
        // consume stream
      }
    }).rejects.toThrow(THINKTANK_STREAM_ERROR_MESSAGE)
  })

  test('[P1] rejects streams that end before a completed or error event', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: streamFromText('event: message.delta\ndata: {"index":0,"delta":"partial"}\n\n'),
    })

    await expect(async () => {
      for await (const _event of streamThinkTankSessionMessage('session-1', {
        content: 'Disconnect before terminal event',
      })) {
        // consume stream
      }
    }).rejects.toThrow(THINKTANK_STREAM_ERROR_MESSAGE)
  })

  test('[P1] passes abort signals to fetch and stops reading when aborted', async () => {
    const abortController = new AbortController()
    abortController.abort()
    mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(async () => {
      for await (const _event of streamThinkTankSessionMessage(
        'session-1',
        {
          content: 'Abort this request',
        },
        { signal: abortController.signal }
      )) {
        // consume stream
      }
    }).rejects.toThrow('Aborted')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session-1/messages/stream',
      expect.objectContaining({ signal: abortController.signal })
    )
  })
})
