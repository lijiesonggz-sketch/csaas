/**
 * Story 5.2 ATDD RED PHASE Fixtures
 * 控制点详情增强与交叉导航的共享测试数据工厂
 */

export const VALID_CONTROL_ID = '11111111-1111-4111-8111-111111111111'
export const VALID_FAILURE_MODE_ID = '22222222-2222-4222-8222-222222222222'
export const VALID_OBLIGATION_ID = '33333333-3333-4333-8333-333333333333'
export const VALID_CASE_ID = '44444444-4444-4444-8444-444444444444'
export const VALID_SOURCE_ID = '55555555-5555-4555-8555-555555555555'
export const VALID_CLAUSE_ID = '66666666-6666-4666-8666-666666666666'

export function createAdminSession() {
  return {
    user: {
      id: 'admin-user-1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    },
    accessToken: 'admin-token',
    expires: '2099-01-01T00:00:00.000Z',
  }
}

export function createKnowledgeGraphTaxonomyTree() {
  return [
    {
      l1Code: 'IT04',
      l1Name: '数据治理与监管数据报送',
      children: [
        {
          l2Code: 'IT04-06',
          l2Name: '监管报送准确性控制',
          failureModeCount: 2,
        },
      ],
    },
  ]
}

export function createKnowledgeGraphReasoningChain() {
  return {
    taxonomy: {
      l1Code: 'IT04',
      l1Name: '数据治理与监管数据报送',
      l2Code: 'IT04-06',
      l2Name: '监管报送准确性控制',
    },
    failureModes: [
      {
        failureModeId: VALID_FAILURE_MODE_ID,
        failureModeCode: 'FM-REP-001',
        name: '报送口径定义错误',
        category: 'DEFINITION_ERROR',
        controlPointCount: 1,
      },
    ],
    controlPoints: [
      {
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-REP-001',
        controlName: '监管报送复核控制',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
        originType: 'both',
        failureModeRelevance: 'PRIMARY',
        failureModeId: VALID_FAILURE_MODE_ID,
      },
    ],
    obligations: [
      {
        obligationId: VALID_OBLIGATION_ID,
        obligationCode: 'OBL-IT04-4.1-01',
        obligationText: '应当建立监管报送复核机制',
        obligationType: 'MANDATORY',
        controlId: VALID_CONTROL_ID,
        coverage: 'FULL',
      },
    ],
  }
}

export function createAdminFullContextResponse() {
  return {
    control: {
      controlId: VALID_CONTROL_ID,
      controlCode: 'CTRL-REP-001',
      controlName: '监管报送复核控制',
      controlDesc: '确保监管报送前后存在双人复核与留痕。',
      l1: {
        code: 'IT04',
        name: '数据治理与监管数据报送',
      },
      l2: {
        code: 'IT04-06',
        name: '监管报送准确性控制',
      },
    },
    governance: {
      originType: 'both',
      maturityLevel: 'hard',
      authoritativeScore: 0.8333,
      authorityProfile: {
        has_source_basis: true,
        has_applicability_scope: true,
        has_control_activity: true,
        has_expected_evidence: true,
        has_human_review: true,
        has_case_validation: false,
      },
      applicableSector: ['银行', '通用'],
      sectorRequirements: {
        银行: {
          log_retention: '6个月',
          review_frequency: '季度',
          approval_level: '部门负责人',
        },
      },
    },
    applicabilityReason: '管理端详情不计算机构适用性，请在组织上下文中查看适用性说明',
    failureModes: [
      {
        failureModeId: VALID_FAILURE_MODE_ID,
        failureModeCode: 'FM-REP-001',
        name: '报送口径定义错误',
        category: 'DEFINITION_ERROR',
        relevance: 'PRIMARY',
      },
    ],
    obligations: [
      {
        obligationId: VALID_OBLIGATION_ID,
        obligationCode: 'OBL-IT04-4.1-01',
        obligationText: '应当建立监管报送复核机制',
        obligationType: 'MANDATORY',
        coverage: 'FULL',
        clause: {
          clauseId: VALID_CLAUSE_ID,
          clauseCode: 'CLAUSE-IT04-REP-001',
          articleNo: '4.1',
        },
      },
    ],
    reasoningChain: {
      l2: {
        code: 'IT04-06',
        name: '监管报送准确性控制',
      },
      cases: [
        {
          caseCode: 'CASE-PBOC-2024-001',
          caseTitle: '某银行因报送不准被罚 50 万',
        },
      ],
      failureModes: [
        {
          failureModeId: VALID_FAILURE_MODE_ID,
          failureModeCode: 'FM-REP-001',
          name: '报送口径定义错误',
          relevance: 'PRIMARY',
        },
      ],
      selectedControl: {
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-REP-001',
        controlName: '监管报送复核控制',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
      },
      evidenceTypes: [
        {
          evidenceId: 'evidence-001',
          evidenceCode: 'EVD-REPORT-001',
          evidenceName: '报送对账记录',
          evidenceCategory: 'REPORT',
          autoCollectable: false,
          requiredLevel: 'HIGH',
          frequency: 'MONTHLY',
        },
      ],
    },
    clauses: [
      {
        clauseCode: 'CLAUSE-IT04-REP-001',
        articleNo: '4.1',
        clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
      },
    ],
    cases: [
      {
        caseId: VALID_CASE_ID,
        caseCode: 'CASE-PBOC-2024-001',
        caseTitle: '某银行因报送不准被罚 50 万',
        relationType: 'VIOLATES',
        confidenceScore: '0.9100',
      },
    ],
    evidences: [
      {
        evidenceCode: 'EVD-REPORT-001',
        evidenceName: '报送对账记录',
        requiredLevel: 'required',
        description: '监管报送前后的自动校验与人工复核记录',
      },
    ],
    questions: [],
    remediations: [],
  }
}

export function createFailureModeListResponse() {
  return {
    items: [
      {
        failureModeId: VALID_FAILURE_MODE_ID,
        failureModeCode: 'FM-REP-001',
        name: '报送口径定义错误',
        description: '定义口径不一致导致报送偏差。',
        category: 'DEFINITION_ERROR',
        status: 'ACTIVE',
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  }
}

export function createFailureModeDetailResponse() {
  return {
    failureModeId: VALID_FAILURE_MODE_ID,
    failureModeCode: 'FM-REP-001',
    name: '报送口径定义错误',
    description: '定义口径不一致导致报送偏差。',
    category: 'DEFINITION_ERROR',
    status: 'ACTIVE',
    taxonomyMaps: [
      {
        id: 'tfm-001',
        l2Code: 'IT04-06',
        l2Name: '监管报送准确性控制',
      },
    ],
    controlMaps: [
      {
        id: 'fmc-001',
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-REP-001',
        controlName: '监管报送复核控制',
        relevance: 'PRIMARY',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
      },
    ],
  }
}

export function createObligationListResponse() {
  return {
    items: [
      {
        obligationId: VALID_OBLIGATION_ID,
        obligationCode: 'OBL-IT04-4.1-01',
        obligationText: '应当建立监管报送复核机制',
        obligationType: 'MANDATORY',
        applicableSector: ['银行', '通用'],
        status: 'ACTIVE',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  }
}

export function createObligationDetailResponse() {
  return {
    obligationId: VALID_OBLIGATION_ID,
    obligationCode: 'OBL-IT04-4.1-01',
    obligationText: '应当建立监管报送复核机制',
    obligationType: 'MANDATORY',
    applicableSector: ['银行', '通用'],
    status: 'ACTIVE',
    clause: {
      clauseId: VALID_CLAUSE_ID,
      clauseCode: 'CLAUSE-IT04-REP-001',
      articleNo: '4.1',
      sectionPath: '第四条/第一款',
      clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
      clauseSummary: '应建立监管报送复核机制并保留痕迹',
      source: {
        sourceId: VALID_SOURCE_ID,
        sourceCode: 'SRC-IT04-REPORTING-001',
        sourceName: '监管数据报送管理指引',
        sourceLevel: 'guideline',
        authorityName: '监管机构',
      },
    },
    controlMaps: [
      {
        id: 'ocm-001',
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-REP-001',
        controlName: '监管报送复核控制',
        coverage: 'FULL',
        originType: 'both',
        maturityLevel: 'hard',
        authoritativeScore: 0.8333,
      },
    ],
  }
}

export function createComplianceCaseListResponse() {
  return {
    items: [
      {
        caseId: VALID_CASE_ID,
        caseCode: 'CASE-PBOC-2024-001',
        regulatorCode: 'PBOC',
        caseTitle: '某银行因报送不准被罚',
        sourceOrg: '人民银行',
        penalizedPerson: null,
        industry: 'banking',
        region: 'CN',
        caseDate: '2026-04-01T00:00:00.000Z',
        authorityName: '人民银行',
        penaltyType: null,
        caseFacts: '案例事实',
        penaltyReason: '处罚原因',
        rawSourceUrl: null,
        rawContentId: null,
        l1Code: null,
        l2Code: null,
        confidenceScore: null,
        importBatchId: 'PBOC-batch-001',
        status: 'clustered',
        humanReviewed: false,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  }
}

export function createComplianceCaseExtractionResponse() {
  return {
    caseId: VALID_CASE_ID,
    caseCode: 'CASE-PBOC-2024-001',
    status: 'clustered',
    violationThemes: ['监管报送准确性控制'],
    clauseCandidates: [
      {
        clauseId: VALID_CLAUSE_ID,
        clauseCode: 'CLAUSE-IT04-REP-001',
        summary: '应建立监管报送复核机制',
        matchedKeywords: ['复核', '报送'],
        confidenceScore: 0.92,
      },
    ],
    extractedAt: '2026-04-01T00:10:00.000Z',
  }
}

export function createComplianceCaseClusteringResponse() {
  return {
    caseId: VALID_CASE_ID,
    caseCode: 'CASE-PBOC-2024-001',
    status: 'clustered',
    normalizedThemes: ['监管报送准确性控制'],
    candidateControlPoints: [
      {
        controlName: '监管报送复核控制',
        sourceTheme: '监管报送准确性控制',
        confidenceScore: 0.91,
        reason: '主题与控制点映射一致',
      },
    ],
    clusteredAt: '2026-04-01T00:20:00.000Z',
    humanReviewed: false,
    reviewedBy: null,
    reviewedAt: null,
    caseControlMapDrafts: [
      {
        id: 'draft-001',
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-REP-001',
        controlName: '监管报送复核控制',
        relationType: 'VIOLATES',
        reviewStatus: 'PENDING',
        confidenceScore: '0.9100',
        source: 'FAILURE_MODE_CHAIN',
        derivedFailureMode: {
          failureModeId: VALID_FAILURE_MODE_ID,
          failureModeCode: 'FM-REP-001',
          failureModeName: '报送口径定义错误',
        },
      },
    ],
  }
}
