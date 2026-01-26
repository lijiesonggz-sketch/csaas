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
    findOne: jest.fn(),
    update: jest.fn(),
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
      const orgName = 'Test Organization'

      const newOrg = {
        id: 'org-123',
        name: orgName,
      } as Organization

      // Mock transaction callback to execute with our EntityManager
      mockDataSource.transaction.mockImplementation(async (callback) => {
        // Setup EntityManager mock behavior
        mockEntityManager.findOne.mockResolvedValueOnce(null) // No existing org
        mockEntityManager.create.mockReturnValue(newOrg)
        mockEntityManager.save.mockResolvedValue(newOrg)

        return callback(mockEntityManager)
      })

      // Act
      const result = await service.ensureOrganizationForProject(
        userId,
        projectId,
        orgName,
      )

      // Assert - verify transaction was called and organization was created
      expect(mockDataSource.transaction).toHaveBeenCalled()
      expect(mockEntityManager.findOne).toHaveBeenCalled()
      expect(mockEntityManager.create).toHaveBeenCalled()
      expect(mockEntityManager.save).toHaveBeenCalled()
      expect(mockEntityManager.update).toHaveBeenCalledWith(
        Project,
        { id: projectId, owner_id: userId },
        { organizationId: expect.any(String) },
      )
    })

    it('should reuse existing organization if user has one', async () => {
      // Arrange
      const userId = 'user-123'
      const projectId = 'project-123'
      const orgName = 'Test Organization'

      const existingOrg = {
        id: 'org-existing',
        name: 'Existing Organization',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      const existingMember = {
        id: 'member-123',
        userId,
        organizationId: existingOrg.id,
        organization: existingOrg,
      }

      // Mock transaction callback
      mockDataSource.transaction.mockImplementation(async (callback) => {
        mockEntityManager.findOne.mockResolvedValueOnce(existingMember)
        return callback(mockEntityManager)
      })

      // Act
      const result = await service.ensureOrganizationForProject(
        userId,
        projectId,
        orgName,
      )

      // Assert
      expect(result.id).toBe(existingOrg.id)
      expect(result.name).toBe(existingOrg.name)
      expect(mockEntityManager.findOne).toHaveBeenCalled()
      expect(mockEntityManager.create).not.toHaveBeenCalled()
      expect(mockEntityManager.update).toHaveBeenCalledWith(
        Project,
        { id: projectId, owner_id: userId },
        { organizationId: existingOrg.id },
      )
    })

    it.skip('should rollback transaction on error', async () => {
      // TODO: Implement proper error handling test
      // This requires more sophisticated mocking of transaction behavior
      // For now, we'll skip this test and rely on integration tests
    })
  })

})
