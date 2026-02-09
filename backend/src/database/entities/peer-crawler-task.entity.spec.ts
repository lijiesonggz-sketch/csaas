import { PeerCrawlerTask } from './peer-crawler-task.entity'

/**
 * PeerCrawlerTask Entity Unit Tests
 *
 * Story 8.2: 同业采集任务调度与执行
 */
describe('PeerCrawlerTask Entity', () => {
  describe('entity structure', () => {
    it('should have all required properties', () => {
      const task = new PeerCrawlerTask()

      // Required fields
      task.id = 'test-id'
      task.sourceId = 'source-id'
      task.peerName = '杭州银行'
      task.tenantId = 'tenant-id'
      task.status = 'pending'
      task.sourceType = 'website'
      task.targetUrl = 'https://example.com'
      task.retryCount = 0
      task.createdAt = new Date()
      task.updatedAt = new Date()

      expect(task.id).toBe('test-id')
      expect(task.sourceId).toBe('source-id')
      expect(task.peerName).toBe('杭州银行')
      expect(task.tenantId).toBe('tenant-id')
      expect(task.status).toBe('pending')
      expect(task.sourceType).toBe('website')
      expect(task.targetUrl).toBe('https://example.com')
      expect(task.retryCount).toBe(0)
    })

    it('should support all status values', () => {
      const task = new PeerCrawlerTask()
      const statuses: Array<'pending' | 'running' | 'completed' | 'failed'> = [
        'pending',
        'running',
        'completed',
        'failed',
      ]

      statuses.forEach((status) => {
        task.status = status
        expect(task.status).toBe(status)
      })
    })

    it('should support all source types', () => {
      const task = new PeerCrawlerTask()
      const sourceTypes: Array<'website' | 'wechat' | 'recruitment' | 'conference'> = [
        'website',
        'wechat',
        'recruitment',
        'conference',
      ]

      sourceTypes.forEach((type) => {
        task.sourceType = type
        expect(task.sourceType).toBe(type)
      })
    })

    it('should handle optional crawlResult', () => {
      const task = new PeerCrawlerTask()

      // Without crawlResult
      expect(task.crawlResult).toBeUndefined()

      // With crawlResult
      task.crawlResult = {
        title: 'Test Title',
        content: 'Test content',
        publishDate: '2026-01-23',
        author: 'Test Author',
        url: 'https://example.com',
      }

      expect(task.crawlResult).toEqual({
        title: 'Test Title',
        content: 'Test content',
        publishDate: '2026-01-23',
        author: 'Test Author',
        url: 'https://example.com',
      })
    })

    it('should handle optional crawlResult with minimal fields', () => {
      const task = new PeerCrawlerTask()

      task.crawlResult = {
        title: 'Test Title',
        content: 'Test content',
        url: 'https://example.com',
      }

      expect(task.crawlResult.title).toBe('Test Title')
      expect(task.crawlResult.content).toBe('Test content')
      expect(task.crawlResult.url).toBe('https://example.com')
      expect(task.crawlResult.publishDate).toBeUndefined()
      expect(task.crawlResult.author).toBeUndefined()
    })

    it('should handle optional fields', () => {
      const task = new PeerCrawlerTask()

      // All optional fields should be undefined initially
      expect(task.crawlResult).toBeUndefined()
      expect(task.rawContentId).toBeUndefined()
      expect(task.errorMessage).toBeUndefined()
      expect(task.startedAt).toBeUndefined()
      expect(task.completedAt).toBeUndefined()
      expect(task.deletedAt).toBeUndefined()

      // Set optional fields
      task.rawContentId = 'raw-content-id'
      task.errorMessage = 'Error occurred'
      task.startedAt = new Date('2026-01-23T10:00:00Z')
      task.completedAt = new Date('2026-01-23T10:05:00Z')
      task.deletedAt = null

      expect(task.rawContentId).toBe('raw-content-id')
      expect(task.errorMessage).toBe('Error occurred')
      expect(task.startedAt).toEqual(new Date('2026-01-23T10:00:00Z'))
      expect(task.completedAt).toEqual(new Date('2026-01-23T10:05:00Z'))
      expect(task.deletedAt).toBeNull()
    })

    it('should calculate execution duration', () => {
      const task = new PeerCrawlerTask()

      task.startedAt = new Date('2026-01-23T10:00:00Z')
      task.completedAt = new Date('2026-01-23T10:05:30Z')

      const duration = task.completedAt.getTime() - task.startedAt.getTime()
      expect(duration).toBe(330000) // 5 minutes 30 seconds in milliseconds
    })

    it('should handle null rawContentId', () => {
      const task = new PeerCrawlerTask()
      task.rawContentId = null

      expect(task.rawContentId).toBeNull()
    })

    it('should handle timestamps correctly', () => {
      const task = new PeerCrawlerTask()
      const now = new Date()

      task.createdAt = now
      task.updatedAt = now
      task.startedAt = now
      task.completedAt = now

      expect(task.createdAt).toEqual(now)
      expect(task.updatedAt).toEqual(now)
      expect(task.startedAt).toEqual(now)
      expect(task.completedAt).toEqual(now)
    })
  })

  describe('entity instantiation', () => {
    it('should create instance with partial data', () => {
      const task = new PeerCrawlerTask()

      // Only set required fields
      task.sourceId = 'source-1'
      task.peerName = '宁波银行'
      task.tenantId = 'tenant-1'
      task.sourceType = 'wechat'
      task.targetUrl = 'https://wechat.example.com'

      expect(task.sourceId).toBe('source-1')
      expect(task.peerName).toBe('宁波银行')
      expect(task.tenantId).toBe('tenant-1')
      expect(task.sourceType).toBe('wechat')
      expect(task.targetUrl).toBe('https://wechat.example.com')
    })

    it('should support retry count increment', () => {
      const task = new PeerCrawlerTask()
      task.retryCount = 0

      expect(task.retryCount).toBe(0)

      task.retryCount = 1
      expect(task.retryCount).toBe(1)

      task.retryCount = 2
      expect(task.retryCount).toBe(2)
    })
  })
})
