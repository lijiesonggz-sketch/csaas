import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT07_RULEBOOK_VERSION = 'it07-rulebook-v1'

export const IT07_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT07',
  version: IT07_RULEBOOK_VERSION,
  fallbackBucket: 'IT07-01',
  entries: [
    {
      l2Code: 'IT07-06',
      signals: [
        keywordSignal('后台修改数据', 5, ['后台修改', '核心业务系统数据']),
        keywordSignal('绕过前台控制', 5, ['绕过前台控制', '篡改']),
      ],
    },
    {
      l2Code: 'IT07-07',
      signals: [
        keywordSignal('数据中心风险', 4, ['数据中心', '机房']),
        keywordSignal('基础设施隐患', 4, ['基础设施风险', '消防']),
      ],
    },
    {
      l2Code: 'IT07-01',
      signals: [
        keywordSignal('运行管理漏洞', 3, ['运行管理漏洞', '值守不到位']),
        keywordSignal('巡检处置不足', 3, ['巡检不到位', '监控不到位']),
      ],
    },
  ],
}
