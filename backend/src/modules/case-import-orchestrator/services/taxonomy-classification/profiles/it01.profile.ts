import { IT01_RULEBOOK_VERSION } from '../rulebooks/it01.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT01_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT01',
  fallbackBucket: 'IT01-01',
  primaryThreshold: 4.5,
  semanticThreshold: 6,
  minimumScoreGap: 1.5,
  minimumPhraseHits: 1,
  rulebookVersion: IT01_RULEBOOK_VERSION,
})
