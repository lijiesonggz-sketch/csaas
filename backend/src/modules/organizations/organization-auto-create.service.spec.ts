import { Test, TestingModule } from '@nestjs/testing'
import { DataSource, EntityManager } from 'typeorm'
import { OrganizationsService } from './organizations.service'
import { OrganizationAutoCreateService } from './organization-auto-create.service'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { User } from '../../database/entities/user.entity'
import { Project } from '../../database/entities/project.entity'

describe('OrganizationAutoCreateService', () => {
  let service: OrganizationAutoCreateService
  let organizationsService: OrganizationsService
  let dataSource: DataSource

  const mockOrganizationsService = {
    createOrganizationForUser: jest.fn(),
    linkProjectToOrganization: jest.fn(),
    getUserOrganization: jest.fn(),
  }

  const mockDataSource = {
    createQueryRunner: jest.fn(),
    transaction: jest.fn(),
  }

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      create: jest.fn(),
    },
  } as any

  const mockEntityManager = {
    save: jest.fn()
      .mockResolvedValueOnce({ id: 'org-123', name: '用户的组织' })
      .mockResolvedValueOnce({ id: 'member-123' })
      .mockResolvedValue({}),
    create: jest.fn().mockReturnValue({ id: 'temp-id' }),
  } as any

  // Mock manager property on queryRunner
  mockQueryRunner.manager = mockEntityManager

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAutoCreateService,
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile()

    service = module.get<OrganizationAutoCreateService>(OrganizationAutoCreateService)
    organizationsService = module.get<OrganizationsService>(OrganizationsService)
    dataSource = module.get<DataSource>(DataSource)

    jest.clearAllMocks()
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner)
  })

  describe('ensureOrganizationForProject', () => {
    it('should create organization and link project in transaction', async () => {
      // Arrange
      const userId = 'user-123'
      const projectId = 'project-123'
      const userName = 'Test User'

      const newOrg = {
        id: 'org-123',
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockOrganizationsService.getUserOrganization.mockResolvedValueOnce(null) // No existing org
      mockOrganizationsService.createOrganizationForUser.mockResolvedValueOnce(
        newOrg,
      )

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockQueryRunner.manager)
      })

      // Act
      const result = await service.ensureOrganizationForProject(
        userId,
        projectId,
        userName,
      )

      // Assert
      expect(result.id).toBe(newOrg.id)
      expect(result.name).toBe(newOrg.name)
      expect(mockDataSource.transaction).toHaveBeenCalled()
      expect(
        mockOrganizationsService.createOrganizationForUser,
      ).toHaveBeenCalledWith(userId, userName)
      expect(
        mockOrganizationsService.linkProjectToOrganization,
      ).toHaveBeenCalledWith(userId, projectId)
    })

    it('should reuse existing organization if user has one', async () => {
      // Arrange
      const userId = 'user-123'
      const projectId = 'project-123'
      const userName = 'Test User'

      const existingOrg = {
        id: 'org-existing',
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockOrganizationsService.getUserOrganization.mockResolvedValueOnce({
        organization: existingOrg,
        role: 'admin',
      })

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockQueryRunner.manager)
      })

      // Act
      const result = await service.ensureOrganizationForProject(
        userId,
        projectId,
        userName,
      )

      // Assert
      expect(result.id).toBe(existingOrg.id)
      expect(result.name).toBe(existingOrg.name)
      expect(
        mockOrganizationsService.createOrganizationForUser,
      ).not.toHaveBeenCalled()
      expect(
        mockOrganizationsService.linkProjectToOrganization,
      ).toHaveBeenCalledWith(userId, projectId)
    })

    it.skip('should rollback transaction on error', async () => {
      // TODO: Implement proper error handling test
      // This requires more sophisticated mocking of transaction behavior
      // For now, we'll skip this test and rely on integration tests
    })
  })

  describe('createOrganizationWithTransaction', () => {
    it('should handle transaction flow correctly', async () => {
      // Arrange
      const userId = 'user-123'
      const newOrg = {
        id: 'org-123',
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockEntityManager.create.mockReturnValue(newOrg)
      mockEntityManager.save.mockResolvedValueOnce(newOrg).mockResolvedValueOnce({
        id: 'member-123',
      })

      // Act
      const result = await service.createOrganizationWithTransaction(
        mockEntityManager,
        userId,
        'Test User',
      )

      // Assert
      expect(result.id).toBe(newOrg.id)
      expect(result.name).toBe(newOrg.name)
      expect(mockEntityManager.create).toHaveBeenCalled()
      expect(mockEntityManager.save).toHaveBeenCalledTimes(2) // org + member
    })
  })
})
