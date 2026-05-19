export const ADVISORY_READING_DENSITY_OPTIONS = [
  {
    value: 'compact',
    label: '紧凑',
  },
  {
    value: 'default',
    label: '默认',
  },
  {
    value: 'comfortable',
    label: '舒适',
  },
] as const

export type AdvisoryReadingDensity = (typeof ADVISORY_READING_DENSITY_OPTIONS)[number]['value']

export interface AdvisoryPreferences {
  readingDensity: AdvisoryReadingDensity
}

export const DEFAULT_ADVISORY_READING_DENSITY: AdvisoryReadingDensity = 'default'
export const ADVISORY_PREFERENCE_STORAGE_PREFIX = 'csaas:thinktank:advisory:preferences'

const DENSITY_LABELS = ADVISORY_READING_DENSITY_OPTIONS.reduce(
  (labels, option) => {
    labels[option.value] = option.label
    return labels
  },
  {} as Record<AdvisoryReadingDensity, string>
)

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function resolveAdvisoryPreferenceUserKey(userIdentity?: string | null): string | null {
  const normalized = userIdentity?.trim().toLowerCase()
  return normalized || null
}

export function buildAdvisoryPreferenceStorageKey(userIdentity?: string | null): string | null {
  const userKey = resolveAdvisoryPreferenceUserKey(userIdentity)
  return userKey ? `${ADVISORY_PREFERENCE_STORAGE_PREFIX}:${userKey}` : null
}

export function normalizeAdvisoryReadingDensity(value: unknown): AdvisoryReadingDensity {
  return ADVISORY_READING_DENSITY_OPTIONS.some((option) => option.value === value)
    ? (value as AdvisoryReadingDensity)
    : DEFAULT_ADVISORY_READING_DENSITY
}

export function getAdvisoryReadingDensityLabel(density: AdvisoryReadingDensity): string {
  return DENSITY_LABELS[density]
}

export function readAdvisoryPreferences(
  userIdentity?: string | null,
  storage?: Storage
): AdvisoryPreferences {
  const resolvedStorage = getStorage(storage)
  if (!resolvedStorage) {
    return { readingDensity: DEFAULT_ADVISORY_READING_DENSITY }
  }

  try {
    const storageKey = buildAdvisoryPreferenceStorageKey(userIdentity)
    if (!storageKey) {
      return { readingDensity: DEFAULT_ADVISORY_READING_DENSITY }
    }

    const raw = resolvedStorage.getItem(storageKey)
    if (!raw) {
      return { readingDensity: DEFAULT_ADVISORY_READING_DENSITY }
    }

    const parsed = JSON.parse(raw) as Partial<AdvisoryPreferences>
    return {
      readingDensity: normalizeAdvisoryReadingDensity(parsed.readingDensity),
    }
  } catch {
    return { readingDensity: DEFAULT_ADVISORY_READING_DENSITY }
  }
}

export function writeAdvisoryPreferences(
  userIdentity: string | null | undefined,
  preferences: AdvisoryPreferences,
  storage?: Storage
): void {
  const resolvedStorage = getStorage(storage)
  if (!resolvedStorage) return

  try {
    const storageKey = buildAdvisoryPreferenceStorageKey(userIdentity)
    if (!storageKey) return

    resolvedStorage.setItem(
      storageKey,
      JSON.stringify({
        readingDensity: normalizeAdvisoryReadingDensity(preferences.readingDensity),
      })
    )
  } catch {
    // Browser storage can be unavailable or quota-limited; keep the in-memory UI state usable.
  }
}
