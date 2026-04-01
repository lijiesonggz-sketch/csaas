import { renderHook, act } from '@testing-library/react'

import { useAITaskCache } from './useAITaskCache'

describe('useAITaskCache', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it('keeps stable method references across rerenders when cache state is unchanged', () => {
    const { result, rerender } = renderHook(() => useAITaskCache())

    const firstGet = result.current.get
    const firstSet = result.current.set
    const firstClear = result.current.clear

    rerender()

    expect(result.current.get).toBe(firstGet)
    expect(result.current.set).toBe(firstSet)
    expect(result.current.clear).toBe(firstClear)
  })

  it('reads back values that were written to cache', () => {
    const { result } = renderHook(() => useAITaskCache())

    act(() => {
      result.current.set('project-1', 'questionnaire', 'task-1', { foo: 'bar' })
    })

    expect(result.current.get('project-1', 'questionnaire')).toEqual({ foo: 'bar' })
  })
})
