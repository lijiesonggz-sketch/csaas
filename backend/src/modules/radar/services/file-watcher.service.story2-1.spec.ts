import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { getQueueToken } from '@nestjs/bullmq'
import * as fs from 'fs/promises'
import * as path from 'path'
import { FileWatcherService } from './file-watcher.service'
import { RawContentService } from './raw-content.service'

const mockWatcher = {
  on: jest.fn(),
  close: jest.fn(),
}

jest.mock('chokidar', () => ({
  watch: jest.fn(() => mockWatcher),
}))

jest.mock('fs/promises')

describe('FileWatcherService Story 2.1 Failure Handling', () => {
  let service: FileWatcherService

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

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    jest.clearAllMocks()
  })

  it('moves markdown files with missing required frontmatter into the failed folder and records the error', async () => {
    const filePath = path.join(
      'D:\\csaas',
      'backend',
      'data-import',
      'website-crawl',
      'missing-category.md',
    )

    ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })
    ;(fs.readFile as jest.Mock).mockResolvedValue(`---
source: "GARTNER"
---

# Missing Category

${'This file is long enough to pass body validation but should still fail because category is missing. '.repeat(2)}
`)
    ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
    ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(fs.rename as jest.Mock).mockResolvedValue(undefined)

    await service.processFile(filePath)

    expect(mockRawContentService.create).not.toHaveBeenCalled()
    expect(mockQueue.add).not.toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(path.dirname(filePath), 'failed', 'missing-category.md.error.txt'),
      expect.stringContaining('Missing required frontmatter fields: source, category'),
    )
    expect(fs.rename).toHaveBeenCalledWith(
      filePath,
      path.join(path.dirname(filePath), 'failed', path.basename(filePath)),
    )
  })

  it('moves markdown files with too-short content into the failed folder and skips AI queueing', async () => {
    const filePath = path.join(
      'D:\\csaas',
      'backend',
      'data-import',
      'wechat-articles',
      'too-short.md',
    )

    ;(fs.stat as jest.Mock).mockResolvedValue({ size: 512 })
    ;(fs.readFile as jest.Mock).mockResolvedValue(`---
source: "InfoQ"
category: "tech"
url: "https://example.com/too-short"
---

# Short

Too short.
`)
    ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
    ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(fs.rename as jest.Mock).mockResolvedValue(undefined)

    await service.processFile(filePath)

    expect(mockRawContentService.create).not.toHaveBeenCalled()
    expect(mockQueue.add).not.toHaveBeenCalled()
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(path.dirname(filePath), 'failed', 'too-short.md.error.txt'),
      expect.stringContaining('Content too short (minimum 100 characters required)'),
    )
    expect(fs.rename).toHaveBeenCalledWith(
      filePath,
      path.join(path.dirname(filePath), 'failed', path.basename(filePath)),
    )
  })
})
