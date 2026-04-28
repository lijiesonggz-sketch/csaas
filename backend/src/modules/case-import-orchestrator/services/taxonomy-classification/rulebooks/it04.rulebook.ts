import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT04_RULEBOOK_MANIFEST = loadRulebookManifest('IT04')
export const IT04_RULEBOOK_VERSION = IT04_RULEBOOK_MANIFEST.version
export const IT04_FALLBACK_BUCKET = IT04_RULEBOOK_MANIFEST.fallbackBucket

export const IT04_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT04_RULEBOOK_MANIFEST)
