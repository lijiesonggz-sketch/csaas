export const TAXONOMY_RULEBOOK_DOMAIN_CODES = [
  'IT01',
  'IT02',
  'IT03',
  'IT04',
  'IT05',
  'IT06',
  'IT07',
  'IT08',
] as const

export type TaxonomyRulebookDomainCode = (typeof TAXONOMY_RULEBOOK_DOMAIN_CODES)[number]

export type TaxonomyRulebookMatcherDescriptor =
  | {
      type: 'literal'
      value: string
    }
  | {
      type: 'regex'
      source: string
      flags?: string
    }

export type TaxonomyRulebookManifestSignal = {
  label: string
  weight: number
  matchers: TaxonomyRulebookMatcherDescriptor[]
}

export type TaxonomyRulebookManifestEntry = {
  l2Code: string
  signals: TaxonomyRulebookManifestSignal[]
}

export type TaxonomyRulebookManifest = {
  l1Code: TaxonomyRulebookDomainCode
  version: string
  fallbackBucket: string
  entries: TaxonomyRulebookManifestEntry[]
}
