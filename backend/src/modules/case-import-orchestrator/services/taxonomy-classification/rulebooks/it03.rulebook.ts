import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT03_RULEBOOK_MANIFEST = loadRulebookManifest('IT03')
export const IT03_RULEBOOK_VERSION = IT03_RULEBOOK_MANIFEST.version

export const IT03_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT03_RULEBOOK_MANIFEST)
