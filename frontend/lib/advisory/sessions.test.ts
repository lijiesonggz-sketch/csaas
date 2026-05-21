import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import {
  fetchThinkTankUnfinishedSessions,
  resumeThinkTankSession,
} from './sessions'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()

describe('ThinkTank session resume client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
  })

  test('[P0][4.2-FE-001][AC1] fetches and normalizes unfinished sessions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          sessions: [
            {
              sessionId: 'session-completed',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Completed Diagnosis',
              lastStep: { index: 4, label: 'Close out' },
              status: 'completed',
              statusSummary: '已完成',
              lastActivityAt: '2026-05-21T01:08:00.000Z',
              checkpointSource: 'hot',
            },
            {
              sessionId: 'session-1',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Retention Diagnosis',
              lastStep: { index: 2, label: 'Map constraints' },
              status: 'active',
              statusSummary: '未完成 - 可继续',
              lastActivityAt: '2026-05-21T01:06:00.000Z',
              checkpointSource: 'hot',
            },
            {
              sessionId: 'session-invalid',
              workflowKey: 'problem-solving',
              workflowType: 'Problem Solving',
              title: 'Invalid Diagnosis',
              lastStep: { index: 1, label: 'Frame problem' },
              status: 'active',
              statusSummary: '未完成 - 可继续',
              lastActivityAt: 'not-a-date',
              checkpointSource: 'hot',
            },
          ],
        },
      }),
    })

    await expect(fetchThinkTankUnfinishedSessions()).resolves.toEqual({
      sessions: [
        {
          sessionId: 'session-1',
          workflowKey: 'problem-solving',
          workflowType: 'Problem Solving',
          title: 'Retention Diagnosis',
          lastStep: { index: 2, label: 'Map constraints' },
          status: 'active',
          statusSummary: '未完成 - 可继续',
          lastActivityAt: '2026-05-21T01:06:00.000Z',
          checkpointSource: 'hot',
        },
      ],
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/unfinished', {
      headers: { Authorization: 'Bearer session-token' },
      cache: 'no-store',
    })
  })

  test('[P0][4.2-FE-002][AC2,AC3] resumes a session and preserves recovery state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          session: {
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            workflowType: 'Problem Solving',
            title: 'Retention Diagnosis',
            lastStep: { index: 2, label: 'Map constraints' },
            status: 'active',
            statusSummary: '未完成 - 可继续',
            lastActivityAt: '2026-05-21T01:06:00.000Z',
            checkpointSource: 'fallback',
          },
          messages: [
            {
              id: 'message-assistant-1',
              role: 'assistant',
              content: 'Key conclusion: setup guidance is missing.',
            },
          ],
          output: {
            id: 'output-1',
            sessionId: 'session-1',
            workflowKey: 'problem-solving',
            status: 'draft',
            title: 'Retention Diagnosis',
            summary: 'Users drop after setup.',
            contentMarkdown: '# Retention Diagnosis',
            sections: [],
            aiLabelMetadata: { visible_label: '[AI Generated]' },
            metadata: {},
          },
          checkpointSource: 'fallback',
          recoveryMessage: {
            title: '已恢复未完成会话',
            content: '已从最近保存的对话和报告草稿恢复。',
            lastStep: 'Map constraints',
            keyConclusions: ['setup guidance is missing'],
            actions: [
              { key: 'continue', label: '继续' },
              { key: 'review-document', label: '先查看文档' },
            ],
          },
          recoveredState: {
            lastStep: 'Map constraints',
            messageCount: 1,
            outputSectionCount: 0,
            recoveredFrom: 'persisted-state',
          },
          missingState: ['checkpoint'],
        },
      }),
    })

    await expect(resumeThinkTankSession('session-1')).resolves.toMatchObject({
      checkpointSource: 'fallback',
      recoveryMessage: {
        lastStep: 'Map constraints',
        keyConclusions: ['setup guidance is missing'],
      },
      recoveredState: {
        recoveredFrom: 'persisted-state',
      },
      missingState: ['checkpoint'],
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/advisory/sessions/session-1/resume', {
      method: 'POST',
      headers: { Authorization: 'Bearer session-token' },
      cache: 'no-store',
    })
  })
})
