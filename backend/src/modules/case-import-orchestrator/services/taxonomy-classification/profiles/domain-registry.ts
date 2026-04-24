import type { TaxonomyDomainRegistryEntry } from '../contracts/classification-result.contract'
import { IT01_DOMAIN_PROFILE } from './it01.profile'
import { IT02_DOMAIN_PROFILE } from './it02.profile'
import { IT03_DOMAIN_PROFILE } from './it03.profile'
import { IT04_DOMAIN_PROFILE } from './it04.profile'
import { IT05_DOMAIN_PROFILE } from './it05.profile'
import { IT06_DOMAIN_PROFILE } from './it06.profile'
import { IT07_DOMAIN_PROFILE } from './it07.profile'
import { IT08_DOMAIN_PROFILE } from './it08.profile'
import { buildDomainReadiness } from './profile.helpers'
import { IT01_RULEBOOK } from '../rulebooks/it01.rulebook'
import { IT02_RULEBOOK } from '../rulebooks/it02.rulebook'
import { IT03_RULEBOOK } from '../rulebooks/it03.rulebook'
import { IT04_RULEBOOK } from '../rulebooks/it04.rulebook'
import { IT05_RULEBOOK } from '../rulebooks/it05.rulebook'
import { IT06_RULEBOOK } from '../rulebooks/it06.rulebook'
import { IT07_RULEBOOK } from '../rulebooks/it07.rulebook'
import { IT08_RULEBOOK } from '../rulebooks/it08.rulebook'

export const TAXONOMY_DOMAIN_REGISTRY: Record<
  string,
  TaxonomyDomainRegistryEntry
> = {
  IT01: {
    profile: IT01_DOMAIN_PROFILE,
    rulebook: IT01_RULEBOOK,
    readiness: buildDomainReadiness('IT01'),
  },
  IT02: {
    profile: IT02_DOMAIN_PROFILE,
    rulebook: IT02_RULEBOOK,
    readiness: buildDomainReadiness('IT02'),
  },
  IT03: {
    profile: IT03_DOMAIN_PROFILE,
    rulebook: IT03_RULEBOOK,
    readiness: buildDomainReadiness('IT03'),
  },
  IT04: {
    profile: IT04_DOMAIN_PROFILE,
    rulebook: IT04_RULEBOOK,
    readiness: buildDomainReadiness('IT04'),
  },
  IT05: {
    profile: IT05_DOMAIN_PROFILE,
    rulebook: IT05_RULEBOOK,
    readiness: buildDomainReadiness('IT05'),
  },
  IT06: {
    profile: IT06_DOMAIN_PROFILE,
    rulebook: IT06_RULEBOOK,
    readiness: buildDomainReadiness('IT06'),
  },
  IT07: {
    profile: IT07_DOMAIN_PROFILE,
    rulebook: IT07_RULEBOOK,
    readiness: buildDomainReadiness('IT07'),
  },
  IT08: {
    profile: IT08_DOMAIN_PROFILE,
    rulebook: IT08_RULEBOOK,
    readiness: buildDomainReadiness('IT08'),
  },
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

for (const [l1Code, entry] of Object.entries(TAXONOMY_DOMAIN_REGISTRY)) {
  validateTaxonomyDomainRegistryEntry(l1Code, entry)
}

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
