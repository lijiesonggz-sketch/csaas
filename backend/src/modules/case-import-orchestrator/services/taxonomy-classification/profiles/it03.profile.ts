import { IT03_RULEBOOK_VERSION } from '../rulebooks/it03.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT03_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT03',
  fallbackBucket: 'IT03-05',
  primaryThreshold: 5,
  semanticThreshold: 6,
  minimumScoreGap: 2,
  minimumPhraseHits: 1,
  rulebookVersion: IT03_RULEBOOK_VERSION,
})
