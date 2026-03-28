import { Test, TestingModule } from '@nestjs/testing';
import { ContentQualityController } from './content-quality.controller';
import { ContentQualityService } from './content-quality.service';

/**
 * Story 7.2: 内容质量管理 - Backend API Tests
 * ATDD Tests - Red Phase (Failing Tests)
 */

describe('ContentQualityController', () => {
  let controller: ContentQualityController;
  let service: ContentQualityService;

  const mockContentQualityService = {
    getContentQualityMetrics: jest.fn(),
    getLowRatedPushes: jest.fn(),
    getPushFeedbackDetails: jest.fn(),
    markPushAsOptimized: jest.fn(),
    getQualityTrends: jest.fn(),
    submitPushFeedback: jest.fn(),
  };

  beforeEach(async () => {
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
    service = module.get<ContentQualityService>(ContentQualityService);
  });

  // AC2: Submit push feedback
  describe('POST /api/push-feedback', () => {
    it('should create feedback record with rating and comment', async () => {
      const feedbackDto = {
        pushId: 'push-123',
        rating: 4,
        comment: 'Great content!',
      };

      mockContentQualityService.submitPushFeedback.mockResolvedValue({
        id: 'feedback-1',
        ...feedbackDto,
        userId: 'user-1',
        createdAt: new Date(),
      });

      const result = await controller.submitPushFeedback(feedbackDto, { user: { id: 'user-1' } });

      expect(result).toHaveProperty('id');
      expect(result.rating).toBe(4);
      expect(result.comment).toBe('Great content!');
    });
  });

  // AC3: Get content quality metrics
  describe('GET /api/admin/content-quality/metrics', () => {
    it('should return average rating and distribution', async () => {
      mockContentQualityService.getContentQualityMetrics.mockResolvedValue({
        averageRating: 3.8,
        totalFeedbacks: 150,
        ratingDistribution: {
          1: 10,
          2: 15,
          3: 30,
          4: 50,
          5: 45,
        },
        lowRatedCount: 25,
      });

      const result = await controller.getMetrics();

      expect(result.averageRating).toBe(3.8);
      expect(result.ratingDistribution).toBeDefined();
      expect(result.lowRatedCount).toBe(25);
    });
  });

  // AC4: Get low-rated pushes list
  describe('GET /api/admin/content-quality/low-rated', () => {
    it('should return pushes with rating < 3.0 sorted by rating', async () => {
      mockContentQualityService.getLowRatedPushes.mockResolvedValue([
        {
          pushId: 'push-1',
          title: 'Low quality push',
          averageRating: 2.1,
          feedbackCount: 10,
        },
        {
          pushId: 'push-2',
          title: 'Another low push',
          averageRating: 2.5,
          feedbackCount: 8,
        },
      ]);

      const result = await controller.getLowRatedPushes();

      expect(result).toHaveLength(2);
      expect(result[0].averageRating).toBeLessThan(3.0);
      expect(result[0].averageRating).toBeLessThanOrEqual(result[1].averageRating);
    });
  });

  // AC5: Get push feedback details
  describe('GET /api/admin/content-quality/push/:pushId', () => {
    it('should return push content, feedbacks, and AI analysis', async () => {
      mockContentQualityService.getPushFeedbackDetails.mockResolvedValue({
        push: {
          id: 'push-1',
          title: 'Test Push',
          content: 'Push content...',
        },
        feedbacks: [
          { rating: 2, comment: 'Not relevant', userId: 'user-1' },
          { rating: 1, comment: 'Poor quality', userId: 'user-2' },
        ],
        aiAnalysis: {
          relevanceScore: 0.3,
          qualityIssues: ['内容质量不佳', '信息源不可靠'],
          suggestions: ['提高相关性', '验证信息源'],
        },
      });

      const result = await controller.getPushDetails('push-1');

      expect(result.push).toBeDefined();
      expect(result.feedbacks).toHaveLength(2);
      expect(result.aiAnalysis).toBeDefined();
      expect(result.aiAnalysis.suggestions).toContain('提高相关性');
    });
  });

  // AC5: Mark push as optimized
  describe('POST /api/admin/content-quality/push/:pushId/optimize', () => {
    it('should mark push as optimized', async () => {
      mockContentQualityService.markPushAsOptimized.mockResolvedValue({
        pushId: 'push-1',
        status: 'optimized',
        optimizedAt: new Date(),
      });

      const result = await controller.markAsOptimized('push-1');

      expect(result.status).toBe('optimized');
      expect(result.optimizedAt).toBeDefined();
    });
  });

  // AC6: Get quality trends
  describe('GET /api/admin/content-quality/trends', () => {
    it('should return 30-day rating trends by radar type', async () => {
      mockContentQualityService.getQualityTrends.mockResolvedValue({
        overall: {
          dates: ['2026-03-01', '2026-03-02'],
          averageRatings: [3.5, 3.8],
          lowRatedCounts: [5, 3],
        },
        byRadarType: {
          技术: { averageRating: 4.1, lowRatedCount: 2 },
          行业: { averageRating: 3.6, lowRatedCount: 4 },
          合规: { averageRating: 3.9, lowRatedCount: 1 },
        },
        targetRating: 4.0,
      });

      const result = await controller.getTrends();

      expect(result.overall.dates).toHaveLength(2);
      expect(result.byRadarType).toHaveProperty('技术');
      expect(result.targetRating).toBe(4.0);
    });
  });
});
