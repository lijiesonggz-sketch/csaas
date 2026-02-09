import { Test, TestingModule } from '@nestjs/testing'
import { RadarSourceController } from './radar-source.controller'
import { RadarSourceService } from '../services/radar-source.service'
import { RadarSource } from '../../../database/entities/radar-source.entity'

/**
 * RadarSourceController Unit Tests
 *
 * Story 8.1: 同业采集源管理
 */
describe('RadarSourceController', () => {
  let controller: RadarSourceController
  let service: RadarSourceService

  const mockService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleActive: jest.fn(),
    testCrawl: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RadarSourceController],
      providers: [
        {
          provide: RadarSourceService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<RadarSourceController>(RadarSourceController)
    service = module.get<RadarSourceService>(RadarSourceService)

    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should return sources filtered by category=industry', async () => {
      const sources = [
        {
          id: '1',
          source: '杭州银行',
          category: 'industry',
          url: 'https://example1.com',
          type: 'website',
          isActive: true,
        },
        {
          id: '2',
          source: '宁波银行',
          category: 'industry',
          url: 'https://example2.com',
          type: 'wechat',
          isActive: true,
        },
      ]

      mockService.findAll.mockResolvedValue(sources)

      const result = await controller.findAll({ category: 'industry' })

      expect(mockService.findAll).toHaveBeenCalledWith('industry', undefined)
      expect(result).toEqual({
        success: true,
        data: sources,
        total: sources.length,
      })
    })
  })

  describe('create', () => {
    it('should create a new radar source with category=industry', async () => {
      const createDto = {
        source: '杭州银行金融科技',
        category: 'industry' as const,
        url: 'https://example.com',
        type: 'website' as const,
        crawlSchedule: '0 */6 * * *',
        crawlConfig: {
          titleSelector: 'h1',
          contentSelector: 'article',
        },
        isActive: true,
      }

      const createdSource = {
        id: 'test-id',
        ...createDto,
        lastCrawlStatus: 'pending',
      }

      mockService.create.mockResolvedValue(createdSource)

      const result = await controller.create(createDto)

      expect(mockService.create).toHaveBeenCalledWith(createDto)
      expect(result).toEqual({
        success: true,
        data: createdSource,
        message: 'Radar source created successfully',
      })
    })
  })

  describe('testCrawl', () => {
    it('should return test crawl result for existing source', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const testResult = {
        success: true,
        title: 'Test Article',
        summary: 'Test summary',
        contentPreview: 'Test content preview',
        url: 'https://example.com',
        publishDate: new Date(),
        author: 'Test Author',
        duration: 1234,
      }

      mockService.findById.mockResolvedValue(source)
      mockService.testCrawl.mockResolvedValue(testResult)

      const result = await controller.testCrawl('test-id')

      expect(mockService.findById).toHaveBeenCalledWith('test-id')
      expect(mockService.testCrawl).toHaveBeenCalledWith(source)
      expect(result.success).toBe(true)
      expect(result.data.sourceId).toBe('test-id')
      expect(result.data.status).toBe('success')
      expect(result.data.result).toEqual({
        title: testResult.title,
        summary: testResult.summary,
        contentPreview: testResult.contentPreview,
        publishDate: testResult.publishDate,
        author: testResult.author,
        duration: testResult.duration,
      })
    })

    it('should return error when test crawl fails', async () => {
      const source: RadarSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const testResult = {
        success: false,
        contentPreview: '',
        url: 'https://example.com',
        duration: 100,
        error: 'Network error',
      }

      mockService.findById.mockResolvedValue(source)
      mockService.testCrawl.mockResolvedValue(testResult)

      const result = await controller.testCrawl('test-id')

      expect(result.success).toBe(false)
      expect(result.data.status).toBe('failed')
      expect(result.data.error).toBe('Network error')
      expect(result.data.result).toBeNull()
    })
  })

  describe('update', () => {
    it('should update radar source and return updated data', async () => {
      const updateDto = {
        source: 'Updated Source',
        crawlSchedule: '0 */12 * * *',
      }

      const updatedSource = {
        id: 'test-id',
        source: 'Updated Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 */12 * * *',
        lastCrawlStatus: 'pending',
      }

      mockService.update.mockResolvedValue(updatedSource)

      const result = await controller.update('test-id', updateDto)

      expect(mockService.update).toHaveBeenCalledWith('test-id', updateDto)
      expect(result).toEqual({
        success: true,
        data: updatedSource,
        message: 'Radar source updated successfully',
      })
    })
  })

  describe('delete', () => {
    it('should delete radar source', async () => {
      mockService.delete.mockResolvedValue(undefined)

      const result = await controller.delete('test-id')

      expect(mockService.delete).toHaveBeenCalledWith('test-id')
      expect(result).toEqual({
        success: true,
        message: 'Radar source deleted successfully',
      })
    })
  })

  describe('toggleActive', () => {
    it('should toggle source active status', async () => {
      const updatedSource = {
        id: 'test-id',
        source: 'Test Source',
        category: 'industry',
        url: 'https://example.com',
        type: 'website',
        isActive: false,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
      }

      mockService.toggleActive.mockResolvedValue(updatedSource)

      const result = await controller.toggleActive('test-id')

      expect(mockService.toggleActive).toHaveBeenCalledWith('test-id')
      expect(result).toEqual({
        success: true,
        data: updatedSource,
        message: 'Radar source disabled successfully',
      })
    })
  })
})
