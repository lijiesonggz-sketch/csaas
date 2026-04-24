import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT03_RULEBOOK_VERSION = 'it03-rulebook-v1'

export const IT03_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT03',
  version: IT03_RULEBOOK_VERSION,
  fallbackBucket: 'IT03-05',
  entries: [
    {
      l2Code: 'IT03-02',
      signals: [
        keywordSignal('个人信息泄露', 5, ['个人信息泄露', '非法提供个人信息']),
        keywordSignal('非法查询客户信息', 5, ['非法查询客户信息', '侵犯公民个人信息']),
      ],
    },
    {
      l2Code: 'IT03-06',
      signals: [
        keywordSignal('第三方合作数据安全', 4, ['第三方合作数据安全', '合作机构数据安全']),
        keywordSignal('第三方平台风险', 4, ['第三方平台数据安全', '第三方平台']),
      ],
    },
    {
      l2Code: 'IT03-05',
      signals: [
        keywordSignal('数据分类分级', 3, ['数据分类分级', '数据泄露风险']),
        keywordSignal('脱敏控制不足', 3, ['脱敏', '数据安全管理不到位']),
      ],
    },
  ],
}
