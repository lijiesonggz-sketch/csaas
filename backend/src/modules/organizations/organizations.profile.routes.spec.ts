import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OrganizationGuard } from './guards/organization.guard'
import { OrganizationOwnershipGuard } from './guards/organization-ownership.guard'

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000'
const USER_ID = 'user-123'

describe('OrganizationsController - Profile Routes (http)', () => {
  let app: INestApplication

  const mockOrganizationsService = {
    getOrganizationProfile: jest.fn(),
    upsertOrganizationProfile: jest.fn(),
    createOrganizationForUser: jest.fn(),
    getOrganizationById: jest.fn(),
    updateOrganization: jest.fn(),
    linkProjectToOrganization: jest.fn(),
    removeMember: jest.fn(),
    getOrganizationStats: jest.fn(),
    getOrganizationMembersPaginated: jest.fn(),
    addMember: jest.fn(),
    updateMemberRole: jest.fn(),
    getOrganizationProjectsPaginated: jest.fn(),
    lookupUserByEmail: jest.fn(),
    getUserOrganization: jest.fn(),
    getWatchedTopics: jest.fn(),
    createWatchedTopic: jest.fn(),
    createWatchedTopics: jest.fn(),
    deleteWatchedTopic: jest.fn(),
    getWatchedPeers: jest.fn(),
    createWatchedPeer: jest.fn(),
    createWatchedPeers: jest.fn(),
    deleteWatchedPeer: jest.fn(),
    getRadarStatus: jest.fn(),
    activateRadar: jest.fn(),
    deactivateRadar: jest.fn(),
  }

  const mockOrganizationAutoCreateService = {
    ensureOrganizationForProject: jest.fn(),
  }

  const mockWeaknessSnapshotService = {
    createSnapshotFromAssessment: jest.fn(),
    getWeaknessesByOrganization: jest.fn(),
    aggregateWeaknesses: jest.fn(),
  }

  const mockAuditLogService = {
    log: jest.fn(),
  }

  async function createApp(ownershipAllowed = true) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
        {
          provide: OrganizationAutoCreateService,
          useValue: mockOrganizationAutoCreateService,
        },
        {
          provide: WeaknessSnapshotService,
          useValue: mockWeaknessSnapshotService,
        },
        {
          provide: 'AuditLogService',
          useValue: mockAuditLogService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          req.user = { id: USER_ID, userId: USER_ID, sub: USER_ID }
          return true
        },
      })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationOwnershipGuard)
      .useValue({ canActivate: () => ownershipAllowed })
      .compile()

    const testApp = moduleFixture.createNestApplication()
    testApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    )
    await testApp.init()

    return testApp
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    app = await createApp(true)
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /organizations/:id/profile', () => {
    it('should return profile for a valid organization member', async () => {
      mockOrganizationsService.getOrganizationProfile.mockResolvedValue({
        orgId: ORG_ID,
        industry: 'bank',
      })

      const response = await request(app.getHttpServer())
        .get(`/organizations/${ORG_ID}/profile`)
        .expect(200)

      expect(response.body).toMatchObject({
        orgId: ORG_ID,
        industry: 'bank',
      })
      expect(mockOrganizationsService.getOrganizationProfile).toHaveBeenCalledWith(ORG_ID)
    })

    it('should reject access when organization ownership guard denies the request', async () => {
      await app.close()
      app = await createApp(false)

      await request(app.getHttpServer()).get(`/organizations/${ORG_ID}/profile`).expect(403)

      expect(mockOrganizationsService.getOrganizationProfile).not.toHaveBeenCalled()
    })
  })

  describe('PUT /organizations/:id/profile', () => {
    const validPayload = {
      industry: 'bank',
      legalPersonType: 'legal_person',
      assetBucket: 'large',
      hasPersonalInfo: true,
      crossBorderData: false,
      importantDataStatus: 'unknown',
      ciioStatus: 'no',
      hasDatacenter: true,
      usesCloud: true,
      outsourcingLevel: 'medium',
      criticalSystemLevel: 'high',
      hasOnlineTrading: true,
      hasAiServices: false,
      publicServiceScope: 'public_users',
      regulatoryAttentionLevel: 'medium',
      recentMajorIncident: false,
    }

    it('should update profile and return the latest profile object', async () => {
      mockOrganizationsService.upsertOrganizationProfile.mockResolvedValue({
        orgId: ORG_ID,
        industry: 'bank',
      })

      const response = await request(app.getHttpServer())
        .put(`/organizations/${ORG_ID}/profile`)
        .send(validPayload)
        .expect(200)

      expect(response.body).toMatchObject({
        orgId: ORG_ID,
        industry: 'bank',
      })
      expect(mockOrganizationsService.upsertOrganizationProfile).toHaveBeenCalledWith(
        ORG_ID,
        validPayload,
      )
      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: USER_ID,
        action: AuditAction.UPDATE,
        entityType: 'OrganizationProfile',
        entityId: ORG_ID,
        success: true,
        req: null,
      })
    })

    it('should reject invalid payloads and avoid service or audit calls', async () => {
      await request(app.getHttpServer())
        .put(`/organizations/${ORG_ID}/profile`)
        .send({
          ...validPayload,
          hasPersonalInfo: 'true',
        })
        .expect(400)

      expect(mockOrganizationsService.upsertOrganizationProfile).not.toHaveBeenCalled()
      expect(mockAuditLogService.log).not.toHaveBeenCalled()
    })

    it('should reject updates when organization ownership guard denies the request', async () => {
      await app.close()
      app = await createApp(false)

      await request(app.getHttpServer())
        .put(`/organizations/${ORG_ID}/profile`)
        .send(validPayload)
        .expect(403)

      expect(mockOrganizationsService.upsertOrganizationProfile).not.toHaveBeenCalled()
      expect(mockAuditLogService.log).not.toHaveBeenCalled()
    })
  })
})
