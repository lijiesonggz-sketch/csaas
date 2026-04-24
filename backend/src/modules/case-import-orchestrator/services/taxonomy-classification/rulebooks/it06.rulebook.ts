import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT06_RULEBOOK_VERSION = 'it06-rulebook-v1'

export const IT06_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT06',
  version: IT06_RULEBOOK_VERSION,
  fallbackBucket: 'IT06-05',
  entries: [
    {
      l2Code: 'IT06-03',
      signals: [
        keywordSignal('投产上线失控', 5, ['投产上线', '上线审批']),
        keywordSignal('变更控制缺失', 5, ['变更审批', '回退控制', '发布管理']),
      ],
    },
    {
      l2Code: 'IT06-04',
      signals: [
        keywordSignal('重大架构变更', 5, ['重大架构变更', '网络架构重大变更']),
        keywordSignal('变更评估缺失', 4, ['未开展评估', '未报监管']),
      ],
    },
    {
      l2Code: 'IT06-05',
      signals: [
        keywordSignal('系统建设不足', 3, ['系统建设不到位', '系统能力建设不足']),
        keywordSignal('制度建设不足', 3, ['制度建设不足', '信息系统建设不到位']),
      ],
    },
  ],
}
