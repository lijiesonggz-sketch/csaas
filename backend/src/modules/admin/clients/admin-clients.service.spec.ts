import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, In, DataSource } from 'typeorm'
import { AdminClientsService } from './admin-clients.service'
import { Organization } from '../../../database/entities/organization.entity'
import { PushPreference } from '../../../database/entities/push-preference.entity'
import { EmailService } from './email.service'
import { IndustryType, OrganizationScale, OrganizationStatus } from './dto/create-client.dto'
import { RelevanceFilter } from './dto/bulk-config.dto'

describe('AdminClientsService', () => {
  let service: AdminClientsService
  let organizationRepository: Repository<Organization>
  let pushPreferenceRepository: Repository<PushPreference>
  let dataSource: DataSource

  const mockOrganizationRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  }

  const mockPushPreferenceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  }

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
  }

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  }

  const mockEmailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendBulkImportResultEmail: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminClientsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrganizationRepository,
        },
        {
          provide: getRepositoryToken(PushPreference),
          useValue: mockPushPreferenceRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile()

    service = module.get<AdminClientsService>(AdminClientsService)
    organizationRepository = module.get<Repository<Organization>>(getRepositoryToken(Organization))
    pushPreferenceRepository = module.get<Repository<PushPreference>>(getRepositoryToken(PushPreference))
    dataSource = module.get<DataSource>(DataSource)

    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should return all clients for a tenant', async () => {
      const tenantId = 'tenant-123'
      const expectedClients = [
        { id: 'org-1', name: 'Client 1', tenantId },
        { id: 'org-2', name: 'Client 2', tenantId },
      ]

      mockOrganizationRepository.find.mockResolvedValue(expectedClients)

      const result = await service.findAll(tenantId)

      expect(result).toEqual(expectedClients)
      expect(mockOrganizationRepository.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        relations: ['groupMemberships', 'groupMemberships.group'],
      })
    })
  })

  describe('findOne', () => {
    it('should return a single client with statistics', async () => {
      const tenantId = 'tenant-123'
      const orgId = 'org-1'
      const expectedClient = {
        id: orgId,
        name: 'Client 1',
        tenantId,
        weaknessSnapshots: [{ id: 'w1' }, { id: 'w2' }],
        watchedTopics: [{ id: 't1' }],
        watchedPeers: [{ id: 'p1' }],
      }

      mockOrganizationRepository.findOne.mockResolvedValue(expectedClient)

      const result = await service.findOne(tenantId, orgId)

      expect(result.id).toBe(orgId)
      expect(result.statistics).toEqual({
        weaknessCount: 2,
        watchedTopicCount: 1,
        watchedPeerCount: 1,
        totalPushes: 0,
      })
      expect(mockOrganizationRepository.findOne).toHaveBeenCalledWith({
        where: { id: orgId, tenantId },
        relations: [
          'groupMemberships',
          'groupMemberships.group',
          'weaknessSnapshots',
          'watchedTopics',
          'watchedPeers',
        ],
      })
    })

    it('should throw NotFoundException when client not found', async () => {
      const tenantId = 'tenant-123'
      const orgId = 'non-existent'

      mockOrganizationRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne(tenantId, orgId)).rejects.toThrow('Client with ID non-existent not found')
    })
  })

  describe('create', () => {
    it('should create a new client with default push preferences', async () => {
      const tenantId = 'tenant-123'
      const dto = {
        name: 'New Client',
        contactPerson: 'John Doe',
        contactEmail: 'john@example.com',
        industryType: IndustryType.BANKING,
        scale: OrganizationScale.LARGE,
      }

      const savedOrg = {
        id: 'org-1',
        name: dto.name,
        contactPerson: dto.contactPerson,
        contactEmail: dto.contactEmail,
        industryType: dto.industryType,
        scale: dto.scale,
        tenantId,
        status: OrganizationStatus.TRIAL,
      }

      mockOrganizationRepository.create.mockReturnValue(savedOrg)
      mockOrganizationRepository.save.mockResolvedValue(savedOrg)
      mockPushPreferenceRepository.create.mockReturnValue({} as any)
      mockPushPreferenceRepository.save.mockResolvedValue({} as any)

      const result = await service.create(tenantId, dto)

      expect(result).toEqual(savedOrg)
      expect(mockOrganizationRepository.create).toHaveBeenCalledWith({
        name: dto.name,
        contactPerson: dto.contactPerson,
        contactEmail: dto.contactEmail,
        industryType: dto.industryType,
        scale: dto.scale,
        tenantId,
        status: 'trial',
      })
      expect(mockPushPreferenceRepository.create).toHaveBeenCalled()
      expect(mockPushPreferenceRepository.save).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('should update client and set activatedAt when status changes to active', async () => {
      const tenantId = 'tenant-123'
      const orgId = 'org-1'
      const existingOrg = {
        id: orgId,
        name: 'Old Name',
        status: OrganizationStatus.TRIAL,
        tenantId,
        industry: 'banking',
      }

      const dto = {
        name: 'New Name',
        status: OrganizationStatus.ACTIVE,
      }

      mockOrganizationRepository.findOne.mockResolvedValue(existingOrg)
      mockOrganizationRepository.save.mockImplementation((org) => Promise.resolve(org))

      const result = await service.update(tenantId, orgId, dto)

      expect(result.name).toBe('New Name')
      expect(result.status).toBe('active')
      expect(result.activatedAt).toBeDefined()
    })
  })

  describe('bulkConfig', () => {
    it('should apply configuration to multiple clients', async () => {
      const tenantId = 'tenant-123'
      const dto = {
        organizationIds: ['org-1', 'org-2'],
        dailyPushLimit: 10,
        relevanceFilter: RelevanceFilter.HIGH,
      }

      const organizations = [
        { id: 'org-1', tenantId },
        { id: 'org-2', tenantId },
      ]

      const pushPreferences = [
        { id: 'pref-1', organizationId: 'org-1', dailyPushLimit: 5 },
        { id: 'pref-2', organizationId: 'org-2', dailyPushLimit: 5 },
      ]

      mockOrganizationRepository.find.mockResolvedValue(organizations)
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(pushPreferences[0])
        .mockResolvedValueOnce(pushPreferences[1])
      mockQueryRunner.manager.save.mockImplementation((pref) => Promise.resolve(pref))

      const result = await service.bulkConfig(tenantId, dto)

      expect(result).toBe(2)
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2)
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
      expect(mockQueryRunner.release).toHaveBeenCalled()
    })

    it('should throw NotFoundException when some organizations not found', async () => {
      const tenantId = 'tenant-123'
      const dto = {
        organizationIds: ['org-1', 'org-2'],
        dailyPushLimit: 10,
      }

      mockOrganizationRepository.find.mockResolvedValue([{ id: 'org-1', tenantId }])

      await expect(service.bulkConfig(tenantId, dto)).rejects.toThrow('Some organizations not found')
    })
  })

  describe('getStatistics', () => {
    it('should return client statistics', async () => {
      const tenantId = 'tenant-123'
      const clients = [
        { id: 'org-1', status: OrganizationStatus.ACTIVE },
        { id: 'org-2', status: OrganizationStatus.TRIAL },
        { id: 'org-3', status: OrganizationStatus.INACTIVE },
        { id: 'org-4', status: OrganizationStatus.ACTIVE },
      ]

      mockOrganizationRepository.find.mockResolvedValue(clients)

      const result = await service.getStatistics(tenantId)

      expect(result).toEqual({
        total: 4,
        active: 2,
        trial: 1,
        inactive: 1,
      })
    })
  })
})
