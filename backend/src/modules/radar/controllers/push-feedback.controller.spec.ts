import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PushFeedbackController } from './push-feedback.controller';
import { PushFeedbackService } from '../services/push-feedback.service';
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../organizations/guards/tenant.guard';
import { OrganizationGuard } from '../../organizations/guards/organization.guard';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

describe('PushFeedbackController', () => {
  let controller: PushFeedbackController;

  const mockPushFeedbackService = {
    submitFeedback: jest.fn(),
    getUserFeedback: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockInterceptor = {
    intercept: jest.fn((context: ExecutionContext, next: CallHandler) => next.handle()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushFeedbackController],
      providers: [
        {
          provide: PushFeedbackService,
          useValue: mockPushFeedbackService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(TenantGuard)
      .useValue(mockGuard)
      .overrideGuard(OrganizationGuard)
      .useValue(mockGuard)
      .overrideInterceptor(AuditInterceptor)
      .useValue(mockInterceptor)
      .compile();

    controller = module.get<PushFeedbackController>(PushFeedbackController);
  });

  describe('submitFeedback', () => {
    it('should submit feedback for the current user', async () => {
      const dto: SubmitFeedbackDto = {
        rating: 4,
        comment: '内容很有用',
      };

      mockPushFeedbackService.submitFeedback.mockResolvedValue({
        id: 'feedback-1',
        pushId: 'push-123',
        userId: 'user-1',
        rating: 4,
        comment: '内容很有用',
        createdAt: new Date('2026-02-04T10:00:00.000Z'),
      });

      const result = await controller.submitFeedback('push-123', dto, {
        user: { id: 'user-1' },
      });

      expect(mockPushFeedbackService.submitFeedback).toHaveBeenCalledWith(
        'push-123',
        'user-1',
        dto,
      );
      expect(result.id).toBe('feedback-1');
      expect(result.rating).toBe(4);
      expect(result.comment).toBe('内容很有用');
    });

    it('should rethrow known business exceptions', async () => {
      const error = new ConflictException('duplicate feedback');
      mockPushFeedbackService.submitFeedback.mockRejectedValue(error);

      await expect(
        controller.submitFeedback(
          'push-123',
          { rating: 5 },
          { user: { id: 'user-1' } },
        ),
      ).rejects.toBe(error);
    });

    it('should wrap unexpected submit errors as internal server errors', async () => {
      mockPushFeedbackService.submitFeedback.mockRejectedValue(
        new Error('database offline'),
      );

      await expect(
        controller.submitFeedback(
          'push-123',
          { rating: 5 },
          { user: { id: 'user-1' } },
        ),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        controller.submitFeedback(
          'push-123',
          { rating: 5 },
          { user: { id: 'user-1' } },
        ),
      ).rejects.toThrow('Failed to submit feedback: database offline');
    });

    it('should rethrow bad request and not found exceptions unchanged', async () => {
      const badRequestError = new BadRequestException('invalid rating');
      const notFoundError = new NotFoundException('push missing');

      mockPushFeedbackService.submitFeedback.mockRejectedValueOnce(badRequestError);
      mockPushFeedbackService.submitFeedback.mockRejectedValueOnce(notFoundError);

      await expect(
        controller.submitFeedback(
          'push-123',
          { rating: 0 },
          { user: { id: 'user-1' } },
        ),
      ).rejects.toBe(badRequestError);

      await expect(
        controller.submitFeedback(
          'push-123',
          { rating: 5 },
          { user: { id: 'user-1' } },
        ),
      ).rejects.toBe(notFoundError);
    });
  });

  describe('getUserFeedback', () => {
    it('should return current user feedback wrapped in a data object', async () => {
      mockPushFeedbackService.getUserFeedback.mockResolvedValue({
        id: 'feedback-1',
        rating: 4,
        comment: '内容很有用',
        createdAt: new Date('2026-02-04T10:00:00.000Z'),
      });

      const result = await controller.getUserFeedback('push-123', {
        user: { id: 'user-1' },
      });

      expect(mockPushFeedbackService.getUserFeedback).toHaveBeenCalledWith(
        'push-123',
        'user-1',
      );
      expect(result).toEqual({
        data: {
          id: 'feedback-1',
          rating: 4,
          comment: '内容很有用',
          createdAt: new Date('2026-02-04T10:00:00.000Z'),
        },
      });
    });

    it('should return data: null when the user has not submitted feedback', async () => {
      mockPushFeedbackService.getUserFeedback.mockResolvedValue(null);

      const result = await controller.getUserFeedback('push-123', {
        user: { id: 'user-1' },
      });

      expect(result).toEqual({ data: null });
    });

    it('should wrap unexpected getUserFeedback errors as internal server errors', async () => {
      mockPushFeedbackService.getUserFeedback.mockRejectedValue(
        new Error('cache timeout'),
      );

      await expect(
        controller.getUserFeedback('push-123', { user: { id: 'user-1' } }),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        controller.getUserFeedback('push-123', { user: { id: 'user-1' } }),
      ).rejects.toThrow('Failed to get user feedback: cache timeout');
    });
  });
});
