import { Test, TestingModule } from '@nestjs/testing';
import { PushFeedbackService } from './push-feedback.service';
import { PushFeedbackRepository } from '../../../database/repositories/push-feedback.repository';
import { Repository, DataSource } from 'typeorm';
import { RadarPush } from '../../../database/entities/radar-push.entity';
import { PushFeedback } from '../../../database/entities/push-feedback.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('PushFeedbackService', () => {
  let service: PushFeedbackService;
  let pushFeedbackRepo: jest.Mocked<PushFeedbackRepository>;
  let radarPushRepo: jest.Mocked<Repository<RadarPush>>;
  let dataSource: jest.Mocked<DataSource>;
  let cacheManager: jest.Mocked<any>;

  const mockPushFeedbackRepo = {
    create: jest.fn(),
    findByPushAndUser: jest.fn(),
    findByPushId: jest.fn(),
  };

  const mockRadarPushRepo = {
    findOne: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockEntityManager = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((callback) => callback(mockEntityManager)),
  };

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockEntityManager.findOne.mockReset();
    mockEntityManager.create.mockReset();
    mockEntityManager.save.mockReset();
    mockDataSource.transaction.mockImplementation((callback) => callback(mockEntityManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushFeedbackService,
        {
          provide: PushFeedbackRepository,
          useValue: mockPushFeedbackRepo,
        },
        {
          provide: getRepositoryToken(RadarPush),
          useValue: mockRadarPushRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<PushFeedbackService>(PushFeedbackService);
    pushFeedbackRepo = module.get(PushFeedbackRepository);
    radarPushRepo = module.get(getRepositoryToken(RadarPush));
    dataSource = module.get(DataSource);
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('submitFeedback', () => {
    const pushId = 'push-1';
    const userId = 'user-1';

    it('should create feedback successfully', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 4,
        comment: 'Great content!',
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null); // No existing feedback
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, {
        rating: 4,
        comment: 'Great content!',
      });

      expect(result).toEqual({
        id: mockFeedback.id,
        pushId: mockFeedback.pushId,
        userId: mockFeedback.userId,
        rating: mockFeedback.rating,
        comment: mockFeedback.comment,
        createdAt: mockFeedback.createdAt,
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith('content-quality:metrics');
    });

    it('should sanitize HTML in comments', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 4,
        comment: 'alert("xss")', // Sanitized
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, {
        rating: 4,
        comment: '<script>alert("xss")</script>',
      });

      expect(result.comment).not.toContain('<script>');
      expect(mockCacheManager.del).toHaveBeenCalledWith('content-quality:metrics');
    });

    it('should throw NotFoundException when push not found', async () => {
      mockRadarPushRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitFeedback(pushId, userId, { rating: 4 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when feedback already exists', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const existingFeedback = {
        id: 'existing-1',
        pushId,
        userId,
        rating: 3,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(existingFeedback);

      await expect(
        service.submitFeedback(pushId, userId, { rating: 4 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid rating (0)', async () => {
      const mockPush = { id: pushId } as RadarPush;
      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);

      await expect(
        service.submitFeedback(pushId, userId, { rating: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid rating (> 5)', async () => {
      const mockPush = { id: pushId } as RadarPush;
      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);

      await expect(
        service.submitFeedback(pushId, userId, { rating: 6 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept feedback without comment', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 5,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, { rating: 5 });

      expect(result.rating).toBe(5);
      expect(result.comment).toBeNull();
    });
  });

  describe('getUserFeedback', () => {
    const pushId = 'push-1';
    const userId = 'user-1';

    it('should return user feedback when exists', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 4,
        comment: 'Good content',
        createdAt: new Date(),
      };

      mockPushFeedbackRepo.findByPushAndUser.mockResolvedValue(mockFeedback as any);

      const result = await service.getUserFeedback(pushId, userId);

      expect(result).toEqual({
        id: mockFeedback.id,
        rating: mockFeedback.rating,
        comment: mockFeedback.comment,
        createdAt: mockFeedback.createdAt,
      });
    });

    it('should return null when no feedback exists', async () => {
      mockPushFeedbackRepo.findByPushAndUser.mockResolvedValue(null);

      const result = await service.getUserFeedback(pushId, userId);

      expect(result).toBeNull();
    });
  });

  describe('getPushFeedback', () => {
    const pushId = 'push-1';

    it('should return all feedback for a push', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = [
        {
          id: 'f1',
          rating: 5,
          comment: 'Excellent',
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
        {
          id: 'f2',
          rating: 4,
          comment: null,
          createdAt: new Date(),
          user: { id: 'u2', name: 'User 2' },
        },
      ];

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback as any);

      const result = await service.getPushFeedback(pushId);

      expect(result).toHaveLength(2);
      expect(result[0].user.name).toBe('User 1');
      expect(result[1].user.name).toBe('User 2');
    });

    it('should throw NotFoundException when push not found', async () => {
      mockRadarPushRepo.findOne.mockResolvedValue(null);

      await expect(service.getPushFeedback('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle feedback with missing user gracefully', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = [
        {
          id: 'f1',
          rating: 5,
          comment: 'Excellent',
          createdAt: new Date(),
          user: null, // Missing user
        },
      ];

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback as any);

      const result = await service.getPushFeedback(pushId);

      expect(result).toHaveLength(1);
      expect(result[0].user.name).toBe('Unknown');
      expect(result[0].user.id).toBe('');
    });

    it('should handle empty feedback array', async () => {
      const mockPush = { id: pushId } as RadarPush;

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue([]);

      const result = await service.getPushFeedback(pushId);

      expect(result).toEqual([]);
    });
  });

  describe('submitFeedback - Edge Cases', () => {
    const pushId = 'push-1';
    const userId = 'user-1';

    it('should throw BadRequestException for negative rating', async () => {
      const mockPush = { id: pushId } as RadarPush;
      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);

      await expect(
        service.submitFeedback(pushId, userId, { rating: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for null rating', async () => {
      const mockPush = { id: pushId } as RadarPush;
      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);

      await expect(
        service.submitFeedback(pushId, userId, { rating: null as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined rating', async () => {
      const mockPush = { id: pushId } as RadarPush;
      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);

      await expect(
        service.submitFeedback(pushId, userId, { rating: undefined as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept feedback with empty string comment', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 4,
        comment: null, // Empty string should be treated as null
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, {
        rating: 4,
        comment: '',
      });

      expect(result.rating).toBe(4);
    });

    it('should accept feedback with very long comment', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const longComment = 'a'.repeat(10000);
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 4,
        comment: longComment,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, {
        rating: 4,
        comment: longComment,
      });

      expect(result.comment).toBe(longComment);
    });

    it('should handle repository error during creation', async () => {
      const mockPush = { id: pushId } as RadarPush;

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockDataSource.transaction.mockRejectedValue(new Error('Database error'));

      await expect(
        service.submitFeedback(pushId, userId, { rating: 4 }),
      ).rejects.toThrow('Failed to submit feedback');
    });
  });

  describe('getUserFeedback - Edge Cases', () => {
    const pushId = 'push-1';
    const userId = 'user-1';

    it('should handle repository error', async () => {
      mockPushFeedbackRepo.findByPushAndUser.mockRejectedValue(new Error('Database error'));

      await expect(service.getUserFeedback(pushId, userId)).rejects.toThrow(
        'Failed to get user feedback',
      );
    });

    it('should handle feedback with all fields null except id', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        pushId: null,
        userId: null,
        rating: null,
        comment: null,
        createdAt: null,
      };

      mockPushFeedbackRepo.findByPushAndUser.mockResolvedValue(mockFeedback as any);

      const result = await service.getUserFeedback(pushId, userId);

      expect(result).toBeDefined();
      expect(result.id).toBe('feedback-1');
    });
  });

  describe('getPushFeedback - Edge Cases', () => {
    const pushId = 'push-1';

    it('should handle repository error', async () => {
      mockRadarPushRepo.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.getPushFeedback(pushId)).rejects.toThrow(
        'Failed to get push feedback',
      );
    });

    it('should handle feedback repo error', async () => {
      const mockPush = { id: pushId } as RadarPush;

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockPushFeedbackRepo.findByPushId.mockRejectedValue(new Error('Database error'));

      await expect(service.getPushFeedback(pushId)).rejects.toThrow(
        'Failed to get push feedback',
      );
    });

    it('should handle mixed feedback with and without users', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = [
        {
          id: 'f1',
          rating: 5,
          comment: 'Excellent',
          createdAt: new Date(),
          user: { id: 'u1', name: 'User 1' },
        },
        {
          id: 'f2',
          rating: 3,
          comment: 'Okay',
          createdAt: new Date(),
          user: null, // Missing user
        },
        {
          id: 'f3',
          rating: 4,
          comment: 'Good',
          createdAt: new Date(),
          user: { id: 'u3', name: 'User 3' },
        },
      ];

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockPushFeedbackRepo.findByPushId.mockResolvedValue(mockFeedback as any);

      const result = await service.getPushFeedback(pushId);

      expect(result).toHaveLength(3);
      expect(result[0].user.name).toBe('User 1');
      expect(result[1].user.name).toBe('Unknown');
      expect(result[2].user.name).toBe('User 3');
    });
  });

  describe('Boundary Value Tests', () => {
    const pushId = 'push-1';
    const userId = 'user-1';

    it('should accept minimum valid rating (1)', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 1,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, { rating: 1 });

      expect(result.rating).toBe(1);
    });

    it('should accept maximum valid rating (5)', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 5,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, { rating: 5 });

      expect(result.rating).toBe(5);
    });

    it('should accept rating of 2', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 2,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, { rating: 2 });

      expect(result.rating).toBe(2);
    });

    it('should accept rating of 3', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 3,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, { rating: 3 });

      expect(result.rating).toBe(3);
    });

    it('should accept rating of 4', async () => {
      const mockPush = { id: pushId } as RadarPush;
      const mockFeedback = {
        id: 'feedback-1',
        pushId,
        userId,
        rating: 4,
        comment: null,
        createdAt: new Date(),
      };

      mockRadarPushRepo.findOne.mockResolvedValue(mockPush);
      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(mockFeedback);
      mockEntityManager.save.mockResolvedValue(mockFeedback);

      const result = await service.submitFeedback(pushId, userId, { rating: 4 });

      expect(result.rating).toBe(4);
    });
  });
});
