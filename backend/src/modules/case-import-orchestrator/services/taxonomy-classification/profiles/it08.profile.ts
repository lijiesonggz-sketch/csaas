import { IT08_RULEBOOK_VERSION } from '../rulebooks/it08.rulebook'
import { buildDomainProfile } from './profile.helpers'

export const IT08_DOMAIN_PROFILE = buildDomainProfile({
  l1Code: 'IT08',
  fallbackBucket: 'IT08-01',
  primaryThreshold: 5,
  semanticThreshold: 6,
  minimumScoreGap: 2,
  minimumPhraseHits: 1,
  rulebookVersion: IT08_RULEBOOK_VERSION,
})
