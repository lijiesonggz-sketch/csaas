import { IT05_RULEBOOK_VERSION } from '../rulebooks/it05.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT05_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT05',
  fallbackBucket: 'IT05-01',
  primaryThreshold: 4.5,
  semanticThreshold: 5.5,
  minimumScoreGap: 1.5,
  minimumPhraseHits: 1,
  rulebookVersion: IT05_RULEBOOK_VERSION,
})
