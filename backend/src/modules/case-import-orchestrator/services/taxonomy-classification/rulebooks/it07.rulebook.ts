import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT07_RULEBOOK_MANIFEST = loadRulebookManifest('IT07')
export const IT07_RULEBOOK_VERSION = IT07_RULEBOOK_MANIFEST.version

export const IT07_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT07_RULEBOOK_MANIFEST)
