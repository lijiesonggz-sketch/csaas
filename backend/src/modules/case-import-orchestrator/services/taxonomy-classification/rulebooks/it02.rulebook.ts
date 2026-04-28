import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { compileRulebookManifest, loadRulebookManifest } from './rulebook-manifest.loader'

const IT02_RULEBOOK_MANIFEST = loadRulebookManifest('IT02')
export const IT02_RULEBOOK_VERSION = IT02_RULEBOOK_MANIFEST.version

export const IT02_RULEBOOK: TaxonomyRulebook = compileRulebookManifest(IT02_RULEBOOK_MANIFEST)
