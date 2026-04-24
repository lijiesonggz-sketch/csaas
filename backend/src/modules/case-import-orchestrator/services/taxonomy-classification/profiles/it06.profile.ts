import { IT06_RULEBOOK_VERSION } from '../rulebooks/it06.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT06_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT06',
  fallbackBucket: 'IT06-05',
  primaryThreshold: 5,
  semanticThreshold: 5.5,
  minimumScoreGap: 1.5,
  minimumPhraseHits: 1,
  rulebookVersion: IT06_RULEBOOK_VERSION,
})
