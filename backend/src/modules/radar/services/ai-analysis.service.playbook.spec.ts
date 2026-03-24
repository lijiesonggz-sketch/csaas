import { Test, TestingModule } from '@nestjs/testing'
import { AIAnalysisService } from './ai-analysis.service'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { AnalyzedContent } from '../../../database/entities/analyzed-content.entity'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { TagService } from './tag.service'
import { AnalyzedContentService } from './analyzed-content.service'
import { CompliancePlaybook } from '../../../database/entities/compliance-playbook.entity'
import { v4 as uuidv4 } from 'uuid'
import { AIUsageService } from '../../admin/cost-optimization/ai-usage.service'

/**
 * AIAnalysisService - Compliance Playbook Generation Tests (Story 4.2)
 *
 * 测试Task 2.1: 扩展AI分析Service生成应对剧本（含缓存和验证）
 */
describe('AIAnalysisService - Compliance Playbook Generation', () => {
  let service: AIAnalysisService
  let rawContentRepo: Repository<RawContent>
  let aiOrchestrator: AIOrchestrator
  let crawlerQueue: Queue

  const mockRawContent: Partial<RawContent> = {
    id: 'raw-content-uuid',
    title: '数据安全违规处罚案例',
    url: 'https://example.com/penalty-case',
    publishDate: new Date('2026-01-30'),
    fullContent:
      '某银行因数据安全管理不到位，违反《银行业金融机构数据治理指引》，被处以50万元罚款。',
    organizationId: 'org-123',
  }

  const mockAnalyzedContent: Partial<AnalyzedContent> = {
    id: 'analyzed-uuid',
    contentId: 'raw-content-uuid',
    complianceAnalysis: {
      complianceRiskCategory: '数据安全',
      penaltyCase: '某银行因数据安全管理不到位，被处以50万元罚款',
      policyRequirements: null,
      remediationSuggestions: '建立完善的数据分类分级制度',
      relatedWeaknessCategories: ['数据安全', '个人信息保护'],
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAnalysisService,
        {
          provide: getRepositoryToken(RawContent),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getQueueToken('radar-crawler'),
          useValue: {
            client: Promise.resolve({
              get: jest.fn(),
              setex: jest.fn(),
            }),
          },
        },
        {
          provide: AIOrchestrator,
          useValue: {
            generate: jest.fn(),
          },
        },
        {
          provide: TagService,
          useValue: {
            findOrCreate: jest.fn(),
          },
        },
        {
          provide: AnalyzedContentService,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AIUsageService,
          useValue: {
            logAIUsage: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<AIAnalysisService>(AIAnalysisService)
    rawContentRepo = module.get<Repository<RawContent>>(getRepositoryToken(RawContent))
    aiOrchestrator = module.get<AIOrchestrator>(AIOrchestrator)
    crawlerQueue = module.get<Queue>(getQueueToken('radar-crawler'))
  })

  describe('Task 3.1: calculateComplianceROI', () => {
    it('should be defined', () => {
      // Assert
      expect(service).toBeDefined()
    })

    it('should have calculateComplianceROI method', () => {
      // Assert
      expect(typeof service.calculateComplianceROI).toBe('function')
    })

    it('should calculate ROI correctly for typical case', () => {
      // Arrange
      const solution = {
        name: '数据安全整改',
        estimatedCost: 500000,
        expectedBenefit: 2000000,
      }

      // Act
      const score = service.calculateComplianceROI(solution)

      // Assert
      // ROI = (200万 - 50万) / 50万 = 3
      // Score 7 (3-5区间)
      expect(score).toBe(7)
    })

    it('should throw error for zero cost', () => {
      // Arrange
      const solution = {
        estimatedCost: 0,
        expectedBenefit: 100000,
      }

      // Act & Assert
      expect(() => service.calculateComplianceROI(solution)).toThrow('Invalid estimated cost')
    })

    it('should throw error for negative cost', () => {
      // Arrange
      const solution = {
        estimatedCost: -100000,
        expectedBenefit: 100000,
      }

      // Act & Assert
      expect(() => service.calculateComplianceROI(solution)).toThrow('Invalid estimated cost')
    })

    it('should handle very high ROI', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: 2000000, // ROI = 19
      }

      // Act
      const score = service.calculateComplianceROI(solution)

      // Assert
      expect(score).toBe(10) // Max score
    })

    it('should handle negative ROI', () => {
      // Arrange
      const solution = {
        estimatedCost: 100000,
        expectedBenefit: 50000, // ROI = -0.5
      }

      // Act
      const score = service.calculateComplianceROI(solution)

      // Assert
      expect(score).toBe(1) // Min score
    })
  })

  describe('Task 2.1: generateCompliancePlaybook', () => {
    it('should have generateCompliancePlaybook method', () => {
      // Assert
      expect(typeof service.generateCompliancePlaybook).toBe('function')
    })

    it('should generate playbook with required fields', async () => {
      // Arrange
      const rawContent = mockRawContent as RawContent
      const analyzedContent = mockAnalyzedContent as AnalyzedContent

      // Mock AI response
      const aiPlaybookResponse = {
        checklistItems: [
          {
            id: uuidv4(),
            text: '检查数据安全制度',
            category: '数据安全',
            checked: false,
            order: 1,
          },
          {
            id: uuidv4(),
            text: '建立访问控制机制',
            category: '数据安全',
            checked: false,
            order: 2,
          },
          { id: uuidv4(), text: '开展安全培训', category: '数据安全', checked: false, order: 3 },
          { id: uuidv4(), text: '实施数据加密', category: '数据安全', checked: false, order: 4 },
          { id: uuidv4(), text: '定期审计', category: '数据安全', checked: false, order: 5 },
        ],
        solutions: [
          {
            name: '升级安全系统',
            estimatedCost: 500000,
            expectedBenefit: 2000000,
            roiScore: 7,
            implementationTime: '2个月',
          },
        ],
        reportTemplate: '合规自查报告模板',
        policyReference: ['https://example.com/law1'],
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue({
        content: JSON.stringify(aiPlaybookResponse),
        model: AIModel.DOMESTIC,
        tokens: { prompt: 1000, completion: 500, total: 1500 },
        cost: 0.15,
      })

      // Act
      const playbook = await service.generateCompliancePlaybook(analyzedContent, rawContent)

      // Assert
      expect(playbook).toBeDefined()
      expect(playbook.checklistItems).toHaveLength(5)
      expect(playbook.solutions).toHaveLength(1)
      expect(playbook.reportTemplate).toBeDefined()
      expect(playbook.policyReference).toBeDefined()
    })

    it('should use cache for subsequent calls', async () => {
      // Arrange
      const rawContent = mockRawContent as RawContent
      const analyzedContent = mockAnalyzedContent as AnalyzedContent
      const redisClient = await crawlerQueue.client

      const cachedPlaybook = {
        checklistItems: [
          { id: uuidv4(), text: 'Cached item', category: '数据安全', checked: false, order: 1 },
        ],
        solutions: [],
        reportTemplate: 'Cached template',
        policyReference: [],
      }

      // Mock cache hit
      jest.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(cachedPlaybook))

      // Act
      const playbook = await service.generateCompliancePlaybook(analyzedContent, rawContent)

      // Assert
      expect(playbook).toEqual(cachedPlaybook)
      expect(redisClient.get).toHaveBeenCalled()
      expect(aiOrchestrator.generate).not.toHaveBeenCalled()
    })

    it('should return default playbook on AI failure', async () => {
      // Arrange
      const rawContent = mockRawContent as RawContent
      const analyzedContent = mockAnalyzedContent as AnalyzedContent

      // Mock AI failure
      jest.spyOn(aiOrchestrator, 'generate').mockRejectedValue(new Error('AI service unavailable'))

      // Act
      const playbook = await service.generateCompliancePlaybook(analyzedContent, rawContent)

      // Assert
      expect(playbook).toBeDefined()
      expect(playbook.checklistItems).toHaveLength(5) // Default checklist
      expect(playbook.reportTemplate).toContain('合规自查报告')
      expect(playbook.policyReference).toEqual([])
    })

    it('should return default playbook when AI response is invalid', async () => {
      // Arrange
      const rawContent = mockRawContent as RawContent
      const analyzedContent = mockAnalyzedContent as AnalyzedContent

      // Mock AI response with invalid checklist count (< 5)
      const invalidPlaybook = {
        checklistItems: [
          { id: uuidv4(), text: 'Only one item', category: '数据安全', checked: false, order: 1 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue({
        content: JSON.stringify(invalidPlaybook),
        model: AIModel.DOMESTIC,
        tokens: { prompt: 1000, completion: 500, total: 1500 },
        cost: 0.15,
      })

      // Act
      const playbook = await service.generateCompliancePlaybook(analyzedContent, rawContent)

      // Assert - Should return default playbook (fallback strategy)
      expect(playbook).toBeDefined()
      expect(playbook.checklistItems).toHaveLength(5) // Default checklist
      expect(playbook.reportTemplate).toContain('合规自查报告')
    })

    it('should cache result with 7-day TTL', async () => {
      // Arrange
      const rawContent = mockRawContent as RawContent
      const analyzedContent = mockAnalyzedContent as AnalyzedContent
      const redisClient = await crawlerQueue.client

      const validPlaybook = {
        checklistItems: [
          { id: uuidv4(), text: 'Item 1', category: '数据安全', checked: false, order: 1 },
          { id: uuidv4(), text: 'Item 2', category: '数据安全', checked: false, order: 2 },
          { id: uuidv4(), text: 'Item 3', category: '数据安全', checked: false, order: 3 },
          { id: uuidv4(), text: 'Item 4', category: '数据安全', checked: false, order: 4 },
          { id: uuidv4(), text: 'Item 5', category: '数据安全', checked: false, order: 5 },
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      jest.spyOn(aiOrchestrator, 'generate').mockResolvedValue({
        content: JSON.stringify(validPlaybook),
        model: AIModel.DOMESTIC,
        tokens: { prompt: 1000, completion: 500, total: 1500 },
        cost: 0.15,
      })

      // Act
      await service.generateCompliancePlaybook(analyzedContent, rawContent)

      // Assert
      const expectedTTL = 7 * 24 * 60 * 60 // 7天
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('radar:compliance:playbook:'),
        expectedTTL,
        expect.any(String),
      )
    })
  })

  describe('validatePlaybookStructure', () => {
    it('should accept valid playbook with 5 items', () => {
      // Arrange
      const validPlaybook = {
        checklistItems: Array.from({ length: 5 }, (_, i) => ({
          id: uuidv4(),
          text: `Item ${i + 1}`,
          category: '数据安全',
          checked: false,
          order: i + 1,
        })),
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      // Act & Assert
      expect(() => service['validatePlaybookStructure'](validPlaybook)).not.toThrow()
    })

    it('should accept valid playbook with 10 items', () => {
      // Arrange
      const validPlaybook = {
        checklistItems: Array.from({ length: 10 }, (_, i) => ({
          id: uuidv4(),
          text: `Item ${i + 1}`,
          category: '数据安全',
          checked: false,
          order: i + 1,
        })),
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      // Act & Assert
      expect(() => service['validatePlaybookStructure'](validPlaybook)).not.toThrow()
    })

    it('should reject playbook with less than 5 items', () => {
      // Arrange
      const invalidPlaybook = {
        checklistItems: Array.from({ length: 4 }, (_, i) => ({
          id: uuidv4(),
          text: `Item ${i + 1}`,
          category: '数据安全',
          checked: false,
          order: i + 1,
        })),
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      // Act & Assert
      expect(() => service['validatePlaybookStructure'](invalidPlaybook)).toThrow(
        'Checklist items must be 5-10 items',
      )
    })

    it('should reject playbook with more than 10 items', () => {
      // Arrange
      const invalidPlaybook = {
        checklistItems: Array.from({ length: 11 }, (_, i) => ({
          id: uuidv4(),
          text: `Item ${i + 1}`,
          category: '数据安全',
          checked: false,
          order: i + 1,
        })),
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      // Act & Assert
      expect(() => service['validatePlaybookStructure'](invalidPlaybook)).toThrow(
        'Checklist items must be 5-10 items',
      )
    })

    it('should reject playbook with missing checklistItems', () => {
      // Arrange
      const invalidPlaybook = {
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      // Act & Assert
      expect(() => service['validatePlaybookStructure'](invalidPlaybook)).toThrow(
        'Invalid playbook structure: missing checklistItems',
      )
    })

    it('should validate checklist item required fields', () => {
      // Arrange
      const invalidPlaybook = {
        checklistItems: [
          { id: uuidv4(), text: 'Item', category: '数据安全', checked: false, order: 1 },
          { id: '', text: 'Item', category: '数据安全', checked: false, order: 2 }, // Missing id
        ],
        solutions: [],
        reportTemplate: 'Template',
        policyReference: [],
      }

      // Act & Assert
      expect(() => service['validatePlaybookStructure'](invalidPlaybook)).toThrow()
    })
  })

  describe('Default Playbook Generation', () => {
    it('should generate default checklist based on compliance category', () => {
      // Arrange
      const analyzedContent = mockAnalyzedContent as AnalyzedContent
      const rawContent = mockRawContent as RawContent

      // Act
      const defaultPlaybook = service['getDefaultPlaybook'](analyzedContent, rawContent)

      // Assert
      expect(defaultPlaybook.checklistItems).toHaveLength(5)
      expect(defaultPlaybook.checklistItems[0].category).toBe('数据安全')
      expect(defaultPlaybook.reportTemplate).toContain('合规自查报告')
      expect(defaultPlaybook.policyReference).toEqual([])
    })

    it('should generate default solutions with ROI scores', () => {
      // Arrange
      const analyzedContent = mockAnalyzedContent as AnalyzedContent
      const rawContent = mockRawContent as RawContent

      // Act
      const defaultPlaybook = service['getDefaultPlaybook'](analyzedContent, rawContent)

      // Assert
      expect(defaultPlaybook.solutions).toHaveLength(3)
      defaultPlaybook.solutions.forEach((solution) => {
        expect(solution.roiScore).toBeGreaterThanOrEqual(0)
        expect(solution.roiScore).toBeLessThanOrEqual(10)
        expect(solution.name).toBeDefined()
        expect(solution.estimatedCost).toBeGreaterThan(0)
        expect(solution.expectedBenefit).toBeGreaterThan(0)
      })
    })
  })
})
