import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationsService } from './organizations.service'
import { Organization } from '../../database/entities/organization.entity'
import { OrganizationMember } from '../../database/entities/organization-member.entity'
import { Project } from '../../database/entities/project.entity'
import { User } from '../../database/entities/user.entity'
import { OrganizationProfile } from '../../database/entities/organization-profile.entity'
import { WatchedTopic } from '../../database/entities/watched-topic.entity'
import { WatchedPeer } from '../../database/entities/watched-peer.entity'

describe('OrganizationsService - Pagination', () => {
  let service: OrganizationsService
  let memberRepository: Repository<OrganizationMember>
  let projectRepository: Repository<Project>

  const mockMemberRepository = {
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockProjectRepository = {
    find: jest.fn(),
    count: jest.fn(),
  }

  const mockUserRepository = {
    findOne: jest.fn(),
  }

  const mockOrgRepository = {
    findOne: jest.fn(),
  }

  const mockOrganizationProfileRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }

  const mockWatchedTopicRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  }

  const mockWatchedPeerRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
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
          provide: getRepositoryToken(OrganizationProfile),
          useValue: mockOrganizationProfileRepository,
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
    memberRepository = module.get<Repository<OrganizationMember>>(
      getRepositoryToken(OrganizationMember),
    )
    projectRepository = module.get<Repository<Project>>(getRepositoryToken(Project))

    jest.clearAllMocks()
  })

  describe('getOrganizationMembersPaginated', () => {
    it('should return paginated members with default page 1 and limit 10', async () => {
      // Arrange
      const orgId = 'org-123'
      const mockMembers = [
        {
          id: 'member-1',
          organizationId: orgId,
          userId: 'user-1',
          role: 'admin',
          user: { id: 'user-1', name: 'User 1', email: 'user1@example.com' },
        },
        {
          id: 'member-2',
          organizationId: orgId,
          userId: 'user-2',
          role: 'member',
          user: { id: 'user-2', name: 'User 2', email: 'user2@example.com' },
        },
      ]

      mockMemberRepository.find.mockResolvedValue(mockMembers)
      mockMemberRepository.count.mockResolvedValue(15) // Total 15 members

      // Act
      const result = await service.getOrganizationMembersPaginated(orgId, 1, 10)

      // Assert
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'member-1',
            userId: 'user-1',
            role: 'admin',
            user: mockMembers[0].user,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 15,
          totalPages: 2,
        },
      })
      expect(mockMemberRepository.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        relations: ['user'],
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      })
    })

    it('should return paginated members for page 2 with limit 5', async () => {
      // Arrange
      const orgId = 'org-123'
      const mockMembers = [
        {
          id: 'member-6',
          organizationId: orgId,
          userId: 'user-6',
          role: 'member',
          user: { id: 'user-6', name: 'User 6' },
        },
      ]

      mockMemberRepository.find.mockResolvedValue(mockMembers)
      mockMemberRepository.count.mockResolvedValue(15)

      // Act
      const result = await service.getOrganizationMembersPaginated(orgId, 2, 5)

      // Assert
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(5)
      expect(result.pagination.totalPages).toBe(3)
      expect(mockMemberRepository.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        relations: ['user'],
        skip: 5, // (page - 1) * limit = 5
        take: 5,
        order: { createdAt: 'DESC' },
      })
    })

    it('should return empty array when no members exist', async () => {
      // Arrange
      const orgId = 'org-empty'

      mockMemberRepository.find.mockResolvedValue([])
      mockMemberRepository.count.mockResolvedValue(0)

      // Act
      const result = await service.getOrganizationMembersPaginated(orgId, 1, 10)

      // Assert
      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })
  })

  describe('getOrganizationProjectsPaginated', () => {
    it('should return paginated projects with default page 1 and limit 10', async () => {
      // Arrange
      const orgId = 'org-123'
      const mockProjects = [
        { id: 'project-1', name: 'Project 1', organizationId: orgId },
        { id: 'project-2', name: 'Project 2', organizationId: orgId },
      ]

      mockProjectRepository.find.mockResolvedValue(mockProjects)
      mockProjectRepository.count.mockResolvedValue(25) // Total 25 projects

      // Act
      const result = await service.getOrganizationProjectsPaginated(orgId, 1, 10)

      // Assert
      expect(result).toEqual({
        data: mockProjects,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      })
      expect(mockProjectRepository.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      })
    })

    it('should return paginated projects for page 3 with limit 10', async () => {
      // Arrange
      const orgId = 'org-123'
      const mockProjects = [
        { id: 'project-21', name: 'Project 21' },
        { id: 'project-22', name: 'Project 22' },
        { id: 'project-23', name: 'Project 23' },
        { id: 'project-24', name: 'Project 24' },
        { id: 'project-25', name: 'Project 25' },
      ]

      mockProjectRepository.find.mockResolvedValue(mockProjects)
      mockProjectRepository.count.mockResolvedValue(25)

      // Act
      const result = await service.getOrganizationProjectsPaginated(orgId, 3, 10)

      // Assert
      expect(result.pagination.page).toBe(3)
      expect(result.data).toHaveLength(5)
      expect(mockProjectRepository.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        skip: 20, // (3 - 1) * 10 = 20
        take: 10,
        order: { createdAt: 'DESC' },
      })
    })

    it('should return empty array when no projects exist', async () => {
      // Arrange
      const orgId = 'org-empty'

      mockProjectRepository.find.mockResolvedValue([])
      mockProjectRepository.count.mockResolvedValue(0)

      // Act
      const result = await service.getOrganizationProjectsPaginated(orgId, 1, 10)

      // Assert
      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })
  })
})
