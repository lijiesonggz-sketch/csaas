import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import { Repository } from 'typeorm'
import { RawContentService } from './raw-content.service'
import { RawContent } from '../../../database/entities/raw-content.entity'

describe('RawContentService Story 2.1 Coverage', () => {
  let service: RawContentService

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawContentService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken('radar-ai-analysis'),
          useValue: mockQueue,
        },
      ],
    }).compile()

    service = module.get<RawContentService>(RawContentService)

    jest.clearAllMocks()
  })

  it('returns the existing record when the generated content hash already exists', async () => {
    const existingContent = {
      id: 'existing-content-id',
      source: 'GARTNER',
      category: 'tech',
      title: 'Duplicate Article',
      summary: 'Existing summary',
      fullContent: 'Existing content',
      url: 'https://example.com/duplicate',
      publishDate: new Date('2026-01-23'),
      author: 'Existing Author',
      organizationId: null,
      contentHash: 'existing-hash',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as RawContent

    mockRepository.findOne.mockResolvedValue(existingContent)

    const result = await service.create({
      source: 'GARTNER',
      category: 'tech',
      title: 'Duplicate Article',
      summary: 'New summary that should be ignored',
      fullContent: 'New content that should be ignored',
      url: 'https://example.com/duplicate',
      publishDate: new Date('2026-01-23'),
      author: 'New Author',
      organizationId: null,
    })

    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { contentHash: expect.any(String) },
    })
    expect(mockRepository.create).not.toHaveBeenCalled()
    expect(mockRepository.save).not.toHaveBeenCalled()
    expect(result).toBe(existingContent)
  })
})
