import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT05_RULEBOOK_MANIFEST = loadRulebookManifest('IT05')
export const IT05_RULEBOOK_VERSION = IT05_RULEBOOK_MANIFEST.version

export const IT05_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT05_RULEBOOK_MANIFEST)
