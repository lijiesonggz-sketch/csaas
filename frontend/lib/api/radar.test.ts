/**
 * Radar API TypeScript Interface Tests
 * Story 3.3 - Phase 1 Task 1.2: 扩展RadarPush接口
 *
 * 测试目标：验证行业雷达特定字段的TypeScript类型定义
 */

import { RadarPush, ROIAnalysis } from './radar'

describe('RadarPush Interface - Industry Radar Fields', () => {
  describe('Type Safety', () => {
    it('should allow industry radar specific fields', () => {
      const industryPush: RadarPush = {
        pushId: 'test-push-1',
        radarType: 'industry',
        title: '某银行数字化转型实践',
        summary: '实践摘要',
        relevanceScore: 0.95,
        priorityLevel: 1,
        weaknessCategories: ['数字化转型'],
        url: 'https://example.com',
        publishDate: '2024-01-15',
        source: '金融科技媒体',
        tags: ['数字化', '转型'],
        targetAudience: '金融机构IT总监',
        isRead: false,

        // 行业雷达特定字段 (Story 3.3新增)
        peerName: '某城商行',
        practiceDescription: '该行通过云原生技术实现核心系统重构...',
        estimatedCost: '500-1000万元',
        implementationPeriod: '6-12个月',
        technicalEffect: '系统响应速度提升50%，运维成本降低30%',
      }

      expect(industryPush.peerName).toBe('某城商行')
      expect(industryPush.practiceDescription).toBeDefined()
      expect(industryPush.estimatedCost).toBe('500-1000万元')
    })

    it('should allow tech radar without industry fields', () => {
      const techPush: RadarPush = {
        pushId: 'test-push-2',
        radarType: 'tech',
        title: 'Kubernetes容器编排技术',
        summary: '技术摘要',
        relevanceScore: 0.90,
        priorityLevel: 2,
        weaknessCategories: ['容器化'],
        url: 'https://example.com',
        publishDate: '2024-01-20',
        source: '技术博客',
        tags: ['云原生', 'Kubernetes'],
        targetAudience: '开发团队',
        roiAnalysis: {
          estimatedCost: '100-200万元',
          expectedBenefit: '年节省运维成本150万元',
          roiEstimate: '75%',
          implementationPeriod: '3-6个月',
          recommendedVendors: ['阿里云', '腾讯云'],
        },
        isRead: false,
      }

      expect(techPush.radarType).toBe('tech')
      expect(techPush.roiAnalysis).toBeDefined()
      expect(techPush.peerName).toBeUndefined() // 技术雷达不需要peerName
    })

    it('should make industry fields optional', () => {
      // 测试行业雷达字段为可选（Optional）
      const pushWithoutIndustryFields: RadarPush = {
        pushId: 'test-push-3',
        radarType: 'industry',
        title: '测试推送',
        summary: '测试摘要',
        relevanceScore: 0.85,
        priorityLevel: 3,
        weaknessCategories: [],
        url: 'https://example.com',
        publishDate: '2024-01-25',
        source: '测试来源',
        tags: [],
        targetAudience: '测试用户',
        isRead: false,
        // 不提供行业雷达字段也应该通过类型检查
      }

      expect(pushWithoutIndustryFields.peerName).toBeUndefined()
      expect(pushWithoutIndustryFields.practiceDescription).toBeUndefined()
    })
  })

  describe('Data Validation', () => {
    it('should validate peerName is string', () => {
      const push: Partial<RadarPush> = {
        peerName: '中国银行',
      }

      expect(typeof push.peerName).toBe('string')
    })

    it('should validate practiceDescription is string', () => {
      const push: Partial<RadarPush> = {
        practiceDescription: '技术实践描述内容...',
      }

      expect(typeof push.practiceDescription).toBe('string')
      expect(push.practiceDescription.length).toBeGreaterThan(0)
    })

    it('should validate estimatedCost is string', () => {
      const push: Partial<RadarPush> = {
        estimatedCost: '500-1000万元',
      }

      expect(typeof push.estimatedCost).toBe('string')
    })

    it('should validate implementationPeriod is string', () => {
      const push: Partial<RadarPush> = {
        implementationPeriod: '6-12个月',
      }

      expect(typeof push.implementationPeriod).toBe('string')
    })

    it('should validate technicalEffect is string', () => {
      const push: Partial<RadarPush> = {
        technicalEffect: '系统性能提升50%',
      }

      expect(typeof push.technicalEffect).toBe('string')
    })
  })

  describe('RadarType Discrimination', () => {
    it('should differentiate industry radar from tech radar', () => {
      const industryPush: RadarPush = {
        pushId: 'industry-1',
        radarType: 'industry',
        title: '行业案例',
        summary: '摘要',
        relevanceScore: 0.90,
        priorityLevel: 1,
        weaknessCategories: [],
        url: 'https://example.com',
        publishDate: '2024-01-30',
        source: '来源',
        tags: [],
        targetAudience: '目标用户',
        isRead: false,
        peerName: '同业机构',
      }

      const techPush: RadarPush = {
        pushId: 'tech-1',
        radarType: 'tech',
        title: '技术方案',
        summary: '摘要',
        relevanceScore: 0.88,
        priorityLevel: 2,
        weaknessCategories: [],
        url: 'https://example.com',
        publishDate: '2024-01-30',
        source: '来源',
        tags: [],
        targetAudience: '目标用户',
        roiAnalysis: {
          estimatedCost: '100万',
          expectedBenefit: '年节省150万',
          roiEstimate: '50%',
          implementationPeriod: '6个月',
          recommendedVendors: [],
        },
        isRead: false,
      }

      expect(industryPush.radarType).toBe('industry')
      expect(techPush.radarType).toBe('tech')

      // 类型区分：行业雷达有peerName，技术雷达有roiAnalysis
      if (industryPush.radarType === 'industry') {
        expect(industryPush.peerName).toBeDefined()
      }
      if (techPush.radarType === 'tech') {
        expect(techPush.roiAnalysis).toBeDefined()
      }
    })
  })
})
