import { getAuthHeadersAsync } from '@/lib/utils/jwt'
import { downloadThinkTankSessionOutput } from './outputs'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>
const mockFetch = jest.fn()
const mockCreateObjectUrl = jest.fn()
const mockRevokeObjectUrl = jest.fn()

function createExportResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="thinktank-report-session-1.md"',
    }),
    blob: jest.fn(async () => new Blob(['# Report\n\n[AI Generated]'], { type: 'text/markdown' })),
    text: jest.fn(async () => '# Report\n\n[AI Generated]'),
    ...overrides,
  } as unknown as Response
}

describe('ThinkTank workflow output export client (ATDD RED)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({ Authorization: 'Bearer session-token' })
    global.fetch = mockFetch
    Object.defineProperty(window, 'URL', {
      configurable: true,
      value: {
        createObjectURL: mockCreateObjectUrl.mockReturnValue('blob:thinktank-report'),
        revokeObjectURL: mockRevokeObjectUrl,
      },
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  test('[P0] downloads Markdown through the Next proxy without sending report content or tenant metadata', async () => {
    jest.useFakeTimers()
    mockFetch.mockResolvedValue(createExportResponse())
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    await expect(downloadThinkTankSessionOutput('session-1', 'markdown')).resolves.toEqual({
      fileName: 'thinktank-report-session-1.md',
      format: 'markdown',
      contentType: 'text/markdown; charset=utf-8',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/advisory/sessions/session-1/output/export?format=markdown',
      {
        headers: { Authorization: 'Bearer session-token' },
        cache: 'no-store',
      }
    )
    expect(JSON.stringify(mockFetch.mock.calls[0][1])).not.toMatch(
      /tenant|outputId|contentMarkdown|sections|prompt|audit/i
    )
    expect(click).toHaveBeenCalledTimes(1)
    jest.runOnlyPendingTimers()
    expect(mockRevokeObjectUrl).toHaveBeenCalledWith('blob:thinktank-report')
  })

  test('[P0] preserves backend filename from Content-Disposition for PDF downloads', async () => {
    mockFetch.mockResolvedValue(
      createExportResponse({
        headers: new Headers({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="thinktank-report-session-1.pdf"',
        }),
        blob: jest.fn(async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
      })
    )
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await expect(downloadThinkTankSessionOutput('session-1', 'pdf')).resolves.toEqual(
      expect.objectContaining({
        fileName: 'thinktank-report-session-1.pdf',
      })
    )
  })

  test('[P1] falls back to a deterministic safe filename when backend filename is absent', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-20T03:00:00.000Z'))
    mockFetch.mockResolvedValue(
      createExportResponse({
        headers: new Headers({ 'Content-Type': 'text/markdown; charset=utf-8' }),
      })
    )
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await expect(downloadThinkTankSessionOutput('session-1', 'markdown')).resolves.toEqual(
      expect.objectContaining({
        fileName: 'thinktank-report-session-1-2026-05-20T03-00-00-000Z.md',
      })
    )
  })

  test('[P0] surfaces backend export errors with recoverable client-facing messages', async () => {
    mockFetch.mockResolvedValue(
      createExportResponse({
        ok: false,
        status: 400,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: jest.fn(async () =>
          JSON.stringify({
            error: {
              code: 'THINKTANK_OUTPUT_EMPTY',
              message: '报告至少需要一个章节后才能导出。',
            },
          })
        ),
      })
    )
    await expect(downloadThinkTankSessionOutput('session-1', 'markdown')).rejects.toThrow(
      '报告至少需要一个章节后才能导出。'
    )
  })

  test('[P1] falls back when Content-Disposition filename* is malformed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-20T03:00:00.000Z'))
    mockFetch.mockResolvedValue(
      createExportResponse({
        headers: new Headers({
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'attachment; filename*=UTF-8\'\'%E0%A4%A; filename="safe.md"',
        }),
      })
    )
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await expect(downloadThinkTankSessionOutput('session-1', 'markdown')).resolves.toEqual(
      expect.objectContaining({
        fileName: 'safe.md',
      })
    )
  })
})
