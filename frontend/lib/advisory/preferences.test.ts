import {
  DEFAULT_ADVISORY_READING_DENSITY,
  buildAdvisoryPreferenceStorageKey,
  readAdvisoryPreferences,
  resolveAdvisoryPreferenceUserKey,
  writeAdvisoryPreferences,
} from './preferences'

function createMemoryStorage(seed: Record<string, string> = {}): Storage {
  const state = new Map(Object.entries(seed))

  return {
    get length() {
      return state.size
    },
    clear: jest.fn(() => state.clear()),
    getItem: jest.fn((key: string) => state.get(key) ?? null),
    key: jest.fn((index: number) => Array.from(state.keys())[index] ?? null),
    removeItem: jest.fn((key: string) => {
      state.delete(key)
    }),
    setItem: jest.fn((key: string, value: string) => {
      state.set(key, value)
    }),
  }
}

describe('advisory preferences', () => {
  it('normalizes the user identity before building a scoped storage key', () => {
    expect(resolveAdvisoryPreferenceUserKey(' Consultant@Example.COM ')).toBe(
      'consultant@example.com'
    )
    expect(resolveAdvisoryPreferenceUserKey('   ')).toBeNull()
    expect(buildAdvisoryPreferenceStorageKey(' Consultant@Example.COM ')).toBe(
      'csaas:thinktank:advisory:preferences:consultant@example.com'
    )
    expect(buildAdvisoryPreferenceStorageKey(null)).toBeNull()
  })

  it('defaults invalid or missing density values safely', () => {
    const storage = createMemoryStorage({
      'csaas:thinktank:advisory:preferences:consultant@example.com': JSON.stringify({
        readingDensity: 'oversized',
      }),
    })

    expect(readAdvisoryPreferences('consultant@example.com', storage)).toEqual({
      readingDensity: DEFAULT_ADVISORY_READING_DENSITY,
    })
    expect(readAdvisoryPreferences('new-user@example.com', storage)).toEqual({
      readingDensity: DEFAULT_ADVISORY_READING_DENSITY,
    })
  })

  it('persists compact default and comfortable density per user without cross-user leakage', () => {
    const storage = createMemoryStorage()

    writeAdvisoryPreferences('consultant-a@example.com', { readingDensity: 'comfortable' }, storage)
    writeAdvisoryPreferences('consultant-b@example.com', { readingDensity: 'compact' }, storage)

    expect(readAdvisoryPreferences('consultant-a@example.com', storage)).toEqual({
      readingDensity: 'comfortable',
    })
    expect(readAdvisoryPreferences('consultant-b@example.com', storage)).toEqual({
      readingDensity: 'compact',
    })
  })

  it('does not persist preferences without a stable user identity', () => {
    const storage = createMemoryStorage()

    writeAdvisoryPreferences(null, { readingDensity: 'comfortable' }, storage)

    expect(storage.length).toBe(0)
    expect(readAdvisoryPreferences(null, storage)).toEqual({
      readingDensity: DEFAULT_ADVISORY_READING_DENSITY,
    })
  })
})
