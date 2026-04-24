export const TAXONOMY_CLASSIFIER_AUTOMATE_MISSING_MAPPING_PATH =
  'docs/it-taxonomy-to-kg-semantic-mapping-missing-2026-04-07.csv'

export const TAXONOMY_CLASSIFIER_AUTOMATE_MALFORMED_CSV = [
  '一级编码,一级类型,二级编码,二级子类型,定义口径,建议canonicalTheme,建议aliases,建议keywords',
  'IT04,"数据治理与监管数据报送,IT04-10,信息登记/录入/更新不及时不规范,broken row',
].join('\n')

export const TAXONOMY_CLASSIFIER_AUTOMATE_ENGINE_ERROR_RESULT = {
  l1Code: 'IT04',
  l2Code: null,
  l2Name: null,
  score: 0,
  confidenceScore: 0,
  scoreGap: 0,
  decisionSource: 'none' as const,
  matchedSignals: [],
  matchedPhrases: [],
  matchedTokens: [],
  classifierVersion: 'taxonomy-classifier-6.1',
  mappingVersion: '2026-04-07',
  rulebookVersion: 'it04-rulebook-v1',
  classifiedAt: '2026-04-24T17:00:00.000Z',
  pathDecision: 'UNCLASSIFIED' as const,
  failureSemantics: 'ENGINE_ERROR' as const,
}

export const TAXONOMY_CLASSIFIER_AUTOMATE_UNSUPPORTED_DOMAIN_RESULT = {
  l1Code: 'IT08',
  l2Code: null,
  l2Name: null,
  score: 0,
  confidenceScore: 0,
  scoreGap: 0,
  decisionSource: 'none' as const,
  matchedSignals: [],
  matchedPhrases: [],
  matchedTokens: [],
  classifierVersion: 'taxonomy-classifier-6.1',
  mappingVersion: '2026-04-07',
  rulebookVersion: 'unconfigured',
  classifiedAt: '2026-04-24T17:00:00.000Z',
  pathDecision: 'UNCLASSIFIED' as const,
  failureSemantics: 'UNSUPPORTED_DOMAIN' as const,
}
