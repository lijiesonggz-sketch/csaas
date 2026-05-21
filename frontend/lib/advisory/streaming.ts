import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import type { ThinkTankCheckpointWarning } from './checkpoints'
import { readAdvisoryMessage } from './envelope'
import {
  THINKTANK_EMPTY_MESSAGE_MESSAGE,
  THINKTANK_MESSAGE_MAX_LENGTH,
  THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE,
  THINKTANK_MESSAGE_TOO_LONG_MESSAGE,
  type ThinkTankConversationMessage,
  type ThinkTankDecisionOption,
  type ThinkTankWorkflowCurrentStep,
} from './workflows'

export const THINKTANK_STREAM_ERROR_MESSAGE =
  'ThinkTank streaming response was malformed. Please retry.'

export type ThinkTankStreamingEventName =
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'message.error'

export type ThinkTankStreamingEvent =
  | {
      event: 'message.started'
      data: {
        sessionId?: string
        currentStep?: ThinkTankWorkflowCurrentStep
      }
    }
  | {
      event: 'message.delta'
      data: {
        index: number
        delta: string
      }
    }
  | {
      event: 'message.completed'
      data: {
        sessionId?: string
        currentStep?: ThinkTankWorkflowCurrentStep
        assistantMessage: ThinkTankConversationMessage
        decisionOptions?: ThinkTankDecisionOption[]
        checkpointWarning?: ThinkTankCheckpointWarning
      }
    }
  | {
      event: 'message.error'
      data: {
        code: string
        message: string
        retryable?: boolean
      }
    }

export interface ThinkTankStreamingOptions {
  signal?: AbortSignal
}

export interface ThinkTankStreamingInput {
  content: string
  decisionAction?: string
}

export async function* streamThinkTankSessionMessage(
  sessionId: string,
  input: ThinkTankStreamingInput,
  options: ThinkTankStreamingOptions = {}
): AsyncGenerator<ThinkTankStreamingEvent> {
  const content = normalizeStreamingMessageContent(input.content)
  const headers = await getAuthHeadersAsync()
  const response = await fetch(
    `/api/advisory/sessions/${encodeURIComponent(sessionId)}/messages/stream`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        content,
        decisionAction: input.decisionAction,
      }),
      cache: 'no-store',
      signal: options.signal,
    }
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(readAdvisoryMessage(body) ?? THINKTANK_MESSAGE_SUBMIT_FAILED_MESSAGE)
  }

  if (!response.body) {
    throw new Error(THINKTANK_STREAM_ERROR_MESSAGE)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawTerminalEvent = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = drainSseBuffer(buffer)
      buffer = events.remaining

      for (const event of events.parsed) {
        if (event.event === 'message.completed' || event.event === 'message.error') {
          sawTerminalEvent = true
        }
        yield event
      }
    }

    buffer += decoder.decode()
    const events = drainSseBuffer(`${buffer}\n\n`)
    for (const event of events.parsed) {
      if (event.event === 'message.completed' || event.event === 'message.error') {
        sawTerminalEvent = true
      }
      yield event
    }

    if (!sawTerminalEvent && !options.signal?.aborted) {
      throw new Error(THINKTANK_STREAM_ERROR_MESSAGE)
    }
  } finally {
    reader.releaseLock()
  }
}

function drainSseBuffer(buffer: string): {
  parsed: ThinkTankStreamingEvent[]
  remaining: string
} {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const blocks = normalized.split('\n\n')
  const remaining = blocks.pop() ?? ''

  return {
    parsed: blocks.filter((block) => block.trim().length > 0).map(parseSseBlock),
    remaining,
  }
}

function parseSseBlock(block: string): ThinkTankStreamingEvent {
  let eventName = 'message'
  const dataLines: string[] = []

  block.split('\n').forEach((line) => {
    if (line.startsWith(':')) return
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim()
      return
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).replace(/^ /, ''))
    }
  })

  if (!isThinkTankStreamingEventName(eventName)) {
    throw new Error(THINKTANK_STREAM_ERROR_MESSAGE)
  }

  try {
    return {
      event: eventName,
      data: dataLines.length ? JSON.parse(dataLines.join('\n')) : {},
    } as ThinkTankStreamingEvent
  } catch (_error) {
    throw new Error(THINKTANK_STREAM_ERROR_MESSAGE)
  }
}

function isThinkTankStreamingEventName(value: string): value is ThinkTankStreamingEventName {
  return (
    value === 'message.started' ||
    value === 'message.delta' ||
    value === 'message.completed' ||
    value === 'message.error'
  )
}

function normalizeStreamingMessageContent(content: string): string {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error(THINKTANK_EMPTY_MESSAGE_MESSAGE)
  }

  const normalized = content.trim()
  if (normalized.length > THINKTANK_MESSAGE_MAX_LENGTH) {
    throw new Error(THINKTANK_MESSAGE_TOO_LONG_MESSAGE)
  }

  return normalized
}
