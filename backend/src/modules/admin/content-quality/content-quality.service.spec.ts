import { Test, TestingModule } from '@nestjs/testing';
import { ContentQualityService } from './content-quality.service';
import { PushFeedbackRepository } from '../../../database/repositories/push-feedback.repository';
import { RadarPushRepository } from '../../../database/repositories/radar-push.repository';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ContentQualityService', () => {
  let service: ContentQualityService;
  let pushFeedbackRepo: jest.Mocked<PushFeedbackRepository>;
  let radarPushRepo: jest.Mocked<RadarPushRepository>;
  let cacheManager: jest.Mocked<any>;
  let dataSource: jest.Mocked<DataSource>;

  const mockPushFeedbackRepo = {
    getOverallAverageRating: jest.fn(),
    getTotalCount: jest.fn(),
    getRatingDistribution: jest.fn(),
    getLowRatedPushes: jest.fn(),
    getDailyAverageRatings: jest.fn(),
    getDailyLowRatedPushCounts: jest.fn(),
    findByPushId: jest.fn(),
  };

  const mockRadarPushRepo = {
    findById: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentQualityService,
        {
          provide: PushFeedbackRepository,
          useValue: mockPushFeedbackRepo,
        },
        {
          provide: RadarPushRepository,
          useValue: mockRadarPushRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ContentQualityService>(ContentQualityService);
    pushFeedbackRepo = module.get(PushFeedbackRepository);
    radarPushRepo = module.get(RadarPushRepository);
    cacheManager = module.get(CACHE_MANAGER);
    dataSource = module.get(DataSource);

    jest.clearAllMocks();
  });

  describe('getContentQualityMetrics', () => {
    it('should return cached metrics if available', async () => {
      const cachedMetrics = {
        averageRating: 4.2,
        totalFeedback: 150,
        lowRatedPushes: 12,
        targetAchievement: 85,
        ratingDistribution: { 1: 4, 2: 6, 3: 15, 4: 45, 5: 80 },
      };

      mockCacheManager.get.mockResolvedValue(cachedMetrics);

      const result = await service.getContentQualityMetrics();

      expect(result).toEqual(cachedMetrics);
      expect(mockCacheManager.get).toHaveBeenCalledWith('content-quality:metrics');
      expect(pushFeedbackRepo.getOverallAverageRating).not.toHaveBeenCalled();
    });

    it('should calculate and cache metrics when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockResolvedValue(4.2);
      mockPushFeedbackRepo.getTotalCount.mockResolvedValue(150);
      mockPushFeedbackRepo.getRatingDistribution.mockResolvedValue({
        1: 4,
        2: 6,
        3: 15,
        4: 45,
        5: 80,
      });
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([{ pushId: '1' }, { pushId: '2' }]);

      const result = await service.getContentQualityMetrics();

      expect(result).toEqual({
        averageRating: 4.2,
        totalFeedback: 150,
        lowRatedPushes: 2,
        targetAchievement: 83,
        ratingDistribution: { 1: 4, 2: 6, 3: 15, 4: 45, 5: 80 },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'content-quality:metrics',
        expect.any(Object),
        300000,
      );
    });

    it('should handle empty feedback data', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockResolvedValue(0);
      mockPushFeedbackRepo.getTotalCount.mockResolvedValue(0);
      mockPushFeedbackRepo.getRatingDistribution.mockResolvedValue({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([]);

      const result = await service.getContentQualityMetrics();

      expect(result.targetAchievement).toBe(0);
      expect(result.averageRating).toBe(0);
    });
  });

  describe('getLowRatedPushes', () => {
    it('should return low-rated pushes', async () => {
      const mockLowRatedData = [
        { pushId: '1', averageRating: 2.5, feedbackCount: 5 },
        { pushId: '2', averageRating: 2.0, feedbackCount: 3 },
      ];

      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue(mockLowRatedData);

      // Mock the QueryBuilder chain
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            radarType: 'tech',
            createdAt: new Date(),
            analyzedContent: {
              rawContent: { title: 'Test Push 1' },
            },
          },
          {
            id: '2',
            radarType: 'industry',
            createdAt: new Date(),
            analyzedContent: {
              rawContent: { title: 'Test Push 2' },
            },
          },
        ]),
      };

      const mockRadarPushRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);

      const result = await service.getLowRatedPushes();

      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.data.length).toBe(2);
    });

    it('should filter by radar type when specified', async () => {
      const mockLowRatedData = [{ pushId: '1', averageRating: 2.5, feedbackCount: 5 }];

      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue(mockLowRatedData);

      // Mock the QueryBuilder chain with radar type filter
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            radarType: 'tech',
            createdAt: new Date(),
            analyzedContent: {
              rawContent: { title: 'Test Push 1' },
            },
          },
        ]),
      };

      const mockRadarPushRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);

      const result = await service.getLowRatedPushes({ radarType: 'tech' });

      expect(pushFeedbackRepo.getLowRatedPushes).toHaveBeenCalledWith(3.0);
      expect(result.data).toBeDefined();
    });
  });

  describe('getPushFeedbackDetails', () => {
    it('should throw NotFoundException when push not found', async () => {
      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);

      await expect(service.getPushFeedbackDetails('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return push details with feedback', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.85,
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: {
            title: 'Test Push',
            fullContent: 'Full content',
            source: 'GARTNER',
          },
        },
      };

      const mockFeedback = [
        {
          id: 'f1',
          rating: 2,
          comment: 'Not relevant',
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
      ];

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.push.id).toBe('1');
      expect(result.feedback).toHaveLength(1);
      expect(result.optimizationSuggestions).toBeDefined();
      expect(result.status).toBe('pending');
    });
  });

  describe('markPushAsOptimized', () => {
    it('should mark push as optimized and invalidate cache', async () => {
      mockRadarPushRepo.findById.mockResolvedValue({ id: '1' } as any);

      const result = await service.markPushAsOptimized('1');

      expect(result.message).toBe('已标记为已优化');
      expect(result.status).toBe('optimized');
      expect(mockCacheManager.del).toHaveBeenCalledWith('content-quality:metrics');
    });

    it('should throw NotFoundException when push not found', async () => {
      mockRadarPushRepo.findById.mockResolvedValue(null);

      await expect(service.markPushAsOptimized('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markPushAsIgnored', () => {
    it('should mark push as ignored and invalidate cache', async () => {
      mockRadarPushRepo.findById.mockResolvedValue({ id: '1' } as any);

      const result = await service.markPushAsIgnored('1');

      expect(result.message).toBe('已忽略该推送');
      expect(result.status).toBe('ignored');
      expect(mockCacheManager.del).toHaveBeenCalledWith('content-quality:metrics');
    });

    it('should throw NotFoundException when push not found', async () => {
      mockRadarPushRepo.findById.mockResolvedValue(null);

      await expect(service.markPushAsIgnored('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getQualityTrends', () => {
    it('should return quality trends', async () => {
      const mockDailyRatings = [
        { date: '2026-01-01', averageRating: 4.1, feedbackCount: 10 },
        { date: '2026-01-02', averageRating: 4.2, feedbackCount: 12 },
      ];

      mockPushFeedbackRepo.getDailyAverageRatings.mockResolvedValue(mockDailyRatings);
      mockPushFeedbackRepo.getDailyLowRatedPushCounts.mockResolvedValue([
        { date: '2026-01-01', lowRatedCount: 2 },
        { date: '2026-01-02', lowRatedCount: 1 },
      ]);

      const result = await service.getQualityTrends('30d');

      expect(result.averageRatingTrend).toHaveLength(2);
      expect(result.lowRatedPushCountTrend).toHaveLength(2);
    });

    it('should handle empty trend data', async () => {
      mockPushFeedbackRepo.getDailyAverageRatings.mockResolvedValue([]);
      mockPushFeedbackRepo.getDailyLowRatedPushCounts.mockResolvedValue([]);

      const result = await service.getQualityTrends('30d');

      expect(result.averageRatingTrend).toEqual([]);
      expect(result.lowRatedPushCountTrend).toEqual([]);
    });

    it('should handle different date ranges', async () => {
      const mockDailyRatings = [
        { date: '2026-01-01', averageRating: 4.1, feedbackCount: 10 },
      ];

      mockPushFeedbackRepo.getDailyAverageRatings.mockResolvedValue(mockDailyRatings);
      mockPushFeedbackRepo.getDailyLowRatedPushCounts.mockResolvedValue([]);

      const result = await service.getQualityTrends('7d');

      expect(result.averageRatingTrend).toHaveLength(1);
      expect(mockPushFeedbackRepo.getDailyAverageRatings).toHaveBeenCalledWith(7);
    });

    it('should throw BadRequestException for invalid range format', async () => {
      await expect(service.getQualityTrends('invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty range', async () => {
      await expect(service.getQualityTrends('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getLowRatedPushes - Edge Cases', () => {
    it('should return empty array when no low-rated pushes exist', async () => {
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([]);

      const result = await service.getLowRatedPushes();

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should respect custom limit parameter', async () => {
      const mockLowRatedData = Array(10).fill(null).map((_, i) => ({
        pushId: String(i + 1),
        averageRating: 2.0,
        feedbackCount: 3,
      }));

      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue(mockLowRatedData);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(
          mockLowRatedData.map((d, i) => ({
            id: d.pushId,
            radarType: 'tech',
            createdAt: new Date(),
            analyzedContent: {
              rawContent: { title: `Test Push ${i + 1}` },
            },
          }))
        ),
      };

      mockDataSource.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      });

      const result = await service.getLowRatedPushes({ limit: 5 });

      expect(result.data.length).toBeLessThanOrEqual(5);
    });

    it('should handle pushes with missing analyzed content', async () => {
      const mockLowRatedData = [{ pushId: '1', averageRating: 2.5, feedbackCount: 5 }];

      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue(mockLowRatedData);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            radarType: 'tech',
            createdAt: new Date(),
            analyzedContent: null, // Missing analyzed content
          },
        ]),
      };

      mockDataSource.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      });

      const result = await service.getLowRatedPushes();

      expect(result.data[0].title).toBe('Untitled');
    });

    it('should filter by compliance radar type', async () => {
      const mockLowRatedData = [{ pushId: '1', averageRating: 2.5, feedbackCount: 5 }];

      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue(mockLowRatedData);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            radarType: 'compliance',
            createdAt: new Date(),
            analyzedContent: {
              rawContent: { title: 'Compliance Push' },
            },
          },
        ]),
      };

      mockDataSource.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      });

      const result = await service.getLowRatedPushes({ radarType: 'compliance' });

      expect(result.data[0].radarType).toBe('compliance');
    });
  });

  describe('getPushFeedbackDetails - Edge Cases', () => {
    it('should handle push with no feedback', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.85,
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: {
            title: 'Test Push',
            fullContent: 'Full content',
            source: 'GARTNER',
          },
        },
      };

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue([]);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.feedback).toEqual([]);
      expect(result.optimizationSuggestions).toEqual([]);
    });

    it('should handle push with missing raw content', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.85,
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: null, // Missing raw content
        },
      };

      const mockFeedback = [
        {
          id: 'f1',
          rating: 2,
          comment: 'Not relevant',
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
      ];

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.push.title).toBe('Untitled');
      expect(result.push.fullContent).toBeNull();
    });

    it('should handle feedback with missing user', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.85,
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: {
            title: 'Test Push',
            fullContent: 'Full content',
            source: 'GARTNER',
          },
        },
      };

      const mockFeedback = [
        {
          id: 'f1',
          rating: 2,
          comment: 'Not relevant',
          createdAt: new Date(),
          user: null, // Missing user
        },
      ];

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.feedback[0].user.name).toBe('Unknown');
    });
  });

  describe('generateOptimizationSuggestions - Private Method Behavior', () => {
    it('should generate suggestions for high relevance but low rating', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.9, // High relevance
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: {
            title: 'Test Push',
            fullContent: 'Full content',
            source: 'GARTNER',
          },
        },
      };

      const mockFeedback = [
        {
          id: 'f1',
          rating: 2, // Low rating
          comment: 'Not relevant to my needs',
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
      ];

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.optimizationSuggestions.length).toBeGreaterThan(0);
      expect(result.optimizationSuggestions.some(s => s.includes('相关性'))).toBe(true);
    });

    it('should generate suggestions for content quality issues', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.5,
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: {
            title: 'Test Push',
            fullContent: 'Full content',
            source: 'GARTNER',
          },
        },
      };

      const mockFeedback = [
        {
          id: 'f1',
          rating: 2,
          comment: '质量很差', // Quality complaint
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
      ];

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.optimizationSuggestions.some(s => s.includes('质量'))).toBe(true);
    });

    it('should generate suggestions for relevance issues', async () => {
      const mockPush = {
        id: '1',
        radarType: 'tech',
        relevanceScore: 0.5,
        createdAt: new Date(),
        analyzedContent: {
          aiSummary: 'Test summary',
          rawContent: {
            title: 'Test Push',
            fullContent: 'Full content',
            source: 'GARTNER',
          },
        },
      };

      const mockFeedback = [
        {
          id: 'f1',
          rating: 2,
          comment: '与我的需求不相关', // Relevance complaint
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
      ];

      const mockRadarPushRepo = {
        findOne: jest.fn().mockResolvedValue(mockPush),
      };

      mockDataSource.getRepository.mockReturnValue(mockRadarPushRepo);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback);

      const result = await service.getPushFeedbackDetails('1');

      expect(result.optimizationSuggestions.some(s => s.includes('推荐算法'))).toBe(true);
    });
  });

  describe('Caching Behavior', () => {
    it('should not call repository methods when cache hit', async () => {
      const cachedMetrics = {
        averageRating: 4.5,
        totalFeedback: 100,
        lowRatedPushes: 5,
        targetAchievement: 90,
        ratingDistribution: { 1: 1, 2: 2, 3: 5, 4: 30, 5: 62 },
      };

      mockCacheManager.get.mockResolvedValue(cachedMetrics);

      await service.getContentQualityMetrics();

      expect(pushFeedbackRepo.getOverallAverageRating).not.toHaveBeenCalled();
      expect(pushFeedbackRepo.getTotalCount).not.toHaveBeenCalled();
      expect(pushFeedbackRepo.getRatingDistribution).not.toHaveBeenCalled();
    });

    it('should cache metrics with correct TTL', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockResolvedValue(4.2);
      mockPushFeedbackRepo.getTotalCount.mockResolvedValue(150);
      mockPushFeedbackRepo.getRatingDistribution.mockResolvedValue({
        1: 4, 2: 6, 3: 15, 4: 45, 5: 80,
      });
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([]);

      await service.getContentQualityMetrics();

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'content-quality:metrics',
        expect.any(Object),
        300 * 1000, // 5 minutes in milliseconds
      );
    });

    it('should invalidate cache when marking as optimized', async () => {
      mockRadarPushRepo.findById.mockResolvedValue({ id: '1' } as any);

      await service.markPushAsOptimized('1');

      expect(mockCacheManager.del).toHaveBeenCalledWith('content-quality:metrics');
      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache when marking as ignored', async () => {
      mockRadarPushRepo.findById.mockResolvedValue({ id: '1' } as any);

      await service.markPushAsIgnored('1');

      expect(mockCacheManager.del).toHaveBeenCalledWith('content-quality:metrics');
      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw InternalServerErrorException when repository fails', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockRejectedValue(new Error('Database error'));

      await expect(service.getContentQualityMetrics()).rejects.toThrow(
        'Failed to get content quality metrics',
      );
    });

    it('should throw InternalServerErrorException when low-rated pushes query fails', async () => {
      mockPushFeedbackRepo.getLowRatedPushes.mockRejectedValue(new Error('Query failed'));

      await expect(service.getLowRatedPushes()).rejects.toThrow(
        'Failed to get low-rated pushes',
      );
    });

    it('should throw InternalServerErrorException when trends query fails', async () => {
      mockPushFeedbackRepo.getDailyAverageRatings.mockRejectedValue(new Error('Query failed'));

      await expect(service.getQualityTrends()).rejects.toThrow(
        'Failed to get quality trends',
      );
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle maximum rating distribution values', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockResolvedValue(5.0);
      mockPushFeedbackRepo.getTotalCount.mockResolvedValue(Number.MAX_SAFE_INTEGER);
      mockPushFeedbackRepo.getRatingDistribution.mockResolvedValue({
        1: 0, 2: 0, 3: 0, 4: 0, 5: Number.MAX_SAFE_INTEGER,
      });
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([]);

      const result = await service.getContentQualityMetrics();

      expect(result.averageRating).toBe(5.0);
      expect(result.targetAchievement).toBe(100);
    });

    it('should handle very small average ratings', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockResolvedValue(0.01);
      mockPushFeedbackRepo.getTotalCount.mockResolvedValue(100);
      mockPushFeedbackRepo.getRatingDistribution.mockResolvedValue({
        1: 99, 2: 1, 3: 0, 4: 0, 5: 0,
      });
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([{ pushId: '1' }]);

      const result = await service.getContentQualityMetrics();

      expect(result.averageRating).toBe(0.01);
      expect(result.targetAchievement).toBe(0);
    });

    it('should round average rating to 2 decimal places', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPushFeedbackRepo.getOverallAverageRating.mockResolvedValue(4.123456);
      mockPushFeedbackRepo.getTotalCount.mockResolvedValue(100);
      mockPushFeedbackRepo.getRatingDistribution.mockResolvedValue({
        1: 0, 2: 0, 3: 0, 4: 50, 5: 50,
      });
      mockPushFeedbackRepo.getLowRatedPushes.mockResolvedValue([]);

      const result = await service.getContentQualityMetrics();

      expect(result.averageRating).toBe(4.12);
    });
  });
});
