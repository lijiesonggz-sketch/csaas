import { describe, it, expect, beforeEach } from '@jest/globals'
import { DataSource, Repository } from 'typeorm'
import { getTestDataSource } from '../../test/test-db.config'
import { RadarSource } from '../database/entities/radar-source.entity'

/**
 * RadarSource Entity Tests - 合规雷达支持
 *
 * Story 4.1: 测试RadarSource实体的唯一索引约束
 */
describe('RadarSource Entity - Compliance Radar', () => {
  let dataSource: DataSource
  let repository: Repository<RadarSource>

  beforeAll(async () => {
    dataSource = await getTestDataSource()
    repository = dataSource.getRepository(RadarSource)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await repository.clear()
  })

  describe('source + category unique constraint', () => {
    it('should allow same source name in different categories', async () => {
      // 创建tech category的"银保监会"
      await repository.save({
        source: '测试机构',
        category: 'tech',
        url: 'http://example.com/tech',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
        lastCrawlStatus: 'pending',
      })

      // 创建compliance category的"测试机构" - 应该成功
      const complianceSource = repository.create({
        source: '测试机构',
        category: 'compliance',
        url: 'http://example.com/compliance',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
      })

      const saved = await repository.save(complianceSource)

      expect(saved.id).toBeDefined()
      expect(saved.source).toBe('测试机构')
      expect(saved.category).toBe('compliance')
    })

    it('should prevent duplicate source + category combination', async () => {
      // 创建第一个compliance category的"银保监会"
      await repository.save({
        source: '银保监会',
        category: 'compliance',
        url: 'http://www.cbrc.gov.cn',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
        lastCrawlStatus: 'pending',
      })

      // 尝试创建第二个compliance category的"银保监会" - 应该失败
      const duplicate = repository.create({
        source: '银保监会',
        category: 'compliance',
        url: 'http://www.cbrc.gov.cn/alt',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 3 * * *',
        lastCrawlStatus: 'pending',
      })

      await expect(repository.save(duplicate)).rejects.toThrow()
    })

    it('should store all required compliance source fields', async () => {
      const source = repository.create({
        source: '银保监会',
        category: 'compliance',
        url: 'http://www.cbrc.gov.cn',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
        lastCrawlStatus: 'pending',
      })

      const saved = await repository.save(source)

      expect(saved.source).toBe('银保监会')
      expect(saved.category).toBe('compliance')
      expect(saved.url).toBe('http://www.cbrc.gov.cn')
      expect(saved.type).toBe('website')
      expect(saved.isActive).toBe(true)
      expect(saved.crawlSchedule).toBe('0 2 * * *')
      expect(saved.lastCrawlStatus).toBe('pending')
    })
  })

  describe('crawlStatus enum', () => {
    it('should only allow valid crawlStatus values', async () => {
      const source = repository.create({
        source: '测试机构',
        category: 'compliance',
        url: 'http://test.com',
        type: 'website',
        isActive: true,
        crawlSchedule: '0 2 * * *',
        lastCrawlStatus: 'success',
      })

      const saved = await repository.save(source)

      expect(saved.lastCrawlStatus).toBe('success')
    })

    it('should support pending, success, failed status', async () => {
      const statuses: Array<'pending' | 'success' | 'failed'> = ['pending', 'success', 'failed']

      for (const status of statuses) {
        const source = repository.create({
          source: `测试机构-${status}`,
          category: 'compliance',
          url: 'http://test.com',
          type: 'website',
          isActive: true,
          crawlSchedule: '0 2 * * *',
          lastCrawlStatus: status,
        })

        const saved = await repository.save(source)
        expect(saved.lastCrawlStatus).toBe(status)
      }
    })
  })
})
