import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT06_RULEBOOK_MANIFEST = loadRulebookManifest('IT06')
export const IT06_RULEBOOK_VERSION = IT06_RULEBOOK_MANIFEST.version

export const IT06_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT06_RULEBOOK_MANIFEST)
