import type {
  TaxonomyDomainProfile,
  TaxonomyRulebook,
} from '../contracts/classification-result.contract'

export const IT04_RULEBOOK_VERSION = 'it04-rulebook-v1'
export const IT04_FALLBACK_BUCKET_CODE = 'IT04-05'

export const IT04_DOMAIN_PROFILE: TaxonomyDomainProfile = {
  l1Code: 'IT04',
  primaryThreshold: 4,
  semanticThreshold: 6,
  minimumScoreGap: 2,
  minimumPhraseHits: 1,
  scoreGapStrategy: 'default',
  fallbackBucketCode: IT04_FALLBACK_BUCKET_CODE,
  rulebookVersion: IT04_RULEBOOK_VERSION,
}

export const IT04_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT04',
  version: IT04_RULEBOOK_VERSION,
  fallbackBucketCode: IT04_FALLBACK_BUCKET_CODE,
  entries: [
    {
      l2Code: 'IT04-07',
      signals: [
        { label: '未按时报送', pattern: /未按时报送|未按期报送/, weight: 5 },
        { label: '迟报未报', pattern: /迟报|未报|漏报/, weight: 4 },
        { label: '超期逾期', pattern: /超期|逾期/, weight: 4 },
        { label: '截止时点', pattern: /截止时间|截止日|截止时点/, weight: 4 },
        { label: '时效预警', pattern: /时效监控|时效预警|催办|升级机制|提醒机制/, weight: 4 },
        { label: '科技监管台账', pattern: /台账报送|科技监管类报表|非现场监管报表/, weight: 3 },
      ],
    },
    {
      l2Code: 'IT04-04',
      signals: [
        { label: '数据质量不符合规范', pattern: /数据质量不符合规范|数据质量问题/, weight: 5 },
        { label: '自动化校验', pattern: /自动化数据质量校验|数据质量校验规则|自动化校验|质检/, weight: 5 },
        { label: '阻断异常', pattern: /阻断异常报送|异常字段|关键字段缺失|字段偏差/, weight: 4 },
        { label: '口径错误', pattern: /口径错误|格式错误/, weight: 4 },
      ],
    },
    {
      l2Code: 'IT04-06',
      signals: [
        { label: '账表核对', pattern: /账表核对|账表不一致|账实不符/, weight: 5 },
        { label: '总分账勾稽', pattern: /总账|分账|勾稽|账簿/, weight: 4 },
        {
          label: '系统间不一致',
          pattern: /系统间数据不一致|源系统.*不一致|基础数据不一致|对账差异/,
          weight: 5,
        },
        { label: '一致性追溯', pattern: /一致性校验|来源一致性|无法追溯/, weight: 4 },
      ],
    },
    {
      l2Code: 'IT04-08',
      signals: [
        { label: '整改不到位', pattern: /整改不到位|整改未执行|整改方案未落实/, weight: 5 },
        { label: '整改闭环', pattern: /整改闭环|关闭验证|闭环验证缺失/, weight: 5 },
        { label: '历史问题', pattern: /历史问题|历史数据问题|既往.*问题/, weight: 4 },
        { label: '屡查屡犯', pattern: /屡查屡犯|反复发生/, weight: 5 },
        { label: '整改跟踪', pattern: /整改跟踪|整改台账|关闭证明/, weight: 4 },
      ],
    },
    {
      l2Code: 'IT04-10',
      signals: [
        { label: '登记录入更新', pattern: /信息登记|登记信息|录入|补录|更新|维护/, weight: 4 },
        { label: '更新不及时', pattern: /不及时不规范|更新不及时|录入不及时|维护不及时|补录超期/, weight: 5 },
        { label: '业务信息', pattern: /业务信息|投保信息/, weight: 4 },
      ],
    },
    {
      l2Code: 'IT04-11',
      signals: [
        { label: '虚假报送', pattern: /虚假报表|虚假报告|虚假资料|虚假记载/, weight: 5 },
        { label: '数据造假', pattern: /数据造假|人为数据造假|虚假填报/, weight: 5 },
        { label: '真实性审核', pattern: /真实性审核|真实性抽查|真实性/, weight: 4 },
        { label: '人工调整', pattern: /人工调整/, weight: 4 },
        { label: '严重失真', pattern: /严重失真|严重偏离|与实际严重偏离/, weight: 5 },
      ],
    },
    {
      l2Code: 'IT04-03',
      signals: [
        { label: 'EAST错报漏报', pattern: /EAST.*错报|EAST.*漏报|EAST.*报送不实/, weight: 5 },
        { label: '口径配置变更', pattern: /口径定义错误|参数配置|配置变更/, weight: 4 },
        { label: 'EAST报送', pattern: /EAST报送|监管标准化数据EAST/, weight: 3 },
      ],
    },
    {
      l2Code: IT04_FALLBACK_BUCKET_CODE,
      signals: [
        { label: '监管报表', pattern: /监管报表|监管系统报送/, weight: 3 },
        { label: '统计差错', pattern: /统计数据错报|与事实不符|报送数据不准确/, weight: 3 },
        { label: '双人复核', pattern: /双人复核|复核缺失/, weight: 2 },
      ],
    },
  ],
}
