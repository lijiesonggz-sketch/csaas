import { IT01_RULEBOOK, IT01_RULEBOOK_VERSION } from './it01.rulebook'
import { IT02_RULEBOOK, IT02_RULEBOOK_VERSION } from './it02.rulebook'
import { IT03_RULEBOOK, IT03_RULEBOOK_VERSION } from './it03.rulebook'
import { IT04_RULEBOOK } from './it04.rulebook'
import { IT04_RULEBOOK_VERSION } from './it04.rulebook'
import { IT05_RULEBOOK, IT05_RULEBOOK_VERSION } from './it05.rulebook'
import { IT06_RULEBOOK, IT06_RULEBOOK_VERSION } from './it06.rulebook'
import { IT07_RULEBOOK, IT07_RULEBOOK_VERSION } from './it07.rulebook'
import { IT08_RULEBOOK, IT08_RULEBOOK_VERSION } from './it08.rulebook'
import {
  compileRulebookManifest,
  loadAllCompiledRulebooks,
  loadAllRulebookManifests,
  loadRulebookManifest,
} from './rulebook-manifest.loader'
import type { TaxonomyRulebookManifest } from './rulebook-manifest.types'

describe('rulebook manifest parity', () => {
  it('should preserve IT04 regex signal semantics after manifest compilation', () => {
    const manifest = loadRulebookManifest('IT04')
    const rulebook = compileRulebookManifest(manifest)
    const signal = rulebook.entries
      .find((entry) => entry.l2Code === 'IT04-03')
      ?.signals.find((entry) => entry.label === 'EAST错报漏报')

    expect(signal).toBeDefined()
    expect(signal?.pattern.test('EAST 监管标准化数据在多张报表之间连续错报')).toBe(true)
    expect(signal?.pattern.test('EAST 监管标准化数据存在漏报问题')).toBe(true)
    expect(signal?.pattern.test('普通业务数据问题')).toBe(false)
  })

  it('should preserve IT04 literal and regex signal surface on the public wrapper export', () => {
    const signal = IT04_RULEBOOK.entries
      .find((entry) => entry.l2Code === 'IT04-06')
      ?.signals.find((entry) => entry.label === '系统间不一致')

    expect(IT04_RULEBOOK.version).toBe('it04-rulebook-v1')
    expect(IT04_RULEBOOK.fallbackBucket).toBe('IT04-05')
    expect(signal).toBeDefined()
    expect(signal?.pattern.test('系统间数据不一致')).toBe(true)
    expect(signal?.pattern.test('源系统与台账严重不一致')).toBe(true)
  })

  it('should escape literal metacharacters the same way as keywordSignal when compiling synthetic manifests', () => {
    const syntheticManifest: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-05',
          signals: [
            {
              label: 'special literal',
              weight: 2,
              matchers: [{ type: 'literal', value: 'A+B(监管)' }],
            },
            {
              label: 'case insensitive regex',
              weight: 2,
              matchers: [{ type: 'regex', source: 'east', flags: 'i' }],
            },
          ],
        },
      ],
    }

    const rulebook = compileRulebookManifest(syntheticManifest)
    const literalSignal = rulebook.entries[0].signals[0]
    const regexSignal = rulebook.entries[0].signals[1]

    expect(literalSignal.pattern.test('A+B(监管)')).toBe(true)
    expect(literalSignal.pattern.test('AAB监管')).toBe(false)
    expect(regexSignal.pattern.test('EAST')).toBe(true)
    expect(regexSignal.pattern.test('east')).toBe(true)
  })

  it('should keep wrapper exports aligned with compiled manifests across IT01-IT08', () => {
    const compiledRulebooks = loadAllCompiledRulebooks()
    const manifests = loadAllRulebookManifests()
    const wrapperExports = {
      IT01: { version: IT01_RULEBOOK_VERSION, rulebook: IT01_RULEBOOK },
      IT02: { version: IT02_RULEBOOK_VERSION, rulebook: IT02_RULEBOOK },
      IT03: { version: IT03_RULEBOOK_VERSION, rulebook: IT03_RULEBOOK },
      IT04: { version: IT04_RULEBOOK_VERSION, rulebook: IT04_RULEBOOK },
      IT05: { version: IT05_RULEBOOK_VERSION, rulebook: IT05_RULEBOOK },
      IT06: { version: IT06_RULEBOOK_VERSION, rulebook: IT06_RULEBOOK },
      IT07: { version: IT07_RULEBOOK_VERSION, rulebook: IT07_RULEBOOK },
      IT08: { version: IT08_RULEBOOK_VERSION, rulebook: IT08_RULEBOOK },
    }

    for (const [domainCode, wrapper] of Object.entries(wrapperExports)) {
      const compiled = compiledRulebooks[domainCode as keyof typeof compiledRulebooks]
      const manifest = manifests[domainCode as keyof typeof manifests]

      expect(wrapper.version).toBe(manifest.version)
      expect(wrapper.rulebook.l1Code).toBe(domainCode)
      expect(wrapper.rulebook.version).toBe(compiled.version)
      expect(wrapper.rulebook.fallbackBucket).toBe(compiled.fallbackBucket)
      expect(wrapper.rulebook.entries.map((entry) => entry.l2Code)).toEqual(
        compiled.entries.map((entry) => entry.l2Code),
      )
      expect(
        wrapper.rulebook.entries.flatMap((entry) => entry.signals.map((signal) => signal.label)),
      ).toEqual(compiled.entries.flatMap((entry) => entry.signals.map((signal) => signal.label)))
    }
  })
})
