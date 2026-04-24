export const TAXONOMY_MULTIDOMAIN_AUTOMATE_RULEBOOK_VARIANTS = [
  {
    id: 'it04-source-system-variance',
    l1Code: 'IT04',
    rawText:
      '报送数据与源系统、中间台账之间不一致，无法追溯来源链路，形成账表不一致问题。',
    expectedL2Code: 'IT04-06',
    expectedDecisionSource: 'rule',
  },
  {
    id: 'it04-historical-issue-variance',
    l1Code: 'IT04',
    rawText:
      '既往 EAST 数据质量问题整改方案长期未落实，历史数据问题整改不到位并重复发生。',
    expectedL2Code: 'IT04-08',
    expectedDecisionSource: 'rule',
  },
  {
    id: 'it04-east-infix-variance',
    l1Code: 'IT04',
    rawText:
      'EAST 监管标准化数据在多张报表之间连续错报，相关字段长期漏报并出现报送不实。',
    expectedL2Code: 'IT04-03',
    expectedDecisionSource: 'rule',
  },
  {
    id: 'it05-shorthand-due-diligence',
    l1Code: 'IT05',
    rawText:
      '外包供应商准入尽调不充分，供应商日常监督和考核管理长期不到位。',
    expectedL2Code: 'IT05-02',
    expectedDecisionSource: 'rule',
  },
] as const

export const TAXONOMY_MULTIDOMAIN_AUTOMATE_LITERAL_PATTERN = 'A+B(监管)'
