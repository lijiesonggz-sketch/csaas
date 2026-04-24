import {
  mapLegacyIt04BenchmarkResult,
  parseModeEnv,
  parseTierEnv,
} from '../../scripts/run-taxonomy-benchmark'
import { IT04_RULEBOOK } from '../modules/case-import-orchestrator/services/taxonomy-classification/rulebooks/it04.rulebook'
import {
  TAXONOMY_BENCHMARK_AUTOMATE_LEGACY_RESULT,
} from '../modules/case-import-orchestrator/testing/taxonomy-benchmark-automate.fixtures'

describe('run-taxonomy-benchmark script helpers', () => {
  it('[P0][6.4-AUTO-006] should reject unsupported benchmark mode values instead of silently falling back', () => {
    expect(parseModeEnv(undefined)).toBe('new-path')
    expect(() => parseModeEnv('legacy-only')).toThrow('Invalid benchmark mode')
  })

  it('[P0][6.4-AUTO-007] should reject partially invalid tier lists instead of silently dropping bad values', () => {
    expect(parseTierEnv(undefined)).toBeUndefined()
    expect(parseTierEnv('tier-0-smoke,tier-1-cutover')).toEqual([
      'tier-0-smoke',
      'tier-1-cutover',
    ])
    expect(() => parseTierEnv('tier-1-cutover,typo')).toThrow('Invalid benchmark tiers')
  })

  it('[P1][6.4-AUTO-008] should preserve LEGACY_FALLBACK semantics when mapping IT04 legacy benchmark results into the unified classification contract', () => {
    const mapped = mapLegacyIt04BenchmarkResult({
      legacy: {
        ...TAXONOMY_BENCHMARK_AUTOMATE_LEGACY_RESULT,
        matchedPhrases: [...TAXONOMY_BENCHMARK_AUTOMATE_LEGACY_RESULT.matchedPhrases],
        matchedTokens: [...TAXONOMY_BENCHMARK_AUTOMATE_LEGACY_RESULT.matchedTokens],
      },
      mappingVersion: '2026-04-07',
      rulebookVersion: IT04_RULEBOOK.version,
    })

    expect(mapped.pathDecision).toBe('LEGACY_FALLBACK')
    expect(mapped.failureSemantics).toBe('LEGACY_FALLBACK_TRIGGERED')
    expect(mapped.l2Code).toBe('IT04-10')
  })
})
