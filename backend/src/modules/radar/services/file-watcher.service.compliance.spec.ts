import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { FileWatcherService } from './file-watcher.service'
import { Repository, DataSource } from 'typeorm'
import { getTestDataSource } from '../../../test/test-db.config'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { BullModule } from '@nestjs/bullmq'
import { Test, TestingModule } from '@nestjs/testing'

/**
 * FileWatcherService Tests - 合规雷达文件导入
 *
 * Story 4.1: 测试FileWatcherService的extractComplianceData方法
 */
describe('FileWatcherService - Compliance Radar', () => {
  let service: FileWatcherService
  let dataSource: DataSource
  let rawContentRepository: Repository<RawContent>

  beforeAll(async () => {
    dataSource = await getTestDataSource()
    rawContentRepository = dataSource.getRepository(RawContent)

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({
          name: 'radar-ai-analysis',
        }),
      ],
      providers: [
        FileWatcherService,
        {
          provide: 'RAW_CONTENT_REPOSITORY',
          useValue: rawContentRepository,
        },
      ],
    }).compile()

    service = module.get<FileWatcherService>(FileWatcherService)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await rawContentRepository.clear()
    jest.clearAllMocks()
  })

  describe('extractComplianceData method', () => {
    it('should extract penalty data from frontmatter and content', () => {
      const frontmatter = {
        source: '银保监会',
        category: 'compliance',
        type: 'penalty',
        url: 'http://www.cbrc.gov.cn/penalty/001',
        publishDate: '2026-01-15',
        penaltyInstitution: '某银行',
        penaltyAmount: '50万元',
        policyBasis: '《数据治理指引》',
      }

      const fullContent = `
# 处罚通报

被处罚机构：某城市商业银行
处罚原因：数据安全管理不到位
处罚金额：50万元
政策依据：《银行业金融机构数据治理指引》
      `.trim()

      // 调用私有方法（通过测试辅助函数）
      const complianceData = service['extractComplianceData'](fullContent, frontmatter)

      expect(complianceData).toBeDefined()
      expect(complianceData.type).toBe('penalty')
      expect(complianceData.penaltyInstitution).toBe('某银行')
      expect(complianceData.penaltyAmount).toBe('50万元')
      expect(complianceData.policyBasis).toBe('《数据治理指引》')
    })

    it('should extract policy draft data from frontmatter and content', () => {
      const frontmatter = {
        source: '人民银行',
        category: 'compliance',
        type: 'policy_draft',
        url: 'http://www.pbc.gov.cn/policy/001',
        publishDate: '2026-01-20',
        policyTitle: '网络安全管理办法',
        commentDeadline: '2026-03-31',
      }

      const fullContent = `
# 金融机构网络安全管理办法（征求意见稿）

主要要求：建立网络安全防护体系、网络分区管理、安全监测预警
预计实施：2026年7月
      `.trim()

      const complianceData = service['extractComplianceData'](fullContent, frontmatter)

      expect(complianceData).toBeDefined()
      expect(complianceData.type).toBe('policy_draft')
      expect(complianceData.policyTitle).toBe('网络安全管理办法')
      expect(complianceData.commentDeadline).toEqual(new Date('2026-03-31'))
    })

    it('should throw error for invalid type', () => {
      const frontmatter = {
        source: '银保监会',
        category: 'compliance',
        type: 'invalid-type', // 无效的类型
      }

      const fullContent = 'Test content'

      expect(() => {
        service['extractComplianceData'](fullContent, frontmatter)
      }).toThrow('Invalid type for compliance radar')
    })

    it('should extract fields from content when not in frontmatter', () => {
      const frontmatter = {
        source: '银保监会',
        category: 'compliance',
        type: 'penalty',
      }

      const fullContent = `
被处罚机构：某城市商业银行
处罚原因：数据安全管理不到位
      `.trim()

      const complianceData = service['extractComplianceData'](fullContent, frontmatter)

      expect(complianceData.penaltyInstitution).toBe('某城市商业银行')
      expect(complianceData.penaltyReason).toBe('数据安全管理不到位')
    })
  })
})
