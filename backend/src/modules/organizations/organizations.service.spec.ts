import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationsService } from './organizations.service'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { User } from '../../database/entities/user.entity'
import { Project } from '../../database/entities/project.entity'
import { WatchedTopic } from '../../database/entities/watched-topic.entity'
import { WatchedPeer } from '../../database/entities/watched-peer.entity'
import { ConflictException, NotFoundException } from '@nestjs/common'

describe('OrganizationsService', () => {
  let service: OrganizationsService
  let orgRepository: Repository<Organization>
  let memberRepository: Repository<OrganizationMember>
  let userRepository: Repository<User>
  let projectRepository: Repository<Project>

  const mockOrgRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockMemberRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  }

  const mockUserRepository = {
    findOne: jest.fn(),
  }

  const mockProjectRepository = {
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  }

  const mockWatchedTopicRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  }

  const mockWatchedPeerRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrgRepository,
        },
        {
          provide: getRepositoryToken(OrganizationMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(WatchedTopic),
          useValue: mockWatchedTopicRepository,
        },
        {
          provide: getRepositoryToken(WatchedPeer),
          useValue: mockWatchedPeerRepository,
        },
      ],
    }).compile()

    service = module.get<OrganizationsService>(OrganizationsService)
    orgRepository = module.get<Repository<Organization>>(getRepositoryToken(Organization))
    memberRepository = module.get<Repository<OrganizationMember>>(
      getRepositoryToken(OrganizationMember),
    )
    userRepository = module.get<Repository<User>>(getRepositoryToken(User))
    projectRepository = module.get<Repository<Project>>(getRepositoryToken(Project))

    // Clear mocks before each test
    jest.clearAllMocks()
  })

  describe('createOrganizationForUser', () => {
    it('should create a new organization for user if none exists', async () => {
      // Arrange
      const userId = 'user-123'
      const userName = 'Test User'
      const newOrg = {
        id: 'org-123',
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockUserRepository.findOne.mockResolvedValue(null) // No existing org
      mockOrgRepository.create.mockReturnValue(newOrg)
      mockOrgRepository.save.mockResolvedValue(newOrg)
      mockMemberRepository.create.mockReturnValue({
        id: 'member-123',
        userId,
        organizationId: newOrg.id,
        role: 'admin' as const,
        createdAt: new Date(),
      })
      mockMemberRepository.save.mockResolvedValue({
        id: 'member-123',
        userId,
        organizationId: newOrg.id,
        role: 'admin' as const,
        createdAt: new Date(),
      })

      // Act
      const result = await service.createOrganizationForUser(userId, userName)

      // Assert
      expect(result).toEqual(newOrg)
      expect(mockOrgRepository.create).toHaveBeenCalled()
      expect(mockOrgRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '用户的组织',
        }),
      )
      expect(mockMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          organizationId: newOrg.id,
          role: 'admin',
        }),
      )
    })

    it('should return existing organization if user already has one', async () => {
      // Arrange
      const userId = 'user-123'
      const existingOrg = {
        id: 'org-123',
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockMemberRepository.findOne.mockResolvedValue({
        organizationId: existingOrg.id,
        organization: existingOrg,
      })

      // Act
      const result = await service.createOrganizationForUser(userId, 'Test')

      // Assert
      expect(result).toEqual(existingOrg)
      expect(mockOrgRepository.create).not.toHaveBeenCalled()
      expect(mockOrgRepository.save).not.toHaveBeenCalled()
    })
  })

  describe('linkProjectToOrganization', () => {
    it('should link a project to user organization', async () => {
      // Arrange
      const userId = 'user-123'
      const projectId = 'project-123'
      const orgId = 'org-123'

      mockMemberRepository.findOne.mockResolvedValue({
        organizationId: orgId,
      })
      mockProjectRepository.update.mockResolvedValue({ affected: 1 })

      // Act
      await service.linkProjectToOrganization(userId, projectId)

      // Assert
      expect(mockProjectRepository.update).toHaveBeenCalledWith(
        { id: projectId },
        { organizationId: orgId },
      )
    })

    it('should throw NotFoundException if user has no organization', async () => {
      // Arrange
      const userId = 'user-123'
      const projectId = 'project-123'

      mockMemberRepository.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.linkProjectToOrganization(userId, projectId)).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('getUserOrganization', () => {
    it('should return user organization with member role', async () => {
      // Arrange
      const userId = 'user-123'
      const orgId = 'org-123'
      const organization = {
        id: orgId,
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockMemberRepository.findOne.mockResolvedValue({
        organizationId: orgId,
        role: 'admin',
        organization,
      })

      // Act
      const result = await service.getUserOrganization(userId)

      // Assert
      expect(result).toEqual({
        organization,
        role: 'admin',
      })
    })

    it('should return null if user has no organization', async () => {
      // Arrange
      const userId = 'user-123'

      mockMemberRepository.findOne.mockResolvedValue(null)

      // Act
      const result = await service.getUserOrganization(userId)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('getOrganizationById', () => {
    it('should return organization if found', async () => {
      // Arrange
      const orgId = 'org-123'
      const organization = {
        id: orgId,
        name: '用户的组织',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockOrgRepository.findOne.mockResolvedValue(organization)

      // Act
      const result = await service.getOrganizationById(orgId)

      // Assert
      expect(result).toEqual(organization)
      expect(mockOrgRepository.findOne).toHaveBeenCalledWith({
        where: { id: orgId },
      })
    })

    it('should throw NotFoundException if organization not found', async () => {
      // Arrange
      const orgId = 'nonexistent-org'

      mockOrgRepository.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.getOrganizationById(orgId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateOrganization', () => {
    it('should update organization successfully', async () => {
      // Arrange
      const orgId = 'org-123'
      const updateData = { name: 'Updated Org Name' }
      const existingOrg = {
        id: orgId,
        name: 'Old Name',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Organization

      mockOrgRepository.findOne.mockResolvedValue(existingOrg)
      mockOrgRepository.save.mockResolvedValue({
        ...existingOrg,
        ...updateData,
      })

      // Act
      const result = await service.updateOrganization(orgId, updateData)

      // Assert
      expect(result.name).toBe(updateData.name)
      expect(mockOrgRepository.save).toHaveBeenCalled()
    })

    it('should throw NotFoundException if organization not found', async () => {
      // Arrange
      const orgId = 'nonexistent-org'

      mockOrgRepository.findOne.mockResolvedValue(null)

      // Act & Assert
      await expect(service.updateOrganization(orgId, { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('getOrganizationStats', () => {
    it('should return organization statistics', async () => {
      // Arrange
      const orgId = 'org-123'

      mockMemberRepository.count.mockResolvedValue(5) // 5 members
      mockProjectRepository.count.mockResolvedValue(10) // 10 projects

      // Act
      const result = await service.getOrganizationStats(orgId)

      // Assert
      expect(result).toEqual({
        id: orgId,
        memberCount: 5,
        projectCount: 10,
        weaknessSnapshotCount: 0,
      })
    })
  })
})
