import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT08_RULEBOOK_VERSION = 'it08-rulebook-v1'

export const IT08_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT08',
  version: IT08_RULEBOOK_VERSION,
  fallbackBucket: 'IT08-01',
  entries: [
    {
      l2Code: 'IT08-05',
      signals: [
        keywordSignal('迟报瞒报', 5, ['迟报', '瞒报', '应报未报']),
        keywordSignal('重大事件上报', 4, ['重大突发事件', '未及时报告']),
      ],
    },
    {
      l2Code: 'IT08-02',
      signals: [
        keywordSignal('灾备建设不足', 5, ['未建灾备', '双活异地灾备不足']),
        keywordSignal('恢复能力不达标', 4, ['恢复能力不达标', '灾难恢复能力不符合']),
      ],
    },
    {
      l2Code: 'IT08-01',
      signals: [
        keywordSignal('业务连续性不足', 3, ['业务连续性', '应急预案']),
        keywordSignal('恢复安排不到位', 3, ['恢复安排不到位', '业务连续性管理不到位']),
      ],
    },
  ],
}
