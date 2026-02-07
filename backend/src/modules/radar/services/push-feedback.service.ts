import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PushFeedbackRepository } from '../../../database/repositories/push-feedback.repository';
import { RadarPush } from '../../../database/entities/radar-push.entity';
import { PushFeedback } from '../../../database/entities/push-feedback.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

/**
 * Sanitize user input to prevent XSS attacks
 * Removes HTML tags and potentially dangerous content
 */
function sanitizeInput(input: string | undefined): string | null {
  if (!input) return null;
  // Remove HTML tags
  const withoutTags = input.replace(/<[^>]*>/g, '');
  // Remove potentially dangerous JavaScript protocols
  const sanitized = withoutTags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, '');
  return sanitized.trim() || null;
}

/**
 * Submit Feedback DTO
 */
export interface SubmitFeedbackDto {
  rating: number;
  comment?: string;
}

/**
 * PushFeedbackService
 *
 * Service for user feedback operations on radar pushes.
 * Handles feedback submission and retrieval.
 *
 * @module backend/src/modules/radar/services
 * @story 7-2
 */
@Injectable()
export class PushFeedbackService {
  constructor(
    private readonly pushFeedbackRepo: PushFeedbackRepository,
    @InjectRepository(RadarPush)
    private readonly radarPushRepo: Repository<RadarPush>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Submit feedback for a push
   * Prevents duplicate feedback from the same user for the same push
   */
  async submitFeedback(
    pushId: string,
    userId: string,
    data: SubmitFeedbackDto,
  ) {
    try {
      // Validate rating
      if (!data.rating || data.rating < 1 || data.rating > 5) {
        throw new BadRequestException('Rating must be between 1 and 5');
      }

      // Check if push exists
      const push = await this.radarPushRepo.findOne({
        where: { id: pushId },
      });
      if (!push) {
        throw new NotFoundException({
          code: 'CONTENT_QUALITY_001',
          message: 'Push not found',
        });
      }

      // Use transaction to prevent race conditions
      const feedback = await this.dataSource.transaction(async (manager) => {
        // Check for existing feedback (prevent duplicate) within transaction
        const existing = await manager.findOne(PushFeedback, {
          where: { pushId, userId },
        });
        if (existing) {
          throw new ConflictException({
            code: 'CONTENT_QUALITY_002',
            message: 'You have already submitted feedback for this push',
          });
        }

        // Sanitize comment to prevent XSS
        const sanitizedComment = sanitizeInput(data.comment);

        // Create feedback within transaction
        const newFeedback = manager.create(PushFeedback, {
          pushId,
          userId,
          rating: data.rating,
          comment: sanitizedComment,
        });

        return await manager.save(newFeedback);
      });

      // Invalidate content quality metrics cache after successful submission
      await this.cacheManager.del('content-quality:metrics');

      return {
        id: feedback.id,
        pushId: feedback.pushId,
        userId: feedback.userId,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to submit feedback: ${error.message}`,
      );
    }
  }

  /**
   * Get user's feedback for a specific push
   */
  async getUserFeedback(
    pushId: string,
    userId: string,
  ) {
    try {
      const feedback = await this.pushFeedbackRepo.findByPushAndUser(pushId, userId);

      if (!feedback) {
        return null;
      }

      return {
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get user feedback: ${error.message}`,
      );
    }
  }

  /**
   * Get all feedback for a specific push (for admin)
   */
  async getPushFeedback(pushId: string) {
    try {
      // Check if push exists
      const push = await this.radarPushRepo.findOne({
        where: { id: pushId },
      });
      if (!push) {
        throw new NotFoundException({
          code: 'CONTENT_QUALITY_001',
          message: 'Push not found',
        });
      }

      const feedback = await this.pushFeedbackRepo.findByPushId(pushId);

      return feedback.map(f => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
        user: {
          id: f.user?.id || '',
          name: f.user?.name || 'Unknown',
        },
      }));
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to get push feedback: ${error.message}`,
      );
    }
  }
}
