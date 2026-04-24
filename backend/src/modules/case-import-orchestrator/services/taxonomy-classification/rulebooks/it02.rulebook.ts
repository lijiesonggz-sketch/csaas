import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT02_RULEBOOK_VERSION = 'it02-rulebook-v1'

export const IT02_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT02',
  version: IT02_RULEBOOK_VERSION,
  fallbackBucket: 'IT02-01',
  entries: [
    {
      l2Code: 'IT02-03',
      signals: [
        keywordSignal('越权访问', 5, ['越权访问', '最小权限']),
        keywordSignal('授权控制不到位', 5, ['授权控制不到位', '账户权限管理']),
      ],
    },
    {
      l2Code: 'IT02-04',
      signals: [
        keywordSignal('网络隔离不到位', 5, ['网络隔离不到位', '边界防护不足']),
        keywordSignal('专网互联网隔离', 4, ['专网与互联网隔离', '区域隔离不充分']),
      ],
    },
    {
      l2Code: 'IT02-01',
      signals: [
        keywordSignal('信息安全管理不足', 3, ['信息安全管理', '安全管理机制']),
        keywordSignal('安全管控缺位', 3, ['安全防护', '管控缺位']),
      ],
    },
  ],
}
