import { describe, it, expect, beforeEach } from '@jest/globals'
import { DataSource, Repository } from 'typeorm'
import { getTestDataSource } from '../../test/test-db.config'
import { RawContent } from '../database/entities/raw-content.entity'

/**
 * RawContent Entity Tests - 合规雷达支持
 *
 * Story 4.1: 测试RawContent实体的complianceData字段
 */
describe('RawContent Entity - Compliance Radar', () => {
  let dataSource: DataSource
  let repository: Repository<RawContent>

  beforeAll(async () => {
    dataSource = await getTestDataSource()
    repository = dataSource.getRepository(RawContent)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await repository.clear()
  })

  describe('complianceData field', () => {
    it('should store penalty type compliance data', async () => {
      const rawContent = repository.create({
        source: '银保监会',
        category: 'compliance',
        title: '某银行数据安全违规处罚',
        fullContent: '处罚内容详情...',
        url: 'http://www.cbrc.gov.cn/penalty/001',
        publishDate: new Date('2026-01-15'),
        contentHash: 'hash-001',
        organizationId: null,
        complianceData: {
          type: 'penalty',
          penaltyInstitution: '某城市商业银行',
          penaltyReason: '数据安全管理不到位',
          penaltyAmount: '50万元',
          penaltyDate: new Date('2026-01-15'),
          policyBasis: '《银行业金融机构数据治理指引》',
        },
      })

      const saved = await repository.save(rawContent)

      expect(saved.complianceData).toBeDefined()
      expect(saved.complianceData.type).toBe('penalty')
      expect(saved.complianceData.penaltyInstitution).toBe('某城市商业银行')
      expect(saved.complianceData.penaltyAmount).toBe('50万元')
      expect(saved.complianceData.policyBasis).toBe('《银行业金融机构数据治理指引》')
    })

    it('should store policy_draft type compliance data', async () => {
      const rawContent = repository.create({
        source: '人民银行',
        category: 'compliance',
        title: '网络安全管理办法征求意见稿',
        fullContent: '政策内容详情...',
        url: 'http://www.pbc.gov.cn/policy/draft/001',
        publishDate: new Date('2026-01-20'),
        contentHash: 'hash-002',
        organizationId: null,
        complianceData: {
          type: 'policy_draft',
          policyTitle: '金融机构网络安全管理办法（征求意见稿）',
          commentDeadline: new Date('2026-03-31'),
          mainRequirements: '建立网络安全管理体系、网络分区管理、安全监测预警',
          expectedImplementationDate: new Date('2026-07-01'),
        },
      })

      const saved = await repository.save(rawContent)

      expect(saved.complianceData).toBeDefined()
      expect(saved.complianceData.type).toBe('policy_draft')
      expect(saved.complianceData.policyTitle).toBe('金融机构网络安全管理办法（征求意见稿）')
      expect(saved.complianceData.commentDeadline).toBeDefined()
      expect(saved.complianceData.mainRequirements).toContain('网络安全管理体系')
    })

    it('should allow null complianceData for other categories', async () => {
      const techContent = repository.create({
        source: 'GARTNER',
        category: 'tech',
        title: '云原生技术趋势',
        fullContent: '技术内容...',
        url: 'https://www.gartner.com/cloud-native',
        publishDate: new Date('2026-01-20'),
        contentHash: 'hash-tech-001',
        organizationId: null,
      })

      const saved = await repository.save(techContent)

      expect(saved.complianceData).toBeNull()
      expect(saved.category).toBe('tech')
    })
  })

  describe('contentHash uniqueness', () => {
    it('should enforce unique contentHash constraint', async () => {
      const contentData = {
        source: '银保监会',
        category: 'compliance' as const,
        title: '测试内容',
        fullContent: '测试内容...',
        url: 'http://test.com',
        publishDate: new Date(),
        contentHash: 'same-hash-123',
        organizationId: null,
        complianceData: {
          type: 'penalty' as const,
          penaltyInstitution: '测试银行',
        },
      }

      await repository.save(repository.create(contentData))

      // 尝试保存相同contentHash的记录
      const duplicate = repository.create({
        ...contentData,
        title: '不同标题但相同hash',
      })

      await expect(repository.save(duplicate)).rejects.toThrow()
    })
  })
})
