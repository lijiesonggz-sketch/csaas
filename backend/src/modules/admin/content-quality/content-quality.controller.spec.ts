import { Test, TestingModule } from '@nestjs/testing';
import { ContentQualityController } from './content-quality.controller';
import { ContentQualityService } from './content-quality.service';

/**
 * Story 7.2: 内容质量管理 - Backend API Tests
 * Controller unit tests aligned with the current admin content-quality API.
 */

describe('ContentQualityController', () => {
  let controller: ContentQualityController;

  const mockContentQualityService = {
    getContentQualityMetrics: jest.fn(),
    getLowRatedPushes: jest.fn(),
    getPushFeedbackDetails: jest.fn(),
    markPushAsOptimized: jest.fn(),
    markPushAsIgnored: jest.fn(),
    getQualityTrends: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentQualityController],
      providers: [
        {
          provide: ContentQualityService,
          useValue: mockContentQualityService,
        },
      ],
    }).compile();

    controller = module.get<ContentQualityController>(ContentQualityController);
  });

  describe('GET /api/v1/admin/content-quality/metrics', () => {
    it('should return average rating and distribution', async () => {
      mockContentQualityService.getContentQualityMetrics.mockResolvedValue({
        averageRating: 3.8,
        totalFeedback: 150,
        ratingDistribution: {
          1: 10,
          2: 15,
          3: 30,
          4: 50,
          5: 45,
        },
        lowRatedPushes: 25,
        targetAchievement: 63,
      });

      const result = await controller.getContentQualityMetrics();

      expect(result.averageRating).toBe(3.8);
      expect(result.ratingDistribution).toBeDefined();
      expect(result.lowRatedPushes).toBe(25);
      expect(result.targetAchievement).toBe(63);
    });
  });

  describe('GET /api/v1/admin/content-quality/low-rated', () => {
    it('should return pushes with rating < 3.0 sorted by rating', async () => {
      mockContentQualityService.getLowRatedPushes.mockResolvedValue({
        data: [
          {
            pushId: 'push-1',
            title: 'Low quality push',
            radarType: 'tech',
            averageRating: 2.1,
            feedbackCount: 10,
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
          },
          {
            pushId: 'push-2',
            title: 'Another low push',
            radarType: 'industry',
            averageRating: 2.5,
            feedbackCount: 8,
            createdAt: new Date('2026-03-02T00:00:00.000Z'),
          },
        ],
        meta: {
          total: 2,
        },
      });

      const result = await controller.getLowRatedPushes({});

      expect(mockContentQualityService.getLowRatedPushes).toHaveBeenCalledWith({
        limit: undefined,
        radarType: undefined,
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0].averageRating).toBeLessThan(3.0);
      expect(result.data[0].averageRating).toBeLessThanOrEqual(
        result.data[1].averageRating,
      );
      expect(result.meta.total).toBe(2);
    });
  });

  describe('GET /api/v1/admin/content-quality/pushes/:id/feedback', () => {
    it('should return push content, feedbacks, and optimization suggestions', async () => {
      mockContentQualityService.getPushFeedbackDetails.mockResolvedValue({
        push: {
          id: 'push-1',
          title: 'Test Push',
          summary: 'Push summary...',
          fullContent: 'Push content...',
          radarType: 'tech',
          relevanceScore: 0.3,
          source: 'GARTNER',
        },
        feedback: [
          {
            id: 'feedback-1',
            rating: 2,
            comment: 'Not relevant',
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            user: { id: 'user-1', name: 'User 1' },
          },
          {
            id: 'feedback-2',
            rating: 1,
            comment: 'Poor quality',
            createdAt: new Date('2026-03-02T00:00:00.000Z'),
            user: { id: 'user-2', name: 'User 2' },
          },
        ],
        optimizationSuggestions: ['提高相关性', '验证信息源'],
        status: 'pending',
      });

      const result = await controller.getPushFeedbackDetails('push-1');

      expect(result.push).toBeDefined();
      expect(result.feedback).toHaveLength(2);
      expect(result.optimizationSuggestions).toContain('提高相关性');
      expect(result.status).toBe('pending');
    });
  });

  describe('PUT /api/v1/admin/content-quality/pushes/:id/optimize', () => {
    it('should mark push as optimized', async () => {
      mockContentQualityService.markPushAsOptimized.mockResolvedValue({
        message: '已标记为已优化',
        status: 'optimized',
      });

      const result = await controller.markPushAsOptimized('push-1');

      expect(result.status).toBe('optimized');
      expect(result.message).toBe('已标记为已优化');
    });
  });

  describe('GET /api/v1/admin/content-quality/trends', () => {
    it('should return rating and low-rated push trends', async () => {
      mockContentQualityService.getQualityTrends.mockResolvedValue({
        averageRatingTrend: [
          { date: '2026-03-01', value: 3.5 },
          { date: '2026-03-02', value: 3.8 },
        ],
        lowRatedPushCountTrend: [
          { date: '2026-03-01', value: 5 },
          { date: '2026-03-02', value: 3 },
        ],
      });

      const result = await controller.getQualityTrends({});

      expect(mockContentQualityService.getQualityTrends).toHaveBeenCalledWith(
        undefined,
      );
      expect(result.averageRatingTrend).toHaveLength(2);
      expect(result.lowRatedPushCountTrend[0].value).toBe(5);
    });
  });
});
