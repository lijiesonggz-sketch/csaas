import {
  adminContext,
  consultantContext,
  controlPointListFilteredResponse,
  duplicateControlCodeRequest,
  duplicateControlNameRequest,
  expectedCreateAuditLogCall,
  expectedCreatedControlPoint,
  expectedStatusAuditLogCall,
  expectedStatusPatchedControlPoint,
  invalidParentRelationRequest,
  statusPatchRequest,
  taxonomyTreeResponse,
  VALID_CONTROL_ID,
  validCreateControlPointRequest,
} from './testing/atdd-story-2-1.fixtures'

type KnowledgeGraphHttpResponse = {
  success: boolean
  data?: Record<string, unknown> | Record<string, unknown>[]
  statusCode?: number
}

type KnowledgeGraphApiSubject = {
  taxonomyService: {
    getTree: jest.Mock
  }
  controlPointService: {
    create: jest.Mock
    updateStatus: jest.Mock
    findAll: jest.Mock
  }
  auditLogService: {
    log: jest.Mock
  }
  getTaxonomyTree: (context?: Record<string, unknown>) => Promise<KnowledgeGraphHttpResponse>
  createControlPoint: (
    body: Record<string, unknown>,
    context?: Record<string, unknown>,
  ) => Promise<KnowledgeGraphHttpResponse>
  listControlPoints: (
    query?: Record<string, unknown>,
    context?: Record<string, unknown>,
  ) => Promise<KnowledgeGraphHttpResponse>
  patchControlPointStatus: (
    controlId: string,
    body: Record<string, unknown>,
    context?: Record<string, unknown>,
  ) => Promise<KnowledgeGraphHttpResponse>
}

describe('Story 2.1 ATDD RED - knowledge-graph catalog routes', () => {
  const createSubject = (): KnowledgeGraphApiSubject => {
    throw new Error(
      'RED PHASE: KnowledgeGraphModule / TaxonomyController / ControlPointController / DTO validation / role-protected admin APIs not implemented yet',
    )
  }

  test.skip('[P0][2.1-API-001] should return the admin taxonomy tree with L1->L2 hierarchy and stable success envelope', async () => {
    const subject = createSubject()

    const response = await subject.getTaxonomyTree(adminContext)

    expect(subject.taxonomyService.getTree).toHaveBeenCalledWith({
      status: 'ACTIVE',
    })
    expect(response).toMatchObject(taxonomyTreeResponse)
  })

  test.skip('[P0][2.1-API-002] should create a control point with the full metadata contract and emit a CREATE audit log through the real AuditLogService', async () => {
    const subject = createSubject()

    const response = await subject.createControlPoint(validCreateControlPointRequest, adminContext)

    expect(subject.controlPointService.create).toHaveBeenCalledWith(
      validCreateControlPointRequest,
      expect.objectContaining({
        tenantId: adminContext.tenantId,
        userId: adminContext.userId,
      }),
    )
    expect(response).toMatchObject({
      success: true,
      data: expectedCreatedControlPoint,
    })
    expect(subject.auditLogService.log).toHaveBeenCalledWith(expectedCreateAuditLogCall)
  })

  test.skip('[P0][2.1-API-003] should reject an l1Code/l2Code hierarchy mismatch with HTTP 400 before writing any control point or audit record', async () => {
    const subject = createSubject()

    await expect(
      subject.createControlPoint(invalidParentRelationRequest, consultantContext),
    ).rejects.toMatchObject({
      status: 400,
    })

    expect(subject.controlPointService.create).not.toHaveBeenCalled()
    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test.skip('[P0][2.1-API-004] should reject duplicate controlCode with HTTP 409 and must not silently overwrite catalog master data', async () => {
    const subject = createSubject()

    await expect(
      subject.createControlPoint(duplicateControlCodeRequest, adminContext),
    ).rejects.toMatchObject({
      status: 409,
    })

    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test.skip('[P0][2.1-API-005] should reject duplicate controlName with HTTP 409 and keep duplicate directory items out of the catalog', async () => {
    const subject = createSubject()

    await expect(
      subject.createControlPoint(duplicateControlNameRequest, consultantContext),
    ).rejects.toMatchObject({
      status: 409,
    })

    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test.skip('[P0][2.1-API-006] should return HTTP 401 for unauthenticated requests and HTTP 403 for authenticated users without ADMIN or CONSULTANT roles', async () => {
    const subject = createSubject()

    await expect(
      subject.getTaxonomyTree({
        authenticated: false,
      }),
    ).rejects.toMatchObject({
      status: 401,
    })

    await expect(
      subject.createControlPoint(validCreateControlPointRequest, {
        ...adminContext,
        role: 'respondent',
      }),
    ).rejects.toMatchObject({
      status: 403,
    })

    expect(subject.controlPointService.create).not.toHaveBeenCalled()
    expect(subject.auditLogService.log).not.toHaveBeenCalled()
  })

  test.skip('[P1][2.1-API-007] should PATCH control point status without deleting the record and must emit an UPDATE audit log describing the status change', async () => {
    const subject = createSubject()

    const response = await subject.patchControlPointStatus(
      VALID_CONTROL_ID,
      statusPatchRequest,
      adminContext,
    )

    expect(subject.controlPointService.updateStatus).toHaveBeenCalledWith(
      VALID_CONTROL_ID,
      statusPatchRequest,
      expect.objectContaining({
        userId: adminContext.userId,
      }),
    )
    expect(response).toMatchObject({
      success: true,
      data: expectedStatusPatchedControlPoint,
    })
    expect(subject.auditLogService.log).toHaveBeenCalledWith(expectedStatusAuditLogCall)
  })

  test.skip('[P1][2.1-API-008] should support status, l1Code, l2Code, controlFamily and keyword filters on the admin control-point listing endpoint', async () => {
    const subject = createSubject()

    const response = await subject.listControlPoints(
      {
        status: 'ACTIVE',
        l1Code: 'IT02',
        l2Code: 'IT02-03',
        controlFamily: 'ACC_PRIVILEGED',
        keyword: 'privileged',
      },
      consultantContext,
    )

    expect(subject.controlPointService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACTIVE',
        l1Code: 'IT02',
        l2Code: 'IT02-03',
        controlFamily: 'ACC_PRIVILEGED',
        keyword: 'privileged',
      }),
    )
    expect(response).toMatchObject(controlPointListFilteredResponse)
  })
})
