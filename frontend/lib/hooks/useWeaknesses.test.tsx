import { renderHook, waitFor } from '@testing-library/react'
import { useWeaknesses } from './useWeaknesses'
import { apiFetch } from '@/lib/utils/api'

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

function apiError(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

describe('useWeaknesses', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps aggregated weakness data returned by apiFetch', async () => {
    mockApiFetch.mockResolvedValue({
      byCategory: {
        Architecture: { averageLevel: 2, count: 4 },
        Security: { averageLevel: 4, count: 2 },
      },
    })

    const { result } = renderHook(() => useWeaknesses('org-1'))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/organizations/org-1/weaknesses/aggregated')
    )
    await waitFor(() => expect(result.current.weaknesses).toHaveLength(2))

    expect(result.current.error).toBeNull()
    expect(result.current.weaknesses).toEqual([
      { name: 'Security', level: 4, count: 2 },
      { name: 'Architecture', level: 2, count: 4 },
    ])
  })

  it('treats 404 weakness responses as empty data', async () => {
    mockApiFetch.mockRejectedValue(apiError('No weaknesses data found', 404))

    const { result } = renderHook(() => useWeaknesses('org-1'))

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.weaknesses).toEqual([])
    expect(result.current.hasData).toBe(false)
  })

  it('surfaces unexpected fetch errors', async () => {
    mockApiFetch.mockRejectedValue(apiError('Backend unavailable', 503))

    const { result } = renderHook(() => useWeaknesses('org-1'))

    await waitFor(() => expect(result.current.error).toBe('Backend unavailable'))

    expect(result.current.weaknesses).toEqual([])
    expect(result.current.hasData).toBe(false)
  })
})
