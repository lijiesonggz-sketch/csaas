import { Logger } from '@nestjs/common'
import { RadarModule } from './radar.module'

describe('RadarModule Story 2.1 Scheduler Coverage', () => {
  let moduleUnderTest: RadarModule

  const mockCrawlerQueue = {
    add: jest.fn(),
  }

  const mockPushQueue = {
    add: jest.fn(),
  }

  const mockFileWatcherService = {
    startWatching: jest.fn(),
    stopWatching: jest.fn(),
  }

  const mockRadarSourceService = {
    findAll: jest.fn(),
  }

  beforeEach(() => {
    moduleUnderTest = new RadarModule(
      mockCrawlerQueue as any,
      mockPushQueue as any,
      mockFileWatcherService as any,
      mockRadarSourceService as any,
    )

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    jest.clearAllMocks()
  })

  it('schedules database-configured crawler jobs with the configured source, category, url, and cron pattern', async () => {
    mockRadarSourceService.findAll.mockResolvedValue([
      {
        id: 'db-source-1',
        source: 'GARTNER',
        category: 'tech',
        url: 'https://www.gartner.com/en/newsroom',
        crawlSchedule: '0 2 * * *',
      },
      {
        id: 'db-source-2',
        source: '信通院',
        category: 'compliance',
        url: 'https://example.com/caict',
        crawlSchedule: '0 4 * * *',
      },
    ])

    await (moduleUnderTest as any).setupCrawlerJobs()

    expect(mockCrawlerQueue.add).toHaveBeenNthCalledWith(
      1,
      'crawl-tech',
      {
        source: 'GARTNER',
        category: 'tech',
        url: 'https://www.gartner.com/en/newsroom',
      },
      {
        repeat: {
          pattern: '0 2 * * *',
        },
        jobId: 'crawler-db-source-1',
      },
    )
    expect(mockCrawlerQueue.add).toHaveBeenNthCalledWith(
      2,
      'crawl-compliance',
      {
        source: '信通院',
        category: 'compliance',
        url: 'https://example.com/caict',
      },
      {
        repeat: {
          pattern: '0 4 * * *',
        },
        jobId: 'crawler-db-source-2',
      },
    )
  })

  it('falls back to the default daily 2:00 crawler jobs when the database has no active sources', async () => {
    mockRadarSourceService.findAll.mockResolvedValue([])

    await (moduleUnderTest as any).setupCrawlerJobs()

    expect(mockCrawlerQueue.add).toHaveBeenCalledTimes(3)
    expect(mockCrawlerQueue.add).toHaveBeenNthCalledWith(
      1,
      'crawl-tech',
      {
        source: 'GARTNER',
        category: 'tech',
        url: 'https://www.gartner.com/en/newsroom',
      },
      {
        repeat: {
          pattern: '0 2 * * *',
        },
        jobId: 'crawler-GARTNER',
      },
    )
    expect(mockCrawlerQueue.add).toHaveBeenNthCalledWith(
      2,
      'crawl-tech',
      {
        source: '信通院',
        category: 'tech',
        url: 'http://www.caict.ac.cn/kxyj/qwfb/',
      },
      {
        repeat: {
          pattern: '0 2 * * *',
        },
        jobId: 'crawler-信通院',
      },
    )
    expect(mockCrawlerQueue.add).toHaveBeenNthCalledWith(
      3,
      'crawl-tech',
      {
        source: 'IDC',
        category: 'tech',
        url: 'https://www.idc.com/research',
      },
      {
        repeat: {
          pattern: '0 2 * * *',
        },
        jobId: 'crawler-IDC',
      },
    )
  })

  it('falls back to the default Story 2.1 sources when the source lookup fails', async () => {
    mockRadarSourceService.findAll.mockRejectedValue(new Error('database unavailable'))

    await (moduleUnderTest as any).setupCrawlerJobs()

    expect(mockCrawlerQueue.add).toHaveBeenCalledTimes(3)
    expect(mockCrawlerQueue.add).toHaveBeenCalledWith(
      'crawl-tech',
      expect.objectContaining({
        category: 'tech',
      }),
      expect.objectContaining({
        repeat: {
          pattern: '0 2 * * *',
        },
      }),
    )
  })
})
