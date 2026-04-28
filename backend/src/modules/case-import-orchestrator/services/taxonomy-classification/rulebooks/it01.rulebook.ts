import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT01_RULEBOOK_MANIFEST = loadRulebookManifest('IT01')
export const IT01_RULEBOOK_VERSION = IT01_RULEBOOK_MANIFEST.version

export const IT01_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT01_RULEBOOK_MANIFEST)
