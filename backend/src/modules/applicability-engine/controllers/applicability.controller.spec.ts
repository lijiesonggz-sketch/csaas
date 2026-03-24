import 'reflect-metadata'
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AppModule } from '../../../app.module'
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { OrganizationMember } from '../../../database/entities/organization-member.entity'
import { AuditLogService } from '../../audit/audit-log.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { OrganizationGuard } from '../../organizations/guards/organization.guard'
import { TenantGuard } from '../../organizations/guards/tenant.guard'
import { ApplicabilityEngineModule } from '../applicability-engine.module'
import {
  ResolveControlsRequestDto,
  ResolveControlsScene,
} from '../dto/resolve-controls.dto'
import { PackResolverService } from '../services/pack-resolver.service'
import { ApplicabilityController } from './applicability.controller'
import { AuditModule } from '../../audit/audit.module'
import { OrganizationsModule } from '../../organizations/organizations.module'

const VALID_ORG_ID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_TENANT_ID = '660e8400-e29b-41d4-a716-446655440000'
const VALID_USER_ID = '770e8400-e29b-41d4-a716-446655440000'

const validCurrentOrg = {
  organizationId: VALID_ORG_ID,
  userId: VALID_USER_ID,
}

const resolverPayload = {
  matchedPacks: ['PACK-BASE-CYBER', 'PACK-SECTOR-BANK'],
  matchedRules: [
    'RULE-PACK-BASE-CYBER-INCLUDE-001',
    'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001',
    'RULE-CTRL-AI-EXCLUDE-NO-AI-001',
  ],
  controls: [
    {
      controlId: '11111111-1111-1111-1111-111111111111',
      controlCode: 'CTRL-ACC-002',
      controlName: '特权账号控制',
      controlFamily: 'ACC_PRIVILEGED',
      mandatory: true,
      priority: 'HIGH',
      matchedPacks: ['PACK-BASE-CYBER'],
      matchedRules: [
        'RULE-PACK-BASE-CYBER-INCLUDE-001',
        'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001',
      ],
      reasons: ['关键系统等级高或属于关基运营者，需强化特权账号控制'],
      questionPackCodes: ['QPACK-ACC-BASE'],
      evidencePackCodes: ['EPACK-ACC-BASE'],
      remediationPackCodes: ['RPACK-ACC-BASE'],
    },
  ],
  summary: {
    totalControls: 1,
    mandatoryCount: 1,
    matchedPacks: 2,
    matchedRules: 3,
    excludedControls: 2,
  },
  debugLog: [
    {
      ruleCode: 'RULE-PACK-BASE-CYBER-INCLUDE-001',
      targetType: 'pack',
      targetCode: 'PACK-BASE-CYBER',
      ruleType: 'include',
      matched: true,
      traceEntries: [
        {
          field: 'industry',
          op: 'eq',
          expectedValue: 'bank',
          actualValue: 'bank',
          matched: true,
          logicalPath: ['all'],
        },
        {
          field: 'legalPersonType',
          op: 'eq',
          expectedValue: 'legal_person',
          actualValue: 'branch',
          matched: false,
          logicalPath: ['all'],
        },
      ],
      appliedEffect: {
        addedPackCodes: ['PACK-BASE-CYBER'],
        addedControlCodes: ['CTRL-ACC-002'],
        strengthenedControlCodes: [],
        excludedControlCodes: [],
      },
    },
    {
      ruleCode: 'RULE-CTRL-ACC-PRIVILEGED-STRENGTHEN-001',
      targetType: 'control',
      targetCode: 'CTRL-ACC-002',
      ruleType: 'strengthen',
      matched: true,
      traceEntries: [
        {
          field: 'criticalSystemLevel',
          op: 'in',
          expectedValue: ['high', 'very_high'],
          actualValue: 'very_high',
          matched: true,
          logicalPath: ['any'],
        },
      ],
      appliedEffect: {
        addedPackCodes: [],
        addedControlCodes: [],
        strengthenedControlCodes: ['CTRL-ACC-002'],
        excludedControlCodes: [],
      },
    },
    {
      ruleCode: 'RULE-CTRL-AI-EXCLUDE-NO-AI-001',
      targetType: 'pack',
      targetCode: 'PACK-SCENE-AI',
      ruleType: 'exclude',
      matched: true,
      traceEntries: [
        {
          field: 'hasAiServices',
          op: 'is_false',
          actualValue: false,
          matched: true,
          logicalPath: ['all'],
        },
      ],
      appliedEffect: {
        addedPackCodes: [],
        addedControlCodes: [],
        strengthenedControlCodes: [],
        excludedControlCodes: [],
        noOpReason: 'matched but no active target controls removed',
      },
    },
    {
      ruleCode: 'RULE-CTRL-DATA-CROSSBORDER-STRENGTHEN-001',
      targetType: 'control',
      targetCode: 'CTRL-DATA-011',
      ruleType: 'strengthen',
      matched: false,
      traceEntries: [
        {
          field: 'crossBorderData',
          op: 'is_true',
          actualValue: false,
          matched: false,
          logicalPath: ['all'],
        },
      ],
      appliedEffect: {
        addedPackCodes: [],
        addedControlCodes: [],
        strengthenedControlCodes: [],
        excludedControlCodes: [],
        noOpReason: 'Predicate did not match',
      },
    },
  ],
}

describe('ApplicabilityController', () => {
  let controller: ApplicabilityController
  let packResolverService: { resolveByOrganizationId: jest.Mock }
  let auditLogService: { log: jest.Mock }

  beforeEach(async () => {
    packResolverService = {
      resolveByOrganizationId: jest.fn(),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ApplicabilityController],
      providers: [
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = moduleRef.get(ApplicabilityController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('[P0][1.5-API-001] should execute resolver using currentOrg.organizationId instead of raw DTO organizationId', async () => {
    const dto: ResolveControlsRequestDto = {
      organizationId: VALID_ORG_ID,
      scene: 'quick-gap-analysis',
    }

    packResolverService.resolveByOrganizationId.mockResolvedValue(resolverPayload)

    const result = await controller.resolveControls(
      VALID_TENANT_ID,
      validCurrentOrg,
      dto,
      {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest-test' },
      } as any,
    )

    expect(packResolverService.resolveByOrganizationId).toHaveBeenCalledWith(VALID_ORG_ID)
    expect(result.organizationId).toBe(VALID_ORG_ID)
    expect(result.scene).toBe('quick-gap-analysis')
  })

  it('[P1][1.5-API-012] should reject mismatched organizationId values instead of silently accepting a context override', async () => {
    await expect(
      controller.resolveControls(
        VALID_TENANT_ID,
        validCurrentOrg,
        {
          organizationId: '550e8400-e29b-41d4-a716-446655440999',
          scene: 'quick-gap-analysis',
        },
        {
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest-test' },
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
    expect(auditLogService.log).not.toHaveBeenCalled()
  })

  it('[P0][1.5-API-002/003] should return the required payload and derive influencingProfileFields only from matched entries with actual effect', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue(resolverPayload)

    const result = await controller.resolveControls(
      VALID_TENANT_ID,
      validCurrentOrg,
      {
        organizationId: VALID_ORG_ID,
        scene: 'quick-gap-analysis',
      },
      {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest-test' },
      } as any,
    )

    expect(result).toMatchObject({
      organizationId: VALID_ORG_ID,
      scene: 'quick-gap-analysis',
      matchedPacks: resolverPayload.matchedPacks,
      matchedRules: resolverPayload.matchedRules,
      controls: resolverPayload.controls,
      summary: resolverPayload.summary,
      debugLog: resolverPayload.debugLog,
    })
    expect(result.influencingProfileFields).toEqual(['criticalSystemLevel', 'industry'])
    expect(result.influencingProfileFields).not.toEqual(
      expect.arrayContaining(['crossBorderData', 'hasAiServices', 'legalPersonType']),
    )
  })

  it('[P0][1.5-API-004] should surface PackResolverService NotFoundException as-is', async () => {
    packResolverService.resolveByOrganizationId.mockRejectedValue(
      new NotFoundException(`Organization profile not found for organization ${VALID_ORG_ID}`),
    )

    await expect(
      controller.resolveControls(
        VALID_TENANT_ID,
        validCurrentOrg,
        {
          organizationId: VALID_ORG_ID,
        },
        {
          ip: '127.0.0.1',
          headers: {},
        } as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('[P0][1.5-API-005] should write a READ audit log on success', async () => {
    packResolverService.resolveByOrganizationId.mockResolvedValue(resolverPayload)

    await controller.resolveControls(
      VALID_TENANT_ID,
      validCurrentOrg,
      {
        organizationId: VALID_ORG_ID,
        scene: 'quick-gap-analysis',
      },
      {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest-test' },
      } as any,
    )

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: validCurrentOrg.userId,
        organizationId: VALID_ORG_ID,
        tenantId: VALID_TENANT_ID,
        action: AuditAction.READ,
        entityType: 'ApplicabilityResolution',
        entityId: VALID_ORG_ID,
        details: {
          scene: 'quick-gap-analysis',
          matchedPacks: 2,
          matchedRules: 3,
          totalControls: 1,
        },
      }),
    )
  })
})

describe('ApplicabilityController HTTP integration', () => {
  let app: INestApplication
  let packResolverService: { resolveByOrganizationId: jest.Mock }
  let auditLogService: { log: jest.Mock }

  async function createValidationApp(): Promise<INestApplication> {
    packResolverService = {
      resolveByOrganizationId: jest.fn().mockResolvedValue(resolverPayload),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ApplicabilityController],
      providers: [
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: VALID_USER_ID, userId: VALID_USER_ID }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = VALID_TENANT_ID
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.orgId = VALID_ORG_ID
          return true
        },
      })
      .compile()

    const testApp = moduleRef.createNestApplication()
    testApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    testApp.useGlobalInterceptors(new TransformInterceptor())
    await testApp.init()

    return testApp
  }

  afterEach(async () => {
    jest.clearAllMocks()
    if (app) {
      await app.close()
    }
  })

  it('[P1][1.5-API-013] should return the global TransformInterceptor envelope', async () => {
    app = await createValidationApp()

    const response = await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: VALID_ORG_ID,
        scene: 'quick-gap-analysis',
      })
      .expect(200)

    expect(response.body).toMatchObject({
      success: true,
      data: {
        organizationId: VALID_ORG_ID,
        scene: 'quick-gap-analysis',
        influencingProfileFields: ['criticalSystemLevel', 'industry'],
        matchedPacks: resolverPayload.matchedPacks,
        matchedRules: resolverPayload.matchedRules,
        controls: resolverPayload.controls,
        summary: resolverPayload.summary,
        debugLog: resolverPayload.debugLog,
      },
    })
  })

  it('[P1][1.5-API-006] should reject invalid scene values with HTTP 400 before resolver execution', async () => {
    app = await createValidationApp()

    await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: VALID_ORG_ID,
        scene: 'invalid-scene',
      })
      .expect(400)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
  })

  it('[P1][1.5-API-007] should reject undeclared request fields with HTTP 400', async () => {
    app = await createValidationApp()

    await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: VALID_ORG_ID,
        scene: 'quick-gap-analysis',
        unexpectedField: 'nope',
      })
      .expect(400)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
  })

  it('[P1][1.5-API-012-HTTP] should reject organizationId mismatch with HTTP 400 before resolver execution', async () => {
    packResolverService = {
      resolveByOrganizationId: jest.fn().mockResolvedValue(resolverPayload),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ApplicabilityController],
      providers: [
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: VALID_USER_ID, userId: VALID_USER_ID }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = VALID_TENANT_ID
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.orgId = '660e8400-e29b-41d4-a716-446655440111'
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    app.useGlobalInterceptors(new TransformInterceptor())
    await app.init()

    await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: VALID_ORG_ID,
        scene: 'quick-gap-analysis',
      })
      .expect(400)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
  })

  it('[P1][1.5-API-009-401] should return HTTP 401 for unauthenticated requests', async () => {
    packResolverService = {
      resolveByOrganizationId: jest.fn().mockResolvedValue(resolverPayload),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ApplicabilityController],
      providers: [
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => {
          throw new UnauthorizedException('User not authenticated')
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    app.useGlobalInterceptors(new TransformInterceptor())
    await app.init()

    await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: VALID_ORG_ID,
      })
      .expect(401)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
  })

  it('[P1][1.5-API-009-403] should return HTTP 403 for non-member requests', async () => {
    packResolverService = {
      resolveByOrganizationId: jest.fn().mockResolvedValue(resolverPayload),
    }
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ApplicabilityController],
      providers: [
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: VALID_USER_ID, userId: VALID_USER_ID }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = VALID_TENANT_ID
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => false })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    app.useGlobalInterceptors(new TransformInterceptor())
    await app.init()

    await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: VALID_ORG_ID,
      })
      .expect(403)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
  })
})

describe('ApplicabilityController invalid organizationId path', () => {
  let app: INestApplication
  let packResolverService: { resolveByOrganizationId: jest.Mock }

  afterEach(async () => {
    jest.clearAllMocks()
    if (app) {
      await app.close()
    }
  })

  it('[P1][1.5-API-008] should return HTTP 400 for invalid organizationId format and not invoke resolver', async () => {
    packResolverService = {
      resolveByOrganizationId: jest.fn().mockResolvedValue(resolverPayload),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [ApplicabilityController],
      providers: [
        OrganizationGuard,
        {
          provide: getRepositoryToken(OrganizationMember),
          useValue: {
            findOne: jest.fn(),
          } as Partial<Repository<OrganizationMember>>,
        },
        {
          provide: PackResolverService,
          useValue: packResolverService,
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: 'AuditLogService',
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: VALID_USER_ID, userId: VALID_USER_ID }
          return true
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.tenantId = VALID_TENANT_ID
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    app.useGlobalInterceptors(new TransformInterceptor())
    await app.init()

    await request(app.getHttpServer())
      .post('/applicability-engine/resolve-controls')
      .send({
        organizationId: 'not-a-uuid',
        scene: 'quick-gap-analysis' satisfies ResolveControlsScene,
      })
      .expect(400)

    expect(packResolverService.resolveByOrganizationId).not.toHaveBeenCalled()
  })
})

describe('Applicability module wiring', () => {
  it('[P1][1.5-API-010] should register ApplicabilityController and required imports in ApplicabilityEngineModule', () => {
    const controllers =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ApplicabilityEngineModule) ?? []
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ApplicabilityEngineModule) ?? []

    expect(controllers).toEqual(expect.arrayContaining([ApplicabilityController]))
    expect(imports).toEqual(
      expect.arrayContaining([OrganizationsModule, AuditModule]),
    )
  })

  it('[P1][1.5-API-011] should register ApplicabilityEngineModule in AppModule imports', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? []

    expect(imports).toEqual(
      expect.arrayContaining([ApplicabilityEngineModule]),
    )
  })
})
