import { Test, TestingModule } from '@nestjs/testing'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { OrganizationGuard } from './guards/organization.guard'
import { OrganizationOwnershipGuard } from './guards/organization-ownership.guard'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

// Mock AuditLogService
interface AuditLogService {
  log: (params: any) => Promise<void>
}

describe('OrganizationsController - Audit Logging', () => {
  let controller: OrganizationsController
  let organizationsService: OrganizationsService
  let auditLogService: AuditLogService

  const mockOrganizationsService = {
    createOrganizationForUser: jest.fn(),
    getOrganizationById: jest.fn(),
    updateOrganization: jest.fn(),
    getOrganizationProfile: jest.fn(),
    upsertOrganizationProfile: jest.fn(),
    linkProjectToOrganization: jest.fn(),
    removeMember: jest.fn(),
  }

  const mockOrgAutoCreateService = {
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

  const mockOrganizationGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  }

  const mockOrganizationOwnershipGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  }

  const mockJwtAuthGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  }

  const mockRequest = {
    user: { id: 'user-123', sub: 'user-123' },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
    params: {},
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
        {
          provide: OrganizationAutoCreateService,
          useValue: mockOrgAutoCreateService,
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
      .overrideGuard(OrganizationGuard)
      .useValue(mockOrganizationGuard)
      .overrideGuard(OrganizationOwnershipGuard)
      .useValue(mockOrganizationOwnershipGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile()

    controller = module.get<OrganizationsController>(OrganizationsController)
    organizationsService = module.get<OrganizationsService>(OrganizationsService)
    auditLogService = module.get<AuditLogService>('AuditLogService')

    jest.clearAllMocks()
  })

  describe('updateOrganization', () => {
    it('should log audit entry when updating organization', async () => {
      // Arrange
      const orgId = 'org-123'
      const updateDto = { name: 'Updated Name' }
      const updatedOrg = {
        id: orgId,
        name: 'Updated Name',
      }

      mockOrganizationsService.updateOrganization.mockResolvedValue(updatedOrg)

      // Act
      await controller.updateOrganization(orgId, updateDto, mockRequest.user)

      // Assert
      expect(mockOrganizationsService.updateOrganization).toHaveBeenCalledWith(orgId, updateDto)
      expect(auditLogService.log).toHaveBeenCalledWith({
        userId: mockRequest.user.id,
        action: AuditAction.UPDATE,
        entityType: 'Organization',
        entityId: orgId,
        success: true,
        req: null,
      })
    })
  })

  describe('linkProject', () => {
    it('should log audit entry when linking project to organization', async () => {
      // Arrange
      const projectId = 'project-123'

      mockOrganizationsService.linkProjectToOrganization.mockResolvedValue(undefined)

      // Act
      await controller.linkProject(mockRequest.user, { projectId })

      // Assert
      expect(mockOrganizationsService.linkProjectToOrganization).toHaveBeenCalledWith(
        mockRequest.user.id,
        projectId,
      )
      expect(auditLogService.log).toHaveBeenCalledWith({
        userId: mockRequest.user.id,
        projectId,
        action: 'LINK_PROJECT',
        entityType: 'Project',
        entityId: projectId,
        success: true,
        req: null,
      })
    })
  })

  describe('removeMember', () => {
    it('should log audit entry when removing member from organization', async () => {
      // Arrange
      const orgId = 'org-123'
      const userId = 'user-to-remove'

      mockOrganizationsService.removeMember.mockResolvedValue(undefined)

      // Act
      await controller.removeMember(orgId, userId, mockRequest.user)

      // Assert
      expect(mockOrganizationsService.removeMember).toHaveBeenCalledWith(orgId, userId)
      expect(auditLogService.log).toHaveBeenCalledWith({
        userId: mockRequest.user.id,
        action: AuditAction.DELETE,
        entityType: 'OrganizationMember',
        entityId: userId,
        success: true,
        req: null,
      })
    })
  })

  describe('upsertOrganizationProfile', () => {
    it('should log audit entry when updating organization profile', async () => {
      const orgId = '550e8400-e29b-41d4-a716-446655440000'
      const profileDto = {
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
      const profile = {
        orgId,
        industry: 'bank',
      }

      mockOrganizationsService.upsertOrganizationProfile.mockResolvedValue(profile)

      await controller.upsertOrganizationProfile(orgId, profileDto as any, mockRequest.user)

      expect(mockOrganizationsService.upsertOrganizationProfile).toHaveBeenCalledWith(
        orgId,
        profileDto,
      )
      expect(auditLogService.log).toHaveBeenCalledWith({
        userId: mockRequest.user.id,
        action: AuditAction.UPDATE,
        entityType: 'OrganizationProfile',
        entityId: orgId,
        success: true,
        req: null,
      })
    })
  })
})
