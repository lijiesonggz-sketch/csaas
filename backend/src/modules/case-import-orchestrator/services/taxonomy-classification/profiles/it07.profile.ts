import { IT07_RULEBOOK_VERSION } from '../rulebooks/it07.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT07_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT07',
  fallbackBucket: 'IT07-01',
  primaryThreshold: 5,
  semanticThreshold: 6,
  minimumScoreGap: 2,
  minimumPhraseHits: 1,
  rulebookVersion: IT07_RULEBOOK_VERSION,
})
