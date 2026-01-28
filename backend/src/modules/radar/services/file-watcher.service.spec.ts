import { Test, TestingModule } from '@nestjs/testing'
import { FileWatcherService } from './file-watcher.service'
import { RawContentService } from './raw-content.service'
import { getQueueToken } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'

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
          provide: getQueueToken('radar:ai-analysis'),
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
