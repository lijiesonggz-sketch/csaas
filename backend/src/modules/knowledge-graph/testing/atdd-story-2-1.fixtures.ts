export const VALID_TENANT_ID = '660e8400-e29b-41d4-a716-446655440000'
export const VALID_USER_ID = '770e8400-e29b-41d4-a716-446655440000'
export const VALID_CONTROL_ID = '99999999-9999-4999-8999-999999999999'

export const adminContext = {
  tenantId: VALID_TENANT_ID,
  userId: VALID_USER_ID,
  authenticated: true,
  role: 'admin',
}

export const consultantContext = {
  tenantId: VALID_TENANT_ID,
  userId: VALID_USER_ID,
  authenticated: true,
  role: 'consultant',
}

export const taxonomyTreeResponse = {
  success: true,
  data: [
    {
      l1Code: 'IT02',
      l1Name: '网络与信息安全',
      sortOrder: 20,
      children: [
        {
          l2Code: 'IT02-03',
          l2Name: '访问控制与授权管理',
          l2Desc: '覆盖账号、授权、特权访问等控制主题',
          sortOrder: 23,
          status: 'ACTIVE',
        },
      ],
    },
    {
      l1Code: 'IT04',
      l1Name: '数据治理与监管数据报送',
      sortOrder: 40,
      children: [
        {
          l2Code: 'IT04-06',
          l2Name: '监管报送准确性控制',
          l2Desc: '覆盖监管报送口径、校验和对账控制',
          sortOrder: 46,
          status: 'ACTIVE',
        },
      ],
    },
  ],
}

export const controlPointListFilteredResponse = {
  success: true,
  data: {
    items: [
      {
        controlId: VALID_CONTROL_ID,
        controlCode: 'CTRL-ACC-021',
        controlName: 'Privileged Session Review Control',
        l1Code: 'IT02',
        l2Code: 'IT02-03',
        controlFamily: 'ACC_PRIVILEGED',
        controlType: 'detective',
        mandatoryDefault: true,
        riskLevelDefault: 'HIGH',
        ownerRoleHint: ['CISO', '运维负责人'],
        status: 'ACTIVE',
      },
    ],
    total: 1,
  },
}

export const validCreateControlPointRequest = {
  controlCode: 'CTRL-ACC-021',
  controlName: 'Privileged Session Review Control',
  controlDesc: '对特权会话执行留痕、抽查与复核',
  l1Code: 'IT02',
  l2Code: 'IT02-03',
  controlFamily: 'ACC_PRIVILEGED',
  controlType: 'detective',
  mandatoryDefault: true,
  riskLevelDefault: 'HIGH',
  ownerRoleHint: ['CISO', '运维负责人'],
  status: 'ACTIVE',
}

export const expectedCreatedControlPoint = {
  controlId: VALID_CONTROL_ID,
  ...validCreateControlPointRequest,
}

export const duplicateControlCodeRequest = {
  ...validCreateControlPointRequest,
  controlCode: 'CTRL-ACC-002',
  controlName: 'Privileged Session Review Control Duplicate Code',
}

export const duplicateControlNameRequest = {
  ...validCreateControlPointRequest,
  controlCode: 'CTRL-ACC-022',
  controlName: 'Regulatory Reporting Accuracy Control',
}

export const invalidParentRelationRequest = {
  ...validCreateControlPointRequest,
  l1Code: 'IT02',
  l2Code: 'IT04-06',
}

export const statusPatchRequest = {
  status: 'INACTIVE',
}

export const expectedStatusPatchedControlPoint = {
  ...expectedCreatedControlPoint,
  status: 'INACTIVE',
}

export const expectedCreateAuditLogCall = {
  userId: VALID_USER_ID,
  tenantId: VALID_TENANT_ID,
  action: 'create',
  entityType: 'ControlPoint',
  entityId: VALID_CONTROL_ID,
  details: {
    controlCode: validCreateControlPointRequest.controlCode,
    l1Code: validCreateControlPointRequest.l1Code,
    l2Code: validCreateControlPointRequest.l2Code,
  },
}

export const expectedStatusAuditLogCall = {
  userId: VALID_USER_ID,
  tenantId: VALID_TENANT_ID,
  action: 'update',
  entityType: 'ControlPoint',
  entityId: VALID_CONTROL_ID,
  details: {
    changedField: 'status',
    toStatus: 'INACTIVE',
  },
}

export const resolverRequiredControls = [
  {
    controlId: '11111111-1111-1111-1111-111111111111',
    controlCode: 'CTRL-ACC-002',
    controlName: 'Privileged Access Control',
    controlFamily: 'ACC_PRIVILEGED',
  },
  {
    controlId: '22222222-2222-2222-2222-222222222222',
    controlCode: 'CTRL-BCP-003',
    controlName: 'Critical RTO/RPO Control',
    controlFamily: 'BCP_RTO',
  },
  {
    controlId: '33333333-3333-3333-3333-333333333333',
    controlCode: 'CTRL-DG-004',
    controlName: 'Regulatory Reporting Accuracy Control',
    controlFamily: 'REG_REPORTING',
  },
  {
    controlId: '44444444-4444-4444-4444-444444444444',
    controlCode: 'CTRL-DATA-011',
    controlName: 'Cross-Border Data Transfer Control',
    controlFamily: 'DATA_CROSS_BORDER',
  },
  {
    controlId: '55555555-5555-5555-5555-555555555555',
    controlCode: 'CTRL-AI-001',
    controlName: 'AI Model Risk Control',
    controlFamily: 'AI_MODEL_RISK',
  },
  {
    controlId: '66666666-6666-6666-6666-666666666666',
    controlCode: 'CTRL-AI-002',
    controlName: 'AI Human Review Control',
    controlFamily: 'AI_HUMAN_REVIEW',
  },
]

export const expectedSeedSummary = {
  taxonomyL1: 8,
  taxonomyL2Minimum: 4,
  requiredResolverControls: resolverRequiredControls.map((item) => item.controlCode),
  reusedControlIds: resolverRequiredControls.map((item) => item.controlId),
}

export const expectedKnowledgeGraphModuleMetadata = {
  controllerNames: ['TaxonomyController', 'ControlPointController'],
  importNames: ['TypeOrmModule', 'OrganizationsModule', 'AuditModule'],
}

export const expectedAppModuleImports = ['KnowledgeGraphModule']

export const expectedMigrationSqlFragments = [
  'CREATE TABLE "taxonomy_l1"',
  'CREATE TABLE "taxonomy_l2"',
  'CREATE TABLE "control_points"',
  'idx_control_points_l1',
  'idx_control_points_l2',
  'idx_control_points_family',
]
