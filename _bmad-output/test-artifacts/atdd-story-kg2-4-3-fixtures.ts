export const VALID_OBLIGATION_ID = 'f1b2c3d4-e5f6-7890-abcd-ef1234567890'
export const VALID_CLAUSE_ID = 'f2b2c3d4-e5f6-7890-abcd-ef1234567890'
export const VALID_CONTROL_MAP_ID = 'f3b2c3d4-e5f6-7890-abcd-ef1234567890'
export const VALID_CONTROL_ID = 'f4b2c3d4-e5f6-7890-abcd-ef1234567890'

export const obligationListResponse = {
  items: [
    {
      obligationId: VALID_OBLIGATION_ID,
      obligationCode: 'OBL-IT04-4.1-01',
      obligationText: '应当建立监管报送复核机制',
      obligationType: 'MANDATORY',
      applicableSector: ['银行', '通用'],
      status: 'ACTIVE',
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    },
    {
      obligationId: 'f5b2c3d4-e5f6-7890-abcd-ef1234567890',
      obligationCode: 'OBL-IT04-4.4-01',
      obligationText: '不得绕过报送数据质量校验',
      obligationType: 'PROHIBITIVE',
      applicableSector: ['银行'],
      status: 'ACTIVE',
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
}

export const obligationDetailResponse = {
  obligationId: VALID_OBLIGATION_ID,
  obligationCode: 'OBL-IT04-4.1-01',
  obligationText: '应当建立监管报送复核机制',
  obligationType: 'MANDATORY',
  applicableSector: ['银行', '通用'],
  status: 'ACTIVE',
  createdAt: '2026-04-14T00:00:00.000Z',
  updatedAt: '2026-04-14T00:00:00.000Z',
  clause: {
    clauseId: VALID_CLAUSE_ID,
    clauseCode: 'CLAUSE-IT04-REP-001',
    articleNo: '4.1',
    sectionPath: '第四条/第一款',
    clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
    clauseSummary: '应建立监管报送复核机制并保留痕迹',
    source: {
      sourceId: 'f6b2c3d4-e5f6-7890-abcd-ef1234567890',
      sourceCode: 'SRC-IT04-REPORTING-001',
      sourceName: '监管数据报送管理指引',
      sourceLevel: 'guideline',
      authorityName: '监管机构',
    },
  },
  controlMaps: [
    {
      id: VALID_CONTROL_MAP_ID,
      controlId: VALID_CONTROL_ID,
      controlCode: 'CTRL-REP-001',
      controlName: '监管报送复核控制',
      coverage: 'FULL',
      originType: 'regulation_derived',
      maturityLevel: 'hard',
      authoritativeScore: 0.92,
    },
  ],
}

export const regulationClausesResponse = {
  items: [
    {
      clauseId: VALID_CLAUSE_ID,
      sourceId: 'f6b2c3d4-e5f6-7890-abcd-ef1234567890',
      clauseCode: 'CLAUSE-IT04-REP-001',
      articleNo: '4.1',
      sectionPath: '第四条/第一款',
      clauseText: '金融机构应当建立监管报送复核机制，并保留复核痕迹。',
      clauseSummary: '应建立监管报送复核机制并保留痕迹',
      mandatoryLevel: 'MUST',
      keywords: ['报送', '复核'],
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
}

export const controlSearchResponse = {
  items: [
    {
      controlId: VALID_CONTROL_ID,
      controlCode: 'CTRL-REP-001',
      controlName: '监管报送复核控制',
      controlDesc: '要求在报送前完成双人复核并留痕',
      l1Code: 'IT04',
      l2Code: 'IT04-06',
      controlFamily: '治理',
      controlType: 'preventive',
      mandatoryDefault: true,
      riskLevelDefault: 'HIGH',
      ownerRoleHint: [],
      status: 'ACTIVE',
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
}

export const createObligationPayload = {
  clauseId: VALID_CLAUSE_ID,
  obligationCode: 'OBL-IT04-4.1-02',
  obligationText: '应当对监管报送复核结果进行留痕存档',
  obligationType: 'MANDATORY',
  applicableSector: ['银行', '通用'],
  status: 'ACTIVE',
}

export const updateObligationPayload = {
  obligationText: '应当建立监管报送复核机制并定期复查',
  obligationType: 'MANDATORY',
  applicableSector: ['银行'],
  status: 'INACTIVE',
}

export const createControlMapPayload = {
  controlId: VALID_CONTROL_ID,
  coverage: 'FULL',
}

export const expectedSuggestionPattern = /^OBL-[A-Z0-9]{2,10}-[0-9.]+-\d{2}$/
