import { IT04_RULEBOOK_VERSION } from '../rulebooks/it04.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT04_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT04',
  fallbackBucket: 'IT04-05',
  primaryThreshold: 4,
  semanticThreshold: 6,
  minimumScoreGap: 2,
  minimumPhraseHits: 1,
  rulebookVersion: IT04_RULEBOOK_VERSION,
})
