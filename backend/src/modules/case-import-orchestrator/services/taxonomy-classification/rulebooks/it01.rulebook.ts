import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT01_RULEBOOK_VERSION = 'it01-rulebook-v1'

export const IT01_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT01',
  version: IT01_RULEBOOK_VERSION,
  fallbackBucket: 'IT01-01',
  entries: [
    {
      l2Code: 'IT01-02',
      signals: [
        keywordSignal('治理体系不健全', 5, ['治理体系不健全', '制度机制不健全']),
        keywordSignal('职责机制不完善', 4, ['职责机制不完善', '治理架构不完善']),
      ],
    },
    {
      l2Code: 'IT01-03',
      signals: [
        keywordSignal('整改落实不到位', 5, ['整改不到位', '监管意见落实不到位']),
        keywordSignal('屡查屡犯', 4, ['屡查屡犯', '反复发生']),
      ],
    },
    {
      l2Code: 'IT01-01',
      signals: [
        keywordSignal('科技风险管理', 3, ['科技风险管理', '风险管理不审慎']),
        keywordSignal('风险控制不到位', 3, ['风险控制不到位', '操作风险识别']),
      ],
    },
  ],
}
