import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CrawlerLogService } from './crawler-log.service'
import { CrawlerLog } from '../../../database/entities/crawler-log.entity'

describe('CrawlerLogService', () => {
  let service: CrawlerLogService
  let repository: Repository<CrawlerLog>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerLogService,
        {
          provide: getRepositoryToken(CrawlerLog),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<CrawlerLogService>(CrawlerLogService)
    repository = module.get<Repository<CrawlerLog>>(getRepositoryToken(CrawlerLog))

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('logSuccess', () => {
    it('should log successful crawl', async () => {
      const logData = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://example.com',
        itemsCollected: 5,
      }

      const savedLog = {
        id: 'log-uuid',
        ...logData,
        status: 'success' as const,
        errorMessage: null,
        retryCount: 0,
        crawledAt: expect.any(Date),
        createdAt: expect.any(Date),
      }

      mockRepository.create.mockReturnValue(savedLog)
      mockRepository.save.mockResolvedValue(savedLog)

      await service.logSuccess(
        logData.source,
        logData.category,
        logData.url,
        logData.itemsCollected,
      )

      expect(mockRepository.create).toHaveBeenCalledWith({
        source: logData.source,
        category: logData.category,
        url: logData.url,
        status: 'success',
        itemsCollected: logData.itemsCollected,
        errorMessage: null,
        retryCount: 0,
        crawledAt: expect.any(Date),
      })
      expect(mockRepository.save).toHaveBeenCalled()
    })
  })

  describe('logFailure', () => {
    it('should log failed crawl with error message', async () => {
      const logData = {
        source: 'GARTNER',
        category: 'tech' as const,
        url: 'https://example.com',
        errorMessage: 'Connection timeout',
        retryCount: 2,
      }

      const savedLog = {
        id: 'log-uuid',
        ...logData,
        status: 'failed' as const,
        itemsCollected: 0,
        crawledAt: expect.any(Date),
        createdAt: expect.any(Date),
      }

      mockRepository.create.mockReturnValue(savedLog)
      mockRepository.save.mockResolvedValue(savedLog)

      await service.logFailure(
        logData.source,
        logData.category,
        logData.url,
        logData.errorMessage,
        logData.retryCount,
      )

      expect(mockRepository.create).toHaveBeenCalledWith({
        source: logData.source,
        category: logData.category,
        url: logData.url,
        status: 'failed',
        itemsCollected: 0,
        errorMessage: logData.errorMessage,
        retryCount: logData.retryCount,
        crawledAt: expect.any(Date),
      })
      expect(mockRepository.save).toHaveBeenCalled()
    })
  })

  describe('getRecentLogs', () => {
    it('should get recent logs for a source', async () => {
      const logs = [
        {
          id: 'log-1',
          source: 'GARTNER',
          status: 'success',
          crawledAt: new Date(),
        },
        {
          id: 'log-2',
          source: 'GARTNER',
          status: 'failed',
          crawledAt: new Date(),
        },
      ]

      mockRepository.find.mockResolvedValue(logs)

      const result = await service.getRecentLogs('GARTNER', 10)

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { source: 'GARTNER' },
        order: { crawledAt: 'DESC' },
        take: 10,
      })
      expect(result).toEqual(logs)
    })
  })

  describe('getSuccessRate', () => {
    it('should calculate success rate for a source', async () => {
      const logs = [
        { status: 'success' },
        { status: 'success' },
        { status: 'success' },
        { status: 'failed' },
      ]

      mockRepository.find.mockResolvedValue(logs)

      const result = await service.getSuccessRate('GARTNER')

      expect(result).toBe(75) // 3/4 = 75%
    })

    it('should return 0 if no logs exist', async () => {
      mockRepository.find.mockResolvedValue([])

      const result = await service.getSuccessRate('GARTNER')

      expect(result).toBe(0)
    })
  })
})
