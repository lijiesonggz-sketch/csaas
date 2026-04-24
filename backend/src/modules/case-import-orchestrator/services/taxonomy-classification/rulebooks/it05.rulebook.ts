import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT05_RULEBOOK_VERSION = 'it05-rulebook-v1'

export const IT05_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT05',
  version: IT05_RULEBOOK_VERSION,
  fallbackBucket: 'IT05-01',
  entries: [
    {
      l2Code: 'IT05-02',
      signals: [
        keywordSignal('准入尽调不足', 5, ['准入尽职调查', '尽职调查', '准入尽调', '供应商管理不到位']),
        keywordSignal('日常监督不到位', 4, ['日常监督不到位', /日常监督.*不到位/, '考核管理不到位', /考核管理.*不到位/]),
      ],
    },
    {
      l2Code: 'IT05-03',
      signals: [
        keywordSignal('外包导致安全事件', 5, ['外包导致', '网络安全事件']),
        keywordSignal('外包运营风险', 4, ['运营风险事件', '外包安全事件']),
      ],
    },
    {
      l2Code: 'IT05-01',
      signals: [
        keywordSignal('外包管理不审慎', 3, ['信息科技外包', '外包管理不审慎']),
        keywordSignal('外包服务管理', 3, ['外包服务', '外包管理']),
      ],
    },
  ],
}
