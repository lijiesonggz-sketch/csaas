import * as fs from 'fs'
import * as path from 'path'
import {
  getRulebookManifestPath,
  compileRulebookManifest,
  loadAllCompiledRulebooks,
  loadAllRulebookManifests,
  loadRulebookManifest,
  validateRulebookManifest,
} from './rulebook-manifest.loader'
import type { TaxonomyRulebookManifest } from './rulebook-manifest.types'

describe('rulebook manifest loader', () => {
  it('should load and compile the IT04 manifest into the existing TaxonomyRulebook runtime contract', () => {
    const manifest = loadRulebookManifest('IT04')
    const rulebook = compileRulebookManifest(manifest)

    expect(manifest.l1Code).toBe('IT04')
    expect(manifest.version).toBe('it04-rulebook-v1')
    expect(manifest.fallbackBucket).toBe('IT04-05')

    expect(rulebook.l1Code).toBe('IT04')
    expect(rulebook.version).toBe('it04-rulebook-v1')
    expect(rulebook.fallbackBucket).toBe('IT04-05')
    expect(rulebook.entries.map((entry) => entry.l2Code)).toEqual([
      'IT04-07',
      'IT04-04',
      'IT04-06',
      'IT04-08',
      'IT04-10',
      'IT04-11',
      'IT04-03',
      'IT04-05',
    ])
  })

  it('should expose all IT01-IT08 manifests and compiled rulebooks', () => {
    const manifests = loadAllRulebookManifests()
    const rulebooks = loadAllCompiledRulebooks()

    expect(Object.keys(manifests).sort()).toEqual([
      'IT01',
      'IT02',
      'IT03',
      'IT04',
      'IT05',
      'IT06',
      'IT07',
      'IT08',
    ])
    expect(Object.keys(rulebooks).sort()).toEqual(Object.keys(manifests).sort())
  })

  it('should keep every checked-in manifest valid and ensure each fallback bucket remains addressable as an entry', () => {
    const manifests = loadAllRulebookManifests()

    for (const [domainCode, manifest] of Object.entries(manifests)) {
      expect(manifest.entries.length).toBeGreaterThan(0)
      expect(manifest.entries.some((entry) => entry.l2Code === manifest.fallbackBucket)).toBe(true)
      expect(() => validateRulebookManifest(manifest, domainCode as 'IT01')).not.toThrow()
    }
  })

  it('should keep nest-cli asset copying configured for rulebook manifests so dist runtime can load JSON assets', () => {
    const nestCliPath = path.resolve(__dirname, '../../../../../../nest-cli.json')
    const nestCliConfig = JSON.parse(fs.readFileSync(nestCliPath, 'utf8')) as {
      compilerOptions?: { assets?: Array<{ include?: string; outDir?: string }> }
    }

    expect(nestCliConfig.compilerOptions?.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          include:
            'modules/case-import-orchestrator/services/taxonomy-classification/rulebooks/manifests/**/*',
          outDir: 'dist/src',
        }),
      ]),
    )
  })

  it('should reject manifests that reference l2 codes outside the canonical taxonomy catalog', () => {
    const invalidManifest: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-99',
          signals: [
            {
              label: '不存在的分类',
              weight: 3,
              matchers: [{ type: 'literal', value: '不存在' }],
            },
          ],
        },
      ],
    }

    expect(() => validateRulebookManifest(invalidManifest, 'IT04')).toThrow(/IT04-99/i)
  })

  it('should reject manifests with invalid fallback buckets, duplicate l2 codes, or empty matchers', () => {
    const invalidFallback: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT07-06',
      entries: [
        {
          l2Code: 'IT04-06',
          signals: [
            {
              label: '系统间不一致',
              weight: 5,
              matchers: [{ type: 'literal', value: '系统间数据不一致' }],
            },
          ],
        },
      ],
    }

    const duplicateEntry: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-06',
          signals: [
            {
              label: '系统间不一致',
              weight: 5,
              matchers: [{ type: 'literal', value: '系统间数据不一致' }],
            },
          ],
        },
        {
          l2Code: 'IT04-06',
          signals: [
            {
              label: '重复条目',
              weight: 3,
              matchers: [{ type: 'literal', value: '重复' }],
            },
          ],
        },
      ],
    }

    const emptyMatchers: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-06',
          signals: [
            {
              label: '空 matcher',
              weight: 0,
              matchers: [],
            },
          ],
        },
      ],
    }

    expect(() => validateRulebookManifest(invalidFallback, 'IT04')).toThrow(/fallbackBucket/i)
    expect(() => validateRulebookManifest(duplicateEntry, 'IT04')).toThrow(/duplicate/i)
    expect(() => validateRulebookManifest(emptyMatchers, 'IT04')).toThrow(/matchers|weight/i)
  })

  it('should reject manifests when the fallback bucket is not present among manifest entries', () => {
    const manifestWithoutFallbackEntry: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-06',
          signals: [
            {
              label: '系统间不一致',
              weight: 5,
              matchers: [{ type: 'literal', value: '系统间数据不一致' }],
            },
          ],
        },
      ],
    }

    expect(() => validateRulebookManifest(manifestWithoutFallbackEntry, 'IT04')).toThrow(
      /fallbackBucket entry missing/i,
    )
  })

  it('should reject manifests that use stateful or mixed regex flags inside a single signal', () => {
    const statefulRegexManifest: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-05',
          signals: [
            {
              label: 'stateful regex',
              weight: 2,
              matchers: [{ type: 'regex', source: 'east', flags: 'g' }],
            },
          ],
        },
      ],
    }

    const mixedFlagsManifest: TaxonomyRulebookManifest = {
      l1Code: 'IT04',
      version: 'it04-rulebook-v1',
      fallbackBucket: 'IT04-05',
      entries: [
        {
          l2Code: 'IT04-05',
          signals: [
            {
              label: 'mixed regex flags',
              weight: 2,
              matchers: [
                { type: 'regex', source: 'east', flags: 'i' },
                { type: 'regex', source: 'west', flags: 'm' },
              ],
            },
          ],
        },
      ],
    }

    expect(() => validateRulebookManifest(statefulRegexManifest, 'IT04')).toThrow(
      /stateful regex flags/i,
    )
    expect(() => validateRulebookManifest(mixedFlagsManifest, 'IT04')).toThrow(/mixed regex flags/i)
  })

  it('should resolve checked-in manifest paths for every supported domain code', () => {
    const manifests = loadAllRulebookManifests()

    for (const domainCode of Object.keys(manifests)) {
      const manifestPath = getRulebookManifestPath(domainCode as 'IT01')

      expect(fs.existsSync(manifestPath)).toBe(true)
      expect(manifestPath.endsWith(`${domainCode.toLowerCase()}.rulebook.json`)).toBe(true)
    }
  })
})
