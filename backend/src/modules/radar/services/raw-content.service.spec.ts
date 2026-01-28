import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RawContentService } from './raw-content.service'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { createHash } from 'crypto'

describe('RawContentService', () => {
  let service: RawContentService
  let repository: Repository<RawContent>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawContentService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<RawContentService>(RawContentService)
    repository = module.get<Repository<RawContent>>(
      getRepositoryToken(RawContent),
    )

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create and save raw content with hash', async () => {
      const contentData = {
        source: 'GARTNER',
        category: 'tech' as const,
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: 'Test content',
        url: 'https://example.com/test',
        publishDate: new Date('2026-01-23'),
        author: 'Test Author',
        organizationId: null,
      }

      const expectedHash = createHash('sha256')
        .update(`${contentData.title}${contentData.url}${contentData.publishDate}`)
        .digest('hex')

      const savedContent = {
        id: 'test-uuid',
        ...contentData,
        contentHash: expectedHash,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.create.mockReturnValue(savedContent)
      mockRepository.save.mockResolvedValue(savedContent)

      const result = await service.create(contentData)

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...contentData,
        contentHash: expectedHash,
        status: 'pending',
      })
      expect(mockRepository.save).toHaveBeenCalled()
      expect(result).toEqual(savedContent)
    })

    it('should handle duplicate content by hash', async () => {
      const contentData = {
        source: 'GARTNER',
        category: 'tech' as const,
        title: 'Test Article',
        summary: 'Test summary',
        fullContent: 'Test content',
        url: 'https://example.com/test',
        publishDate: new Date('2026-01-23'),
        author: 'Test Author',
        organizationId: null,
      }

      const error = new Error('Duplicate entry')
      error['code'] = '23505' // PostgreSQL unique violation

      mockRepository.create.mockReturnValue(contentData)
      mockRepository.save.mockRejectedValue(error)

      await expect(service.create(contentData)).rejects.toThrow('Duplicate entry')
    })
  })

  describe('findPending', () => {
    it('should find all pending content', async () => {
      const pendingContent = [
        {
          id: 'uuid-1',
          source: 'GARTNER',
          category: 'tech',
          status: 'pending',
        },
        {
          id: 'uuid-2',
          source: 'IDC',
          category: 'tech',
          status: 'pending',
        },
      ]

      mockRepository.find.mockResolvedValue(pendingContent)

      const result = await service.findPending()

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      })
      expect(result).toEqual(pendingContent)
    })
  })

  describe('updateStatus', () => {
    it('should update content status', async () => {
      const contentId = 'test-uuid'
      const newStatus = 'analyzing'

      mockRepository.update.mockResolvedValue({ affected: 1 })

      await service.updateStatus(contentId, newStatus)

      expect(mockRepository.update).toHaveBeenCalledWith(contentId, {
        status: newStatus,
      })
    })

    it('should throw error if content not found', async () => {
      const contentId = 'non-existent-uuid'
      const newStatus = 'analyzing'

      mockRepository.update.mockResolvedValue({ affected: 0 })

      await expect(
        service.updateStatus(contentId, newStatus),
      ).rejects.toThrow('Content not found')
    })
  })

  describe('findById', () => {
    it('should find content by id', async () => {
      const content = {
        id: 'test-uuid',
        source: 'GARTNER',
        category: 'tech',
        title: 'Test Article',
        status: 'pending',
      }

      mockRepository.findOne.mockResolvedValue(content)

      const result = await service.findById('test-uuid')

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
      })
      expect(result).toEqual(content)
    })

    it('should return null if content not found', async () => {
      mockRepository.findOne.mockResolvedValue(null)

      const result = await service.findById('non-existent-uuid')

      expect(result).toBeNull()
    })
  })
})
