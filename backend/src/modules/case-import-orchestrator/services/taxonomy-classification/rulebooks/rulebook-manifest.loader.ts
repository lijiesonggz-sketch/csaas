import * as fs from 'fs'
import * as path from 'path'
import type {
  TaxonomyRuleSignal,
  TaxonomyRulebook,
} from '../contracts/classification-result.contract'
import {
  TAXONOMY_RULEBOOK_DOMAIN_CODES,
  type TaxonomyRulebookDomainCode,
  type TaxonomyRulebookManifest,
  type TaxonomyRulebookMatcherDescriptor,
  type TaxonomyRulebookManifestEntry,
  type TaxonomyRulebookManifestSignal,
} from './rulebook-manifest.types'

type TaxonomySeedFile = {
  l2: Array<{ l2Code: string }>
}

const MANIFEST_DIR = path.resolve(__dirname, 'manifests')
const TAXONOMY_SEED_PATH = path.resolve(
  __dirname,
  '../../../../applicability-engine/seeds/data/taxonomy.seed.json',
)
const manifestCache = new Map<TaxonomyRulebookDomainCode, TaxonomyRulebookManifest>()
const compiledCache = new Map<TaxonomyRulebookDomainCode, TaxonomyRulebook>()
let canonicalL2CodeCache: Set<string> | null = null

function assertDomainCode(domainCode: string): asserts domainCode is TaxonomyRulebookDomainCode {
  if (!TAXONOMY_RULEBOOK_DOMAIN_CODES.includes(domainCode as TaxonomyRulebookDomainCode)) {
    throw new Error(`Unsupported taxonomy rulebook domain: ${domainCode}`)
  }
}

function ensureRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }

  return value as Record<string, unknown>
}

function ensureString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${label} must be non-empty`)
  }

  return trimmed
}

function ensurePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`)
  }

  return value
}

function ensureArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }

  return value
}

function readJsonFile(filePath: string, label: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`)
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`${label} parse failed: ${(error as Error).message}`)
  }
}

function getCanonicalTaxonomyL2Codes(): Set<string> {
  if (canonicalL2CodeCache) {
    return canonicalL2CodeCache
  }

  const seed = readJsonFile(TAXONOMY_SEED_PATH, 'taxonomy seed') as TaxonomySeedFile
  canonicalL2CodeCache = new Set(
    ensureArray(seed.l2, 'taxonomy seed l2')
      .map((row) => ensureRecord(row, 'taxonomy seed row'))
      .map((row) => ensureString(row.l2Code, 'taxonomy seed l2Code')),
  )
  return canonicalL2CodeCache
}

function ensureCanonicalL2Code(
  l2Code: string,
  domainCode: TaxonomyRulebookDomainCode,
  label: string,
): string {
  if (!l2Code.startsWith(`${domainCode}-`)) {
    throw new Error(`${label} must belong to ${domainCode}: ${l2Code}`)
  }

  if (!getCanonicalTaxonomyL2Codes().has(l2Code)) {
    throw new Error(`${label} not found in canonical taxonomy catalog: ${l2Code}`)
  }

  return l2Code
}

function validateMatcherDescriptor(
  value: unknown,
  label: string,
): TaxonomyRulebookMatcherDescriptor {
  const matcher = ensureRecord(value, label)
  const type = ensureString(matcher.type, `${label}.type`)

  if (type === 'literal') {
    return {
      type,
      value: ensureString(matcher.value, `${label}.value`),
    }
  }

  if (type === 'regex') {
    const source = ensureString(matcher.source, `${label}.source`)
    const flags =
      matcher.flags === undefined ? undefined : ensureString(matcher.flags, `${label}.flags`)

    try {
      new RegExp(source, flags)
    } catch (error) {
      throw new Error(`${label} contains invalid regex: ${(error as Error).message}`)
    }

    return {
      type,
      source,
      ...(flags ? { flags } : {}),
    }
  }

  throw new Error(`${label}.type must be one of: literal, regex`)
}

function validateManifestSignal(value: unknown, label: string): TaxonomyRulebookManifestSignal {
  const signal = ensureRecord(value, label)
  const matchers = ensureArray(signal.matchers, `${label}.matchers`).map((entry, index) =>
    validateMatcherDescriptor(entry, `${label}.matchers[${index}]`),
  )

  if (matchers.length === 0) {
    throw new Error(`${label}.matchers must contain at least one matcher`)
  }

  const regexFlags = Array.from(
    new Set(
      matchers
        .filter(
          (matcher): matcher is Extract<TaxonomyRulebookMatcherDescriptor, { type: 'regex' }> =>
            matcher.type === 'regex',
        )
        .map((matcher) => matcher.flags ?? ''),
    ),
  )

  for (const flags of regexFlags) {
    if (/[gy]/.test(flags)) {
      throw new Error(`${label}.matchers contains unsupported stateful regex flags: ${flags}`)
    }
  }

  if (regexFlags.length > 1) {
    throw new Error(
      `${label}.matchers contains mixed regex flags and cannot be merged safely: ${regexFlags.join(
        ', ',
      )}`,
    )
  }

  return {
    label: ensureString(signal.label, `${label}.label`),
    weight: ensurePositiveNumber(signal.weight, `${label}.weight`),
    matchers,
  }
}

function validateManifestEntry(
  value: unknown,
  domainCode: TaxonomyRulebookDomainCode,
  label: string,
): TaxonomyRulebookManifestEntry {
  const entry = ensureRecord(value, label)
  const signals = ensureArray(entry.signals, `${label}.signals`).map((signal, index) =>
    validateManifestSignal(signal, `${label}.signals[${index}]`),
  )

  if (signals.length === 0) {
    throw new Error(`${label}.signals must contain at least one signal`)
  }

  const duplicateLabels = new Set<string>()
  for (const signal of signals) {
    if (duplicateLabels.has(signal.label)) {
      throw new Error(`${label}.signals contains duplicate label: ${signal.label}`)
    }
    duplicateLabels.add(signal.label)
  }

  return {
    l2Code: ensureCanonicalL2Code(
      ensureString(entry.l2Code, `${label}.l2Code`),
      domainCode,
      `${label}.l2Code`,
    ),
    signals,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildVersionPattern(domainCode: TaxonomyRulebookDomainCode): RegExp {
  return new RegExp(`^${domainCode.toLowerCase()}-rulebook-v\\d+$`)
}

export function getRulebookManifestPath(domainCode: TaxonomyRulebookDomainCode): string {
  return path.resolve(MANIFEST_DIR, `${domainCode.toLowerCase()}.rulebook.json`)
}

export function validateRulebookManifest(
  value: unknown,
  expectedDomainCode?: TaxonomyRulebookDomainCode,
): TaxonomyRulebookManifest {
  const manifest = ensureRecord(value, 'rulebook manifest')
  const l1Code = ensureString(manifest.l1Code, 'rulebook manifest.l1Code')

  assertDomainCode(l1Code)
  if (expectedDomainCode && l1Code !== expectedDomainCode) {
    throw new Error(
      `rulebook manifest.l1Code mismatch: expected ${expectedDomainCode}, received ${l1Code}`,
    )
  }

  const version = ensureString(manifest.version, 'rulebook manifest.version')
  if (!buildVersionPattern(l1Code).test(version)) {
    throw new Error(`rulebook manifest.version must follow ${l1Code.toLowerCase()}-rulebook-vN`)
  }

  const fallbackBucket = ensureCanonicalL2Code(
    ensureString(manifest.fallbackBucket, 'rulebook manifest.fallbackBucket'),
    l1Code,
    'rulebook manifest.fallbackBucket',
  )
  const entries = ensureArray(manifest.entries, 'rulebook manifest.entries').map((entry, index) =>
    validateManifestEntry(entry, l1Code, `rulebook manifest.entries[${index}]`),
  )

  if (entries.length === 0) {
    throw new Error('rulebook manifest.entries must contain at least one entry')
  }

  const duplicateEntryL2Codes = new Set<string>()
  for (const entry of entries) {
    if (duplicateEntryL2Codes.has(entry.l2Code)) {
      throw new Error(`Duplicate manifest entry l2Code: ${entry.l2Code}`)
    }
    duplicateEntryL2Codes.add(entry.l2Code)
  }

  if (!entries.some((entry) => entry.l2Code === fallbackBucket)) {
    throw new Error(
      `rulebook manifest fallbackBucket entry missing from manifest entries: ${fallbackBucket}`,
    )
  }

  return {
    l1Code,
    version,
    fallbackBucket,
    entries,
  }
}

function compileSignalPattern(matchers: TaxonomyRulebookMatcherDescriptor[]): RegExp {
  const sources = matchers.map((matcher) =>
    matcher.type === 'literal' ? escapeRegExp(matcher.value) : matcher.source,
  )
  const flags = Array.from(
    new Set(
      matchers
        .filter(
          (matcher): matcher is Extract<TaxonomyRulebookMatcherDescriptor, { type: 'regex' }> =>
            matcher.type === 'regex' && matcher.flags !== undefined,
        )
        .flatMap((matcher) => matcher.flags?.split('') ?? []),
    ),
  ).join('')

  return new RegExp(sources.join('|'), flags)
}

function compileManifestSignal(signal: TaxonomyRulebookManifestSignal): TaxonomyRuleSignal {
  return {
    label: signal.label,
    weight: signal.weight,
    pattern: compileSignalPattern(signal.matchers),
  }
}

export function compileRulebookManifest(manifest: TaxonomyRulebookManifest): TaxonomyRulebook {
  return {
    l1Code: manifest.l1Code,
    version: manifest.version,
    fallbackBucket: manifest.fallbackBucket,
    entries: manifest.entries.map((entry) => ({
      l2Code: entry.l2Code,
      signals: entry.signals.map(compileManifestSignal),
    })),
  }
}

export function loadRulebookManifest(
  domainCode: TaxonomyRulebookDomainCode,
): TaxonomyRulebookManifest {
  const cached = manifestCache.get(domainCode)
  if (cached) {
    return cached
  }

  const manifest = validateRulebookManifest(
    readJsonFile(getRulebookManifestPath(domainCode), `rulebook manifest ${domainCode}`),
    domainCode,
  )
  manifestCache.set(domainCode, manifest)
  return manifest
}

export function loadCompiledRulebook(domainCode: TaxonomyRulebookDomainCode): TaxonomyRulebook {
  const cached = compiledCache.get(domainCode)
  if (cached) {
    return cached
  }

  const compiled = compileRulebookManifest(loadRulebookManifest(domainCode))
  compiledCache.set(domainCode, compiled)
  return compiled
}

export function loadAllRulebookManifests(): Record<
  TaxonomyRulebookDomainCode,
  TaxonomyRulebookManifest
> {
  return TAXONOMY_RULEBOOK_DOMAIN_CODES.reduce(
    (accumulator, domainCode) => {
      accumulator[domainCode] = loadRulebookManifest(domainCode)
      return accumulator
    },
    {} as Record<TaxonomyRulebookDomainCode, TaxonomyRulebookManifest>,
  )
}

export function loadAllCompiledRulebooks(): Record<TaxonomyRulebookDomainCode, TaxonomyRulebook> {
  return TAXONOMY_RULEBOOK_DOMAIN_CODES.reduce(
    (accumulator, domainCode) => {
      accumulator[domainCode] = loadCompiledRulebook(domainCode)
      return accumulator
    },
    {} as Record<TaxonomyRulebookDomainCode, TaxonomyRulebook>,
  )
}
