/**
 * 知识图谱总览页面测试数据工厂 (Story 5.1 ATDD)
 * TDD RED PHASE: 测试数据工厂，用于 E2E 和 API 测试
 */

// ==================== 类型定义 ====================

export interface TaxonomyNode {
  code: string
  name: string
  level: 'L1' | 'L2'
  children?: TaxonomyNode[]
  failureModeCount?: number
}

export interface FailureMode {
  code: string
  name: string
  category: string
  controlPointCount: number
  relatedTaxonomies?: Array<{ code: string; name: string }>
  relatedControlPoints?: Array<{ code: string; name: string }>
  relatedObligations?: Array<{ code: string; text: string }>
}

export interface ControlPoint {
  code: string
  name: string
  maturityLevel: string
  authoritativeScore: number
  governanceFields?: Record<string, string>
  relatedFailureModes?: Array<{ code: string; name: string }>
  relatedObligations?: Array<{ code: string; text: string }>
  relatedCases?: Array<{ caseId: string; title: string }>
}

export interface Obligation {
  code: string
  text: string
  type: 'MANDATORY' | 'PROHIBITIVE' | 'RECOMMENDED'
}

export interface ReasoningChainData {
  taxonomy: TaxonomyNode
  failureModes: FailureMode[]
  controlPoints: ControlPoint[]
  obligations: Obligation[]
}

// ==================== 工厂函数 ====================

/** 创建 IT 分类树模拟数据（8 个 IT 域） */
export function createTaxonomyTree(overrides?: Partial<TaxonomyNode>[]): TaxonomyNode[] {
  const defaults: TaxonomyNode[] = [
    { code: 'IT01', name: '战略与治理', level: 'L1', children: [
      { code: 'IT01-01', name: 'IT战略规划', level: 'L2', failureModeCount: 5 },
      { code: 'IT01-02', name: 'IT治理架构', level: 'L2', failureModeCount: 3 },
    ]},
    { code: 'IT02', name: '数据管理', level: 'L1', children: [
      { code: 'IT02-01', name: '数据质量管理', level: 'L2', failureModeCount: 4 },
      { code: 'IT02-02', name: '数据安全管理', level: 'L2', failureModeCount: 6 },
    ]},
    { code: 'IT03', name: '应用系统', level: 'L1', children: [
      { code: 'IT03-01', name: '应用开发', level: 'L2', failureModeCount: 3 },
    ]},
    { code: 'IT04', name: '基础设施', level: 'L1', children: [
      { code: 'IT04-01', name: '网络管理', level: 'L2', failureModeCount: 6 },
    ]},
    { code: 'IT05', name: '安全管理', level: 'L1', children: [
      { code: 'IT05-01', name: '访问控制', level: 'L2', failureModeCount: 7 },
    ]},
    { code: 'IT06', name: '运维管理', level: 'L1', children: [
      { code: 'IT06-01', name: '变更管理', level: 'L2', failureModeCount: 4 },
    ]},
    { code: 'IT07', name: '业务连续性', level: 'L1', children: [
      { code: 'IT07-01', name: '灾备管理', level: 'L2', failureModeCount: 5 },
    ]},
    { code: 'IT08', name: '外包管理', level: 'L1', children: [
      { code: 'IT08-01', name: '供应商管理', level: 'L2', failureModeCount: 3 },
    ]},
  ]

  if (overrides) {
    return defaults.map((node, i) => ({ ...node, ...(overrides[i] || {}) }))
  }
  return defaults
}

/** 创建推理链路模拟数据 */
export function createReasoningChain(l2Code: string): ReasoningChainData {
  return {
    taxonomy: { code: l2Code, name: 'IT战略规划', level: 'L2' },
    failureModes: [
      {
        code: `FM-${l2Code}-001`,
        name: 'IT战略与业务战略不一致',
        category: 'STRATEGIC',
        controlPointCount: 3,
        relatedTaxonomies: [{ code: l2Code, name: 'IT战略规划' }],
        relatedControlPoints: [
          { code: `CP-${l2Code}-001`, name: 'IT战略规划流程' },
          { code: `CP-${l2Code}-002`, name: 'IT投资评估机制' },
        ],
        relatedObligations: [
          { code: `OBL-${l2Code}-001`, text: '应当建立IT战略规划流程' },
        ],
      },
      {
        code: `FM-${l2Code}-002`,
        name: 'IT投资回报率低',
        category: 'FINANCIAL',
        controlPointCount: 2,
      },
    ],
    controlPoints: [
      {
        code: `CP-${l2Code}-001`,
        name: 'IT战略规划流程',
        maturityLevel: 'OPTIMIZED',
        authoritativeScore: 0.95,
        governanceFields: { owner: 'CIO', reviewCycle: 'ANNUAL' },
        relatedFailureModes: [{ code: `FM-${l2Code}-001`, name: 'IT战略与业务战略不一致' }],
        relatedObligations: [{ code: `OBL-${l2Code}-001`, text: '应当建立IT战略规划流程' }],
        relatedCases: [{ caseId: 'CASE-001', title: '某银行IT战略规划案例' }],
      },
      {
        code: `CP-${l2Code}-002`,
        name: 'IT投资评估机制',
        maturityLevel: 'MANAGED',
        authoritativeScore: 0.85,
      },
    ],
    obligations: [
      { code: `OBL-${l2Code}-001`, text: '应当建立IT战略规划流程', type: 'MANDATORY' },
    ],
  }
}

/** 创建管理员认证 session 模拟数据 */
export function createAdminSession() {
  return {
    user: {
      id: 'admin-1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    },
    accessToken: 'admin-token',
    expires: '2099-01-01T00:00:00.000Z',
  }
}

/** 创建非管理员认证 session 模拟数据 */
export function createConsultantSession() {
  return {
    user: {
      id: 'consultant-1',
      name: 'Consultant',
      email: 'consultant@example.com',
      role: 'consultant',
    },
    accessToken: 'consultant-token',
    expires: '2099-01-01T00:00:00.000Z',
  }
}

/** 创建法规列表模拟数据 */
export function createRegulationList() {
  return [
    {
      regulationSource: '银保监会',
      regulations: [
        { code: 'REG-001', name: '商业银行信息科技风险管理指引', articleCount: 50 },
        { code: 'REG-002', name: '银行业金融机构数据治理指引', articleCount: 30 },
      ],
    },
    {
      regulationSource: '人民银行',
      regulations: [
        { code: 'REG-003', name: '金融科技发展规划', articleCount: 20 },
      ],
    },
  ]
}

/** 创建搜索结果模拟数据 */
export function createSearchResults(query: string) {
  return {
    taxonomies: [{ code: 'IT01-01', name: 'IT战略规划', type: 'taxonomy' }],
    failureModes: [{ code: 'FM-IT01-001', name: 'IT战略与业务战略不一致', type: 'failureMode' }],
    controlPoints: [{ code: 'CP-IT01-001', name: 'IT战略规划流程', type: 'controlPoint' }],
    obligations: [{ code: 'OBL-IT01-001', text: '应当建立IT战略规划流程', type: 'obligation' }],
  }
}
