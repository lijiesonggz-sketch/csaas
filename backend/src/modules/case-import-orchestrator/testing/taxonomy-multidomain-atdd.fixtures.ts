export const TAXONOMY_MULTIDOMAIN_ATDD_CSV_MAPPING_PATH =
  'docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv'

export const TAXONOMY_MULTIDOMAIN_ATDD_REQUIRED_PROFILE_FIELDS = [
  'l1Code',
  'fallbackBucket',
  'primaryThreshold',
  'scoreGapStrategy',
  'gatePolicy',
  'fallbackPolicy',
] as const

export const TAXONOMY_MULTIDOMAIN_ATDD_SUPPORTED_L1_CODES = [
  'IT01',
  'IT02',
  'IT03',
  'IT04',
  'IT05',
  'IT06',
  'IT07',
  'IT08',
] as const

export const TAXONOMY_MULTIDOMAIN_ATDD_RULE_CASES = [
  {
    l1Code: 'IT01',
    rawText:
      '信息科技治理体系不健全，职责机制不完善，信息科技治理架构和制度机制存在明显缺陷。',
    expectedL2Code: 'IT01-02',
    expectedL2Name: '信息科技治理体系/制度机制不健全',
  },
  {
    l1Code: 'IT02',
    rawText:
      '账户权限管理薄弱，最小权限原则未落实，存在越权访问和授权控制不到位问题。',
    expectedL2Code: 'IT02-03',
    expectedL2Name: '访问控制/授权控制不到位',
  },
  {
    l1Code: 'IT03',
    rawText:
      '客户个人信息被非法查询并对外提供，个人信息泄露与违规共享风险暴露。',
    expectedL2Code: 'IT03-02',
    expectedL2Name: '个人信息泄露/出售/非法提供/非法查询',
  },
  {
    l1Code: 'IT04',
    rawText:
      '监管登记信息补录和更新没有时效监控，补录超期且无人催办，导致信息更新不及时不规范。',
    expectedL2Code: 'IT04-10',
    expectedL2Name: '信息登记/录入/更新不及时不规范',
  },
  {
    l1Code: 'IT05',
    rawText:
      '外包供应商准入尽调不充分，供应商日常监督和考核管理长期不到位。',
    expectedL2Code: 'IT05-02',
    expectedL2Name: '外包准入尽调/日常管理不到位',
  },
  {
    l1Code: 'IT06',
    rawText:
      '重要系统投产上线和版本发布管理不规范，重大变更审批与回退控制缺失。',
    expectedL2Code: 'IT06-03',
    expectedL2Name: '重要系统投产/上线/变更管理不规范',
  },
  {
    l1Code: 'IT07',
    rawText:
      '运维人员通过后台直接修改核心业务系统数据，绕过前台控制并缺少有效留痕。',
    expectedL2Code: 'IT07-06',
    expectedL2Name: '核心业务系统数据被后台修改/篡改',
  },
  {
    l1Code: 'IT08',
    rawText:
      '重大科技突发事件迟报瞒报，应报未报且未在规定时限内完成事件上报。',
    expectedL2Code: 'IT08-05',
    expectedL2Name: '突发事件迟报/瞒报/应报未报',
  },
] as const

export const TAXONOMY_MULTIDOMAIN_ATDD_SEMANTIC_CASES = [
  {
    l1Code: 'IT01',
    rawText:
      '监管整改、问题整改和审计跟进管理长期薄弱，整改落实链路始终没有形成闭环。',
    expectedL2Code: 'IT01-03',
    expectedL2Name: '监管要求/监管意见/检查整改落实不到位',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT02',
    rawText:
      '安全漏洞管理与安全控制措施整改持续滞后，系统存在明显安全缺陷。',
    expectedL2Code: 'IT02-05',
    expectedL2Name: '安全漏洞/安全控制措施不到位',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT03',
    rawText:
      '客户信息保护与消费者信息保护管理薄弱，个人信息保护流程控制长期不足。',
    expectedL2Code: 'IT03-03',
    expectedL2Name: '客户信息保护管理薄弱',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT04',
    rawText:
      '业务数据准确性和数据完整性管理持续薄弱，投保数据质量长期不足。',
    expectedL2Code: 'IT04-09',
    expectedL2Name: '业务数据真实性/准确性/完整性问题',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT05',
    rawText:
      '第三方平台科技风险与外接系统风险评估长期薄弱，合作机构接口治理能力不足。',
    expectedL2Code: 'IT05-04',
    expectedL2Name: '第三方平台/合作机构科技风险管控不足',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT06',
    rawText:
      '系统变更管理与版本发布、升级管理流程长期失控，系统切换缺少可审计的回退准备。',
    expectedL2Code: 'IT06-03',
    expectedL2Name: '重要系统投产/上线/变更管理不规范',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT08',
    rawText:
      '灾备恢复能力不足，同城双中心和异地灾难恢复安排都未达到监管要求。',
    expectedL2Code: 'IT08-02',
    expectedL2Name: '灾备建设不足/灾难恢复能力不达标',
    expectedDecisionSource: 'semantic',
  },
  {
    l1Code: 'IT07',
    rawText:
      '信息系统管控有效性和动态监测指标长期不足，控制措施未能形成有效闭环。',
    expectedL2Code: 'IT07-05',
    expectedL2Name: '信息系统管控有效性不足',
    expectedDecisionSource: 'semantic',
  },
] as const

export const TAXONOMY_MULTIDOMAIN_ATDD_RUNTIME_READINESS = 'runtime-classifier-ready'

export const TAXONOMY_MULTIDOMAIN_ATDD_ALLOWED_READINESS_STATES = [
  'seed-ready',
  'runtime-classifier-ready',
  'shadow-ready',
  'primary-ready',
] as const

export const TAXONOMY_MULTIDOMAIN_ATDD_UNSUPPORTED_L1_CODE = 'IT09'
