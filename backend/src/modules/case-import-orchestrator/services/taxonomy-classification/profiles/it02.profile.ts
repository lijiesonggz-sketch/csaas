import { IT02_RULEBOOK_VERSION } from '../rulebooks/it02.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT02_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT02',
  fallbackBucket: 'IT02-01',
  primaryThreshold: 5,
  semanticThreshold: 6.5,
  minimumScoreGap: 2,
  minimumPhraseHits: 1,
  rulebookVersion: IT02_RULEBOOK_VERSION,
})
