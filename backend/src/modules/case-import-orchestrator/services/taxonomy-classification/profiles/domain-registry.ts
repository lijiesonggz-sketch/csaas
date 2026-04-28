import type {
  TaxonomyDomainProfile,
  TaxonomyDomainReadiness,
  TaxonomyDomainRegistryEntry,
  TaxonomyRulebook,
} from '../contracts/classification-result.contract'
import { IT01_DOMAIN_PROFILE } from './it01.profile'
import { IT02_DOMAIN_PROFILE } from './it02.profile'
import { IT03_DOMAIN_PROFILE } from './it03.profile'
import { IT04_DOMAIN_PROFILE } from './it04.profile'
import { IT05_DOMAIN_PROFILE } from './it05.profile'
import { IT06_DOMAIN_PROFILE } from './it06.profile'
import { IT07_DOMAIN_PROFILE } from './it07.profile'
import { IT08_DOMAIN_PROFILE } from './it08.profile'
import { buildDomainReadiness } from './profile.helpers'
import { loadAllCompiledRulebooks } from '../rulebooks/rulebook-manifest.loader'
import {
  TAXONOMY_RULEBOOK_DOMAIN_CODES,
  type TaxonomyRulebookDomainCode,
} from '../rulebooks/rulebook-manifest.types'

const DEFAULT_PROFILES: Record<TaxonomyRulebookDomainCode, TaxonomyDomainProfile> = {
  IT01: IT01_DOMAIN_PROFILE,
  IT02: IT02_DOMAIN_PROFILE,
  IT03: IT03_DOMAIN_PROFILE,
  IT04: IT04_DOMAIN_PROFILE,
  IT05: IT05_DOMAIN_PROFILE,
  IT06: IT06_DOMAIN_PROFILE,
  IT07: IT07_DOMAIN_PROFILE,
  IT08: IT08_DOMAIN_PROFILE,
}

const DEFAULT_RULEBOOKS: Record<TaxonomyRulebookDomainCode, TaxonomyRulebook> =
  loadAllCompiledRulebooks()

const DEFAULT_READINESS: Record<TaxonomyRulebookDomainCode, TaxonomyDomainReadiness> = {
  IT01: buildDomainReadiness('IT01'),
  IT02: buildDomainReadiness('IT02'),
  IT03: buildDomainReadiness('IT03'),
  IT04: buildDomainReadiness('IT04'),
  IT05: buildDomainReadiness('IT05'),
  IT06: buildDomainReadiness('IT06'),
  IT07: buildDomainReadiness('IT07'),
  IT08: buildDomainReadiness('IT08'),
}

type TaxonomyDomainRegistryOverrides = {
  profiles?: Partial<Record<TaxonomyRulebookDomainCode, TaxonomyDomainProfile>>
  rulebooks?: Partial<Record<TaxonomyRulebookDomainCode, TaxonomyRulebook>>
  readiness?: Partial<Record<TaxonomyRulebookDomainCode, TaxonomyDomainReadiness>>
}

function validateTaxonomyDomainRegistryEntry(
  l1Code: string,
  entry: TaxonomyDomainRegistryEntry,
): void {
  if (
    entry.profile.l1Code !== entry.rulebook.l1Code ||
    entry.profile.rulebookVersion !== entry.rulebook.version ||
    entry.profile.fallbackBucket !== entry.rulebook.fallbackBucket
  ) {
    throw new Error(`Invalid taxonomy registry entry: ${l1Code}`)
  }
}

export function createTaxonomyDomainRegistry(
  overrides: TaxonomyDomainRegistryOverrides = {},
): Record<TaxonomyRulebookDomainCode, TaxonomyDomainRegistryEntry> {
  return TAXONOMY_RULEBOOK_DOMAIN_CODES.reduce(
    (accumulator, l1Code) => {
      const entry: TaxonomyDomainRegistryEntry = {
        profile: overrides.profiles?.[l1Code] ?? DEFAULT_PROFILES[l1Code],
        rulebook: overrides.rulebooks?.[l1Code] ?? DEFAULT_RULEBOOKS[l1Code],
        readiness: overrides.readiness?.[l1Code] ?? DEFAULT_READINESS[l1Code],
      }

      validateTaxonomyDomainRegistryEntry(l1Code, entry)
      accumulator[l1Code] = entry
      return accumulator
    },
    {} as Record<TaxonomyRulebookDomainCode, TaxonomyDomainRegistryEntry>,
  )
}

export const TAXONOMY_DOMAIN_REGISTRY = createTaxonomyDomainRegistry()

export function getTaxonomyDomainRegistryEntry(
  l1Code?: string | null,
): TaxonomyDomainRegistryEntry | null {
  if (!l1Code) {
    return null
  }

  const entry = TAXONOMY_DOMAIN_REGISTRY[l1Code] ?? null
  if (!entry) {
    return null
  }

  validateTaxonomyDomainRegistryEntry(l1Code, entry)
  return entry
}

export function listRuntimeReadyTaxonomyDomainCodes(): string[] {
  return Object.entries(TAXONOMY_DOMAIN_REGISTRY)
    .filter(([, entry]) => entry.readiness.stage === 'runtime-classifier-ready')
    .map(([l1Code]) => l1Code)
}
