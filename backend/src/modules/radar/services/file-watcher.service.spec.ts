import { Test, TestingModule } from '@nestjs/testing'
import { FileWatcherService } from './file-watcher.service'
import { RawContentService } from './raw-content.service'
import { getQueueToken } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ExcelParser } from '../utils/excel-parser.util'

// Mock chokidar
const mockWatcher = {
  on: jest.fn(),
  close: jest.fn(),
}

jest.mock('chokidar', () => ({
  watch: jest.fn(() => mockWatcher),
}))

// Mock fs/promises
jest.mock('fs/promises')

describe('FileWatcherService', () => {
  let service: FileWatcherService
  let rawContentService: RawContentService
  let aiAnalysisQueue: any

  const mockRawContentService = {
    create: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileWatcherService,
        {
          provide: RawContentService,
          useValue: mockRawContentService,
        },
        {
          provide: getQueueToken('radar-ai-analysis'),
          useValue: mockQueue,
        },
      ],
    }).compile()

    service = module.get<FileWatcherService>(FileWatcherService)
    rawContentService = module.get<RawContentService>(RawContentService)
    aiAnalysisQueue = mockQueue

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('startWatching', () => {
    it('should start watching directories', async () => {
      const chokidar = require('chokidar')

      await service.startWatching()

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          ignored: expect.any(RegExp),
          persistent: true,
          ignoreInitial: true, // 修复：实际代码使用 true
        }),
      )

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function))
    })
  })

  describe('processFile', () => {
    it('should process markdown file and trigger AI analysis', async () => {
      const filePath = 'backend/data-import/website-crawl/test-article.md'
      const fileContent = `---
source: "GARTNER"
category: "tech"
url: "https://example.com/test"
publishDate: "2026-01-23"
author: "Test Author"
---

# Test Article

This is test content with enough characters to pass the minimum length validation.
We need at least 100 characters in the body content to satisfy the quality check.
This paragraph ensures we meet that requirement for the file watcher service test.
`

      const savedContent = {
        id: 'content-uuid',
        source: 'GARTNER',
        category: 'tech',
        title: 'Test Article',
        status: 'pending',
      }

      // Mock fs.stat (文件大小检查)
      ;(fs.stat as jest.Mock).mockResolvedValue({
        size: 1024, // 1KB
      })
      ;(fs.readFile as jest.Mock).mockResolvedValue(fileContent)
      ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
      ;(fs.rename as jest.Mock).mockResolvedValue(undefined)
      mockRawContentService.create.mockResolvedValue(savedContent)

      await service.processFile(filePath)

      expect(fs.stat).toHaveBeenCalledWith(filePath)
      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf-8')
      expect(mockRawContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'GARTNER',
          category: 'tech',
          url: 'https://example.com/test',
          title: 'Test Article',
          organizationId: null,
        }),
      )
      expect(mockQueue.add).toHaveBeenCalledWith('analyze-content', {
        contentId: 'content-uuid',
      })
      expect(fs.rename).toHaveBeenCalled()
    })

    it('should handle file processing errors', async () => {
      const filePath = 'backend/data-import/website-crawl/invalid.md'
      const error = new Error('Invalid file format')

      ;(fs.readFile as jest.Mock).mockRejectedValue(error)

      await service.processFile(filePath)

      expect(mockRawContentService.create).not.toHaveBeenCalled()
      expect(mockQueue.add).not.toHaveBeenCalled()
    })

    it('should process Excel file and create multiple RawContent records', async () => {
      const filePath = 'backend/data-import/website-crawl/test.xlsx'

      // Mock ExcelParser.parseComplianceExcel
      const mockExcelData = {
        success: true,
        rows: [
          {
            region: '深圳',
            type: '行政监管措施',
            id: 'test-id-1',
            date: '2025-01-15 10:00:00',
            title: '测试处罚案例1',
            docNumber: '行政监管措施决定书〔2025〕1号',
            content: '这是测试内容1',
            url: 'https://example.com/1',
          },
          {
            region: '上海',
            type: '行政监管措施',
            id: 'test-id-2',
            date: '2025-01-16 11:00:00',
            title: '测试处罚案例2',
            docNumber: '行政监管措施决定书〔2025〕2号',
            content: '这是测试内容2',
            url: 'https://example.com/2',
          },
        ],
      }

      jest.spyOn(ExcelParser, 'parseComplianceExcel').mockReturnValue(mockExcelData)

      const savedContent1 = {
        id: 'content-uuid-1',
        source: '深圳行政监管措施',
        category: 'compliance',
        title: '测试处罚案例1',
        status: 'pending',
      }

      const savedContent2 = {
        id: 'content-uuid-2',
        source: '上海行政监管措施',
        category: 'compliance',
        title: '测试处罚案例2',
        status: 'pending',
      }

      // Mock fs.stat (文件大小检查)
      ;(fs.stat as jest.Mock).mockResolvedValue({
        size: 1024 * 1024, // 1MB
      })
      ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
      ;(fs.rename as jest.Mock).mockResolvedValue(undefined)
      mockRawContentService.create
        .mockResolvedValueOnce(savedContent1)
        .mockResolvedValueOnce(savedContent2)

      await service.processFile(filePath)

      // 验证调用了 Excel 解析器
      expect(ExcelParser.parseComplianceExcel).toHaveBeenCalledWith(filePath)

      // 验证创建了两个 RawContent 记录
      expect(mockRawContentService.create).toHaveBeenCalledTimes(2)

      // 验证第一个记录
      expect(mockRawContentService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: '深圳行政监管措施',
          category: 'compliance',
          title: '测试处罚案例1',
          fullContent: '这是测试内容1',
          url: 'https://example.com/1',
          organizationId: null,
          complianceData: expect.objectContaining({
            type: 'penalty',
            penaltyInstitution: '深圳证监局',
          }),
        }),
      )

      // 验证第二个记录
      expect(mockRawContentService.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source: '上海行政监管措施',
          category: 'compliance',
          title: '测试处罚案例2',
          fullContent: '这是测试内容2',
          url: 'https://example.com/2',
          organizationId: null,
          complianceData: expect.objectContaining({
            type: 'penalty',
            penaltyInstitution: '上海证监局',
          }),
        }),
      )

      // 验证触发了 AI 分析任务
      expect(mockQueue.add).toHaveBeenCalledTimes(2)
      expect(mockQueue.add).toHaveBeenCalledWith('analyze-content', {
        contentId: 'content-uuid-1',
      })
      expect(mockQueue.add).toHaveBeenCalledWith('analyze-content', {
        contentId: 'content-uuid-2',
      })

      // 验证文件被移动到 processed 文件夹
      expect(fs.rename).toHaveBeenCalled()
    })

    it('should handle Excel file parsing errors', async () => {
      const filePath = 'backend/data-import/website-crawl/invalid.xlsx'

      // Mock ExcelParser.parseComplianceExcel 返回失败
      const mockErrorResult = {
        success: false,
        rows: [],
        error: 'Invalid Excel format',
      }

      jest.spyOn(ExcelParser, 'parseComplianceExcel').mockReturnValue(mockErrorResult)

      // Mock fs.stat (文件大小检查)
      ;(fs.stat as jest.Mock).mockResolvedValue({
        size: 1024, // 1KB
      })
      ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
      ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)
      ;(fs.rename as jest.Mock).mockResolvedValue(undefined)

      await service.processFile(filePath)

      // 验证没有创建 RawContent 记录
      expect(mockRawContentService.create).not.toHaveBeenCalled()

      // 验证没有触发 AI 分析任务
      expect(mockQueue.add).not.toHaveBeenCalled()

      // 验证文件被移动到 failed 文件夹
      expect(fs.rename).toHaveBeenCalled()
    })

    it('should correctly map region to institution name', () => {
      // 使用反射调用私有方法进行测试
      const serviceInstance = service as any

      expect(serviceInstance.getInstitutionFromRegion('深圳')).toBe('深圳证监局')
      expect(serviceInstance.getInstitutionFromRegion('上海')).toBe('上海证监局')
      expect(serviceInstance.getInstitutionFromRegion('北京')).toBe('北京证监局')
      expect(serviceInstance.getInstitutionFromRegion('广东')).toBe('广东证监局')
      expect(serviceInstance.getInstitutionFromRegion('浙江')).toBe('浙江证监局')
      expect(serviceInstance.getInstitutionFromRegion('江苏')).toBe('江苏证监局')
      expect(serviceInstance.getInstitutionFromRegion('四川')).toBe('四川证监局')
      expect(serviceInstance.getInstitutionFromRegion('重庆')).toBe('重庆证监局')
      expect(serviceInstance.getInstitutionFromRegion('未知地区')).toBe('证监会')
      expect(serviceInstance.getInstitutionFromRegion(undefined)).toBe('证监会')
    })
  })

  describe('stopWatching', () => {
    it('should stop watching directories', async () => {
      await service.startWatching()
      await service.stopWatching()

      expect(mockWatcher.close).toHaveBeenCalled()
    })
  })

  describe('extractTitle', () => {
    it('should extract title from markdown', () => {
      const content = '# Test Title\n\nContent here'
      const title = service.extractTitle(content)

      expect(title).toBe('Test Title')
    })

    it('should return default title if no heading found', () => {
      const content = 'Content without heading'
      const title = service.extractTitle(content)

      expect(title).toBe('Untitled')
    })
  })
})
