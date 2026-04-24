export const TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT =
  '监管登记信息补录和更新没有时效监控，补录超期且无人催办，导致信息更新不及时不规范。'

export const TAXONOMY_CLASSIFIER_ATDD_CASE = {
  caseId: 'case-6-1-atdd',
  importBatchId: 'batch-6-1-atdd',
  status: 'pending',
  caseFacts: '监管登记信息补录和更新没有时效监控，补录超期且无人催办。',
  penaltyReason: '导致信息更新不及时不规范。',
}

export const TAXONOMY_CLASSIFIER_ATDD_NORMALIZED_INPUT = {
  rawText: TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT,
  caseFacts: TAXONOMY_CLASSIFIER_ATDD_CASE.caseFacts,
  penaltyReason: TAXONOMY_CLASSIFIER_ATDD_CASE.penaltyReason,
  mergedText: TAXONOMY_CLASSIFIER_ATDD_SOURCE_TEXT,
  normalizedText: '监管登记信息补录和更新没有时效监控补录超期且无人催办导致信息更新不及时不规范',
  normalizedTokens: ['监管登记', '补录', '更新', '时效监控', '补录超期', '更新不及时'],
  normalizedPhrases: ['登记录入更新', '更新不及时'],
}

export const TAXONOMY_CLASSIFIER_ATDD_EXPECTED_RESULT = {
  l1Code: 'IT04',
  l2Code: 'IT04-10',
  l2Name: '信息登记/录入/更新不及时不规范',
  confidenceScore: 9,
  scoreGap: 5,
  decisionSource: 'rule',
  matchedSignals: ['登记录入更新', '更新不及时'],
  pathDecision: 'PRIMARY_CHAIN',
}

export const TAXONOMY_CLASSIFIER_ATDD_MAPPING_SHAPE = {
  l1Code: 'IT04',
  l1Name: '数据治理与监管数据报送',
  l2Code: 'IT04-10',
  l2Name: '信息登记/录入/更新不及时不规范',
  definition: '投保信息、业务信息、登记信息录入、更新、维护不及时不规范',
  canonicalTheme: '信息登记与更新管理',
  aliases: ['信息登记', '录入更新', '维护及时性'],
  keywords: ['录入不及时', '更新不及时', '补录'],
}

export const TAXONOMY_CLASSIFIER_ATDD_INVALID_MAPPING_CSV = [
  '一级编码,一级类型,二级编码',
  'IT04,数据治理与监管数据报送,IT04-10',
].join('\n')
