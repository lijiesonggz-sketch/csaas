import { Test, TestingModule } from '@nestjs/testing'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { WeaknessSnapshotService } from './weakness-snapshot.service'
import { AuditAction } from '../../database/entities/audit-log.entity'
import { OrganizationGuard } from './guards/organization.guard'
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
      await controller.updateOrganization(orgId, updateDto, mockRequest)

      // Assert
      expect(mockOrganizationsService.updateOrganization).toHaveBeenCalledWith(orgId, updateDto)
      expect(auditLogService.log).toHaveBeenCalledWith({
        userId: mockRequest.user.id,
        action: AuditAction.UPDATE,
        entityType: 'Organization',
        entityId: orgId,
        success: true,
        req: mockRequest,
      })
    })
  })

  describe('linkProject', () => {
    it('should log audit entry when linking project to organization', async () => {
      // Arrange
      const projectId = 'project-123'

      mockOrganizationsService.linkProjectToOrganization.mockResolvedValue(undefined)

      // Act
      await controller.linkProject(mockRequest, { projectId })

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
        req: mockRequest,
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
      await controller.removeMember(orgId, userId, mockRequest)

      // Assert
      expect(mockOrganizationsService.removeMember).toHaveBeenCalledWith(orgId, userId)
      expect(auditLogService.log).toHaveBeenCalledWith({
        userId: mockRequest.user.id,
        action: AuditAction.DELETE,
        entityType: 'OrganizationMember',
        entityId: userId,
        success: true,
        req: mockRequest,
      })
    })
  })
})
