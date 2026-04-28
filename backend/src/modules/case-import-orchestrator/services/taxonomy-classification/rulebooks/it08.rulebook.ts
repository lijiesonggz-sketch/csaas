import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT08_RULEBOOK_MANIFEST = loadRulebookManifest('IT08')
export const IT08_RULEBOOK_VERSION = IT08_RULEBOOK_MANIFEST.version

export const IT08_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT08_RULEBOOK_MANIFEST)
