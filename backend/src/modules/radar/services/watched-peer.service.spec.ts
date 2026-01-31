import { Test, TestingModule } from '@nestjs/testing'
import { WatchedPeerService } from './watched-peer.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { WatchedPeer } from '../../../database/entities/watched-peer.entity'
import { Repository } from 'typeorm'
import { ConflictException, NotFoundException } from '@nestjs/common'

describe('WatchedPeerService', () => {
  let service: WatchedPeerService
  let repository: Repository<WatchedPeer>

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchedPeerService,
        {
          provide: getRepositoryToken(WatchedPeer),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<WatchedPeerService>(WatchedPeerService)
    repository = module.get<Repository<WatchedPeer>>(getRepositoryToken(WatchedPeer))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    const orgId = 'org-123'
    const createDto = {
      peerName: '中信证券',
      industry: 'securities' as const,
      institutionType: '券商',
      description: '头部券商',
    }

    it('should create a watched peer successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue({ ...createDto, organizationId: orgId })
      mockRepository.save.mockResolvedValue({
        id: 'peer-123',
        ...createDto,
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.create(orgId, createDto)

      expect(result).toBeDefined()
      expect(result.peerName).toBe(createDto.peerName)
      expect(result.industry).toBe(createDto.industry)
      expect(result.institutionType).toBe(createDto.institutionType)
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          peerName: createDto.peerName,
        },
      })
      expect(mockRepository.save).toHaveBeenCalled()
    })

    it('should throw ConflictException if peer already exists', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'existing-peer',
        peerName: createDto.peerName,
        organizationId: orgId,
      })

      await expect(service.create(orgId, createDto)).rejects.toThrow(ConflictException)
      expect(mockRepository.save).not.toHaveBeenCalled()
    })

    it('should create peers with different industries', async () => {
      const bankingDto = {
        peerName: '杭州银行',
        industry: 'banking' as const,
        institutionType: '城商行',
      }

      const insuranceDto = {
        peerName: '中国人寿',
        industry: 'insurance' as const,
        institutionType: '寿险公司',
      }

      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockImplementation((dto) => ({ ...dto, organizationId: orgId }))
      mockRepository.save.mockImplementation((entity) => Promise.resolve({
        id: 'peer-' + Math.random(),
        ...entity,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      const bankingResult = await service.create(orgId, bankingDto)
      const insuranceResult = await service.create(orgId, insuranceDto)

      expect(bankingResult.industry).toBe('banking')
      expect(bankingResult.institutionType).toBe('城商行')
      expect(insuranceResult.industry).toBe('insurance')
      expect(insuranceResult.institutionType).toBe('寿险公司')
    })

    it('should require industry field', async () => {
      const invalidDto = {
        peerName: '测试机构',
        institutionType: '测试类型',
      } as any

      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue({ ...invalidDto, organizationId: orgId })
      mockRepository.save.mockImplementation((entity) => {
        // Simulate database constraint violation for missing required field
        if (!entity.industry) {
          throw new Error('null value in column "industry" violates not-null constraint')
        }
        return Promise.resolve({
          id: 'peer-test',
          ...entity,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      // The validation should happen at DTO level, but we test database constraint
      await expect(service.create(orgId, invalidDto)).rejects.toThrow()
    })

    it('should require institutionType field', async () => {
      const invalidDto = {
        peerName: '测试机构',
        industry: 'banking',
      } as any

      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue({ ...invalidDto, organizationId: orgId })
      mockRepository.save.mockImplementation((entity) => {
        // Simulate database constraint violation for missing required field
        if (!entity.institutionType) {
          throw new Error('null value in column "institution_type" violates not-null constraint')
        }
        return Promise.resolve({
          id: 'peer-test',
          ...entity,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      // The validation should happen at DTO level, but we test database constraint
      await expect(service.create(orgId, invalidDto)).rejects.toThrow()
    })
  })

  describe('findAll', () => {
    const orgId = 'org-123'

    it('should return all watched peers for an organization', async () => {
      const mockPeers = [
        {
          id: 'peer-1',
          organizationId: orgId,
          peerName: '杭州银行',
          industry: 'banking',
          institutionType: '城商行',
          createdAt: new Date(),
        },
        {
          id: 'peer-2',
          organizationId: orgId,
          peerName: '中信证券',
          industry: 'securities',
          institutionType: '券商',
          createdAt: new Date(),
        },
      ]

      mockRepository.find.mockResolvedValue(mockPeers)

      const result = await service.findAll(orgId)

      expect(result).toHaveLength(2)
      expect(result[0].industry).toBe('banking')
      expect(result[1].industry).toBe('securities')
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        order: { createdAt: 'DESC' },
      })
    })

    it('should return empty array if no peers found', async () => {
      mockRepository.find.mockResolvedValue([])

      const result = await service.findAll(orgId)

      expect(result).toEqual([])
    })
  })

  describe('delete', () => {
    const orgId = 'org-123'
    const peerId = 'peer-123'

    it('should delete a watched peer successfully', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: peerId,
        organizationId: orgId,
        peerName: '杭州银行',
      })
      mockRepository.delete.mockResolvedValue({ affected: 1 })

      await service.delete(peerId, orgId)

      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: peerId,
        organizationId: orgId,
      })
    })

    it('should throw NotFoundException if peer not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 })

      await expect(service.delete(peerId, orgId)).rejects.toThrow(NotFoundException)
    })

    it('should throw NotFoundException if peer belongs to different organization', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 })

      await expect(service.delete(peerId, 'different-org')).rejects.toThrow(NotFoundException)
    })
  })

  describe('duplicate detection across industries', () => {
    const orgId = 'org-123'

    it('should prevent duplicate peer names within same organization', async () => {
      const existingPeer = {
        id: 'peer-1',
        organizationId: orgId,
        peerName: '平安',
        industry: 'banking',
        institutionType: '股份制银行',
      }

      mockRepository.findOne.mockResolvedValue(existingPeer)

      const newDto = {
        peerName: '平安',
        industry: 'insurance' as const,
        institutionType: '寿险公司',
      }

      await expect(service.create(orgId, newDto)).rejects.toThrow(ConflictException)
    })

    it('should allow same peer name in different organizations', async () => {
      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue({
        peerName: '杭州银行',
        industry: 'banking',
        institutionType: '城商行',
        organizationId: 'org-456',
      })
      mockRepository.save.mockResolvedValue({
        id: 'peer-new',
        peerName: '杭州银行',
        industry: 'banking',
        institutionType: '城商行',
        organizationId: 'org-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.create('org-456', {
        peerName: '杭州银行',
        industry: 'banking',
        institutionType: '城商行',
      })

      expect(result).toBeDefined()
      expect(result.peerName).toBe('杭州银行')
    })
  })
})
