import { keywordSignal } from './rule-signal.utils'
import { TAXONOMY_MULTIDOMAIN_AUTOMATE_LITERAL_PATTERN } from '../../../testing/taxonomy-multidomain-automate.fixtures'

describe('keywordSignal', () => {
  it('[P0] should preserve regular-expression patterns for fuzzy rule matching variants', () => {
    const signal = keywordSignal('系统间不一致', 5, [/源系统.*不一致/])

    expect(signal.pattern.test('报送数据与源系统、中间台账之间不一致')).toBe(true)
    expect(signal.pattern.test('系统间数据不一致')).toBe(false)
  })

  it('[P0] should escape literal phrase metacharacters instead of treating them as regex syntax', () => {
    const signal = keywordSignal('literal phrase', 3, [
      TAXONOMY_MULTIDOMAIN_AUTOMATE_LITERAL_PATTERN,
    ])

    expect(signal.pattern.test(TAXONOMY_MULTIDOMAIN_AUTOMATE_LITERAL_PATTERN)).toBe(true)
    expect(signal.pattern.test('AA监管')).toBe(false)
  })

  it('[P0] should reject empty phrase collections to avoid match-all rule construction', () => {
    expect(() => keywordSignal('empty', 1, [])).toThrow(
      'keywordSignal requires at least one phrase',
    )
  })
})
