import { describe, it, expect, beforeEach } from '@jest/globals'
import { DataSource, Repository } from 'typeorm'
import { getTestDataSource } from '../../test/test-db.config'
import { AnalyzedContent } from '../database/entities/analyzed-content.entity'
import { RawContent } from '../database/entities/raw-content.entity'

/**
 * AnalyzedContent Entity Tests - 合规雷达支持
 *
 * Story 4.1: 测试AnalyzedContent实体的complianceAnalysis字段
 */
describe('AnalyzedContent Entity - Compliance Radar', () => {
  let dataSource: DataSource
  let repository: Repository<AnalyzedContent>
  let rawContentRepository: Repository<RawContent>

  beforeAll(async () => {
    dataSource = await getTestDataSource()
    repository = dataSource.getRepository(AnalyzedContent)
    rawContentRepository = dataSource.getRepository(RawContent)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await repository.clear()
    await rawContentRepository.clear()
  })

  describe('complianceAnalysis field', () => {
    it('should store penalty case compliance analysis', async () => {
      // 先创建RawContent
      const rawContent = await rawContentRepository.save({
        source: '银保监会',
        category: 'compliance',
        title: '某银行数据安全违规处罚',
        fullContent: '处罚内容...',
        url: 'http://www.cbrc.gov.cn/penalty/001',
        publishDate: new Date('2026-01-15'),
        contentHash: 'hash-penalty-001',
        organizationId: null,
        complianceData: {
          type: 'penalty',
          penaltyInstitution: '某银行',
          penaltyAmount: '50万元',
        },
      })

      // 创建AnalyzedContent
      const analyzedContent = repository.create({
        contentId: rawContent.id,
        tags: [],
        keywords: ['数据安全', '信息保护', '数据治理'],
        categories: ['合规', '数据安全'],
        targetAudience: '合规部门、IT部门',
        aiSummary: '该银行因数据安全管理不到位被处罚50万元',
        complianceAnalysis: {
          complianceRiskCategory: '数据安全',
          penaltyCase: '某银行因数据安全管理不到位，违反《银行业金融机构数据治理指引》，被处以50万元罚款',
          policyRequirements: null,
          remediationSuggestions: '1. 建立完善的数据分类分级制度; 2. 加强数据访问控制和权限管理',
          relatedWeaknessCategories: ['数据安全', '个人信息保护', '安全治理'],
        },
        aiModel: 'qwen-max',
        tokensUsed: 1500,
        status: 'success',
        analyzedAt: new Date(),
      })

      const saved = await repository.save(analyzedContent)

      expect(saved.complianceAnalysis).toBeDefined()
      expect(saved.complianceAnalysis.complianceRiskCategory).toBe('数据安全')
      expect(saved.complianceAnalysis.penaltyCase).toContain('50万元罚款')
      expect(saved.complianceAnalysis.remediationSuggestions).toContain('数据分类分级')
      expect(saved.complianceAnalysis.relatedWeaknessCategories).toContain('数据安全')
      expect(saved.complianceAnalysis.policyRequirements).toBeNull()
    })

    it('should store policy draft compliance analysis', async () => {
      const rawContent = await rawContentRepository.save({
        source: '人民银行',
        category: 'compliance',
        title: '网络安全管理办法征求意见',
        fullContent: '政策内容...',
        url: 'http://www.pbc.gov.cn/policy/001',
        publishDate: new Date('2026-01-20'),
        contentHash: 'hash-policy-001',
        organizationId: null,
        complianceData: {
          type: 'policy_draft',
          policyTitle: '网络安全管理办法',
        },
      })

      const analyzedContent = repository.create({
        contentId: rawContent.id,
        tags: [],
        keywords: ['网络安全', '管理', '合规'],
        categories: ['合规', '网络安全'],
        targetAudience: '合规部门、IT部门',
        aiSummary: '人民银行发布网络安全管理办法征求意见稿',
        complianceAnalysis: {
          complianceRiskCategory: '网络安全',
          penaltyCase: null,
          policyRequirements: '金融机构应当建立健全网络安全防护体系，包括网络分区管理、安全监测预警、应急响应机制',
          remediationSuggestions: '1. 评估现有网络安全防护体系差距; 2. 制定网络分区管理方案',
          relatedWeaknessCategories: ['网络与信息安全', '安全运营'],
        },
        aiModel: 'qwen-max',
        tokensUsed: 2000,
        status: 'success',
        analyzedAt: new Date(),
      })

      const saved = await repository.save(analyzedContent)

      expect(saved.complianceAnalysis).toBeDefined()
      expect(saved.complianceAnalysis.complianceRiskCategory).toBe('网络安全')
      expect(saved.complianceAnalysis.policyRequirements).toContain('网络安全防护体系')
      expect(saved.complianceAnalysis.remediationSuggestions).toContain('网络分区管理')
      expect(saved.complianceAnalysis.penaltyCase).toBeNull()
    })

    it('should allow null complianceAnalysis for non-compliance content', async () => {
      const rawContent = await rawContentRepository.save({
        source: 'GARTNER',
        category: 'tech',
        title: '云原生技术趋势',
        fullContent: '技术内容...',
        url: 'https://www.gartner.com/cloud-native',
        publishDate: new Date('2026-01-20'),
        contentHash: 'hash-tech-001',
        organizationId: null,
      })

      const analyzedContent = repository.create({
        contentId: rawContent.id,
        tags: [],
        keywords: ['云原生', '容器'],
        categories: ['基础设施'],
        targetAudience: 'IT架构师',
        aiSummary: '云原生技术趋势分析',
        complianceAnalysis: null, // 非合规内容，complianceAnalysis为null
        aiModel: 'qwen-max',
        tokensUsed: 1000,
        status: 'success',
        analyzedAt: new Date(),
      })

      const saved = await repository.save(analyzedContent)

      expect(saved.complianceAnalysis).toBeNull()
    })
  })
})
