import type { TaxonomyRulebook } from '../contracts/classification-result.contract'
import { keywordSignal } from './rule-signal.utils'

export const IT04_RULEBOOK_VERSION = 'it04-rulebook-v1'
export const IT04_FALLBACK_BUCKET = 'IT04-05'

export const IT04_RULEBOOK: TaxonomyRulebook = {
  l1Code: 'IT04',
  version: IT04_RULEBOOK_VERSION,
  fallbackBucket: IT04_FALLBACK_BUCKET,
  entries: [
    {
      l2Code: 'IT04-07',
      signals: [
        keywordSignal('未按时报送', 5, ['未按时报送', '未按期报送']),
        keywordSignal('迟报未报', 4, ['迟报', '未报', '漏报']),
        keywordSignal('超期逾期', 4, ['超期', '逾期']),
        keywordSignal('截止时点', 4, ['截止时间', '截止日', '截止时点']),
        keywordSignal('时效预警', 4, ['时效监控', '时效预警', '催办', '升级机制', '提醒机制']),
        keywordSignal('科技监管台账', 3, ['台账报送', '科技监管类报表', '非现场监管报表']),
      ],
    },
    {
      l2Code: 'IT04-04',
      signals: [
        keywordSignal('数据质量不符合规范', 5, ['数据质量不符合规范', '数据质量问题']),
        keywordSignal('自动化校验', 5, ['自动化数据质量校验', '数据质量校验规则', '自动化校验', '质检']),
        keywordSignal('阻断异常', 4, ['阻断异常报送', '异常字段', '关键字段缺失', '字段偏差']),
        keywordSignal('口径错误', 4, ['口径错误', '格式错误']),
      ],
    },
    {
      l2Code: 'IT04-06',
      signals: [
        keywordSignal('账表核对', 5, ['账表核对', '账表不一致', '账实不符']),
        keywordSignal('总分账勾稽', 4, ['总账', '分账', '勾稽', '账簿']),
        keywordSignal('系统间不一致', 5, [
          '系统间数据不一致',
          '基础数据不一致',
          '对账差异',
          /源系统.*不一致/,
        ]),
        keywordSignal('一致性追溯', 4, ['一致性校验', '来源一致性', '无法追溯']),
      ],
    },
    {
      l2Code: 'IT04-08',
      signals: [
        keywordSignal('整改不到位', 5, ['整改不到位', '整改未执行', '整改方案未落实']),
        keywordSignal('整改闭环', 5, ['整改闭环', '关闭验证', '闭环验证缺失']),
        keywordSignal('历史问题', 4, ['历史问题', '历史数据问题', /既往.*问题/]),
        keywordSignal('屡查屡犯', 5, ['屡查屡犯', '反复发生']),
        keywordSignal('整改跟踪', 4, ['整改跟踪', '整改台账', '关闭证明']),
      ],
    },
    {
      l2Code: 'IT04-10',
      signals: [
        keywordSignal('登记录入更新', 4, ['信息登记', '登记信息', '录入', '补录', '更新', '维护']),
        keywordSignal('更新不及时', 5, ['不及时不规范', '更新不及时', '录入不及时', '维护不及时', '补录超期']),
        keywordSignal('业务信息', 4, ['业务信息', '投保信息']),
      ],
    },
    {
      l2Code: 'IT04-11',
      signals: [
        keywordSignal('虚假报送', 5, ['虚假报表', '虚假报告', '虚假资料', '虚假记载']),
        keywordSignal('数据造假', 5, ['数据造假', '人为数据造假', '虚假填报']),
        keywordSignal('真实性审核', 4, ['真实性审核', '真实性抽查', '真实性']),
        keywordSignal('人工调整', 4, ['人工调整']),
        keywordSignal('严重失真', 5, ['严重失真', '严重偏离', '与实际严重偏离']),
      ],
    },
    {
      l2Code: 'IT04-03',
      signals: [
        keywordSignal('EAST错报漏报', 5, [/EAST.*错报/, /EAST.*漏报/, /EAST.*报送不实/]),
        keywordSignal('口径配置变更', 4, ['口径定义错误', '参数配置', '配置变更']),
        keywordSignal('EAST报送', 3, ['EAST报送', '监管标准化数据EAST']),
      ],
    },
    {
      l2Code: IT04_FALLBACK_BUCKET,
      signals: [
        keywordSignal('监管报表', 3, ['监管报表', '监管系统报送']),
        keywordSignal('统计差错', 3, ['统计数据错报', '与事实不符', '报送数据不准确']),
        keywordSignal('双人复核', 2, ['双人复核', '复核缺失']),
      ],
    },
  ],
}
