import { Injectable, InternalServerErrorException, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PushFeedbackRepository } from '../../../database/repositories/push-feedback.repository';
import { RadarPushRepository } from '../../../database/repositories/radar-push.repository';
import { RadarPush } from '../../../database/entities/radar-push.entity';

/**
 * Content Quality Metrics DTO
 */
export interface ContentQualityMetrics {
  averageRating: number;
  totalFeedback: number;
  lowRatedPushes: number;
  targetAchievement: number;
  ratingDistribution: Record<number, number>;
}

/**
 * Low Rated Push DTO
 */
export interface LowRatedPush {
  pushId: string;
  title: string;
  radarType: 'tech' | 'industry' | 'compliance';
  averageRating: number;
  feedbackCount: number;
  createdAt: Date;
}

/**
 * Push Feedback Detail DTO
 */
export interface PushFeedbackDetail {
  push: {
    id: string;
    title: string;
    summary: string;
    fullContent: string | null;
    radarType: string;
    relevanceScore: number;
    source: string;
  };
  feedback: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    user: {
      id: string;
      name: string;
    };
  }>;
  optimizationSuggestions: string[];
  status: 'pending' | 'optimized' | 'ignored';
}

/**
 * Quality Trend Data Point
 */
export interface QualityTrendDataPoint {
  date: string;
  value: number;
  tech?: number;
  industry?: number;
  compliance?: number;
}

/**
 * Quality Trends DTO
 */
export interface QualityTrends {
  averageRatingTrend: QualityTrendDataPoint[];
  lowRatedPushCountTrend: QualityTrendDataPoint[];
}

/**
 * Cache key constants for content quality service
 */
const CACHE_KEYS = {
  CONTENT_QUALITY_METRICS: 'content-quality:metrics',
} as const;

/**
 * Valid range patterns for trend queries (e.g., '7d', '30d', '90d')
 */
const VALID_RANGE_PATTERN = /^\d+d$/;

/**
 * ContentQualityService
 *
 * Service for content quality management operations.
 * Provides metrics, low-rated push detection, and trend analysis.
 *
 * @module backend/src/modules/admin/content-quality
 * @story 7-2
 */
@Injectable()
export class ContentQualityService {
  constructor(
    private readonly pushFeedbackRepo: PushFeedbackRepository,
    private readonly radarPushRepo: RadarPushRepository,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get content quality metrics
   * Uses Redis cache with 5-minute TTL for performance
   */
  async getContentQualityMetrics(): Promise<ContentQualityMetrics> {
    try {
      // Check cache first
      const cached = await this.cacheManager.get<ContentQualityMetrics>(CACHE_KEYS.CONTENT_QUALITY_METRICS);
      if (cached) {
        return cached;
      }

      // Calculate metrics
      const [averageRating, totalFeedback, ratingDistribution] = await Promise.all([
        this.pushFeedbackRepo.getOverallAverageRating(),
        this.pushFeedbackRepo.getTotalCount(),
        this.pushFeedbackRepo.getRatingDistribution(),
      ]);

      // Get low-rated push count
      const lowRatedPushes = await this.pushFeedbackRepo.getLowRatedPushes(3.0);

      // Calculate target achievement (percentage of pushes with rating >= 4.0)
      const totalRatedPushes = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
      const highRatedPushes = (ratingDistribution[4] || 0) + (ratingDistribution[5] || 0);
      const targetAchievement = totalRatedPushes > 0
        ? Math.round((highRatedPushes / totalRatedPushes) * 100)
        : 0;

      const metrics: ContentQualityMetrics = {
        averageRating: Number(averageRating.toFixed(2)),
        totalFeedback,
        lowRatedPushes: lowRatedPushes.length,
        targetAchievement,
        ratingDistribution,
      };

      // Cache for 5 minutes
      await this.cacheManager.set(CACHE_KEYS.CONTENT_QUALITY_METRICS, metrics, 300 * 1000);

      return metrics;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get content quality metrics: ${error.message}`,
      );
    }
  }

  /**
   * Get low-rated pushes (average rating < 3.0)
   */
  async getLowRatedPushes(
    options: { limit?: number; radarType?: string } = {},
  ): Promise<{ data: LowRatedPush[]; meta: { total: number } }> {
    // Validate radarType if provided
    if (options.radarType && !['tech', 'industry', 'compliance'].includes(options.radarType)) {
      throw new BadRequestException({
        code: 'CONTENT_QUALITY_003',
        message: 'Invalid radar type. Must be one of: tech, industry, compliance',
      });
    }
    try {
      const limit = options.limit || 20;

      // Get low-rated push IDs with their average ratings
      const lowRatedData = await this.pushFeedbackRepo.getLowRatedPushes(3.0);

      // Get push details
      const pushIds = lowRatedData.map(item => item.pushId);

      if (pushIds.length === 0) {
        return { data: [], meta: { total: 0 } };
      }

      // Query for push details with optional radar type filter
      let query = this.dataSource
        .getRepository(RadarPush)
        .createQueryBuilder('push')
        .leftJoinAndSelect('push.analyzedContent', 'analyzed')
        .leftJoinAndSelect('analyzed.rawContent', 'raw')
        .where('push.id IN (:...pushIds)', { pushIds });

      if (options.radarType) {
        query = query.andWhere('push.radarType = :radarType', { radarType: options.radarType });
      }

      const pushes = await query.getMany();

      // Map to response format
      const data: LowRatedPush[] = pushes.map(push => {
        const ratingData = lowRatedData.find(item => item.pushId === push.id);
        return {
          pushId: push.id,
          title: push.analyzedContent?.rawContent?.title || 'Untitled',
          radarType: push.radarType,
          averageRating: Number((ratingData?.averageRating || 0).toFixed(2)),
          feedbackCount: ratingData?.feedbackCount || 0,
          createdAt: push.createdAt,
        };
      });

      // Sort by average rating ascending
      data.sort((a, b) => a.averageRating - b.averageRating);

      return {
        data: data.slice(0, limit),
        meta: { total: data.length },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get low-rated pushes: ${error.message}`,
      );
    }
  }

  /**
   * Get push feedback details
   */
  async getPushFeedbackDetails(pushId: string): Promise<PushFeedbackDetail> {
    try {
      // Get push details
      const push = await this.dataSource
        .getRepository(RadarPush)
        .findOne({
          where: { id: pushId },
          relations: ['analyzedContent', 'analyzedContent.rawContent'],
        });

      if (!push) {
        throw new NotFoundException({
          code: 'CONTENT_QUALITY_001',
          message: 'Push not found',
        });
      }

      // Get feedback for this push
      const feedback = await this.pushFeedbackRepo.findByPushId(pushId);

      // Transform feedback
      const transformedFeedback = feedback.map(f => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
        user: {
          id: f.user?.id || '',
          name: f.user?.name || 'Unknown',
        },
      }));

      // Generate optimization suggestions
      const suggestions = this.generateOptimizationSuggestions(push, feedback);

      // Determine status (mock - would be stored in DB in real implementation)
      const status = 'pending' as const;

      return {
        push: {
          id: push.id,
          title: push.analyzedContent?.rawContent?.title || 'Untitled',
          summary: push.analyzedContent?.aiSummary || '',
          fullContent: push.analyzedContent?.rawContent?.fullContent || null,
          radarType: push.radarType,
          relevanceScore: this.parseRelevanceScore(push.relevanceScore),
          source: push.analyzedContent?.rawContent?.source || '',
        },
        feedback: transformedFeedback,
        optimizationSuggestions: suggestions,
        status,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to get push feedback details: ${error.message}`,
      );
    }
  }

  /**
   * Mark push as optimized
   */
  async markPushAsOptimized(pushId: string): Promise<{ message: string; status: string }> {
    try {
      // Verify push exists
      const push = await this.radarPushRepo.findById('', pushId);
      if (!push) {
        throw new NotFoundException({
          code: 'CONTENT_QUALITY_001',
          message: 'Push not found',
        });
      }

      // In a real implementation, this would update a status field in the database
      // For now, we just return success

      // Invalidate cache
      await this.cacheManager.del(CACHE_KEYS.CONTENT_QUALITY_METRICS);

      return {
        message: '已标记为已优化',
        status: 'optimized',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to mark push as optimized: ${error.message}`,
      );
    }
  }

  /**
   * Mark push as ignored
   */
  async markPushAsIgnored(pushId: string): Promise<{ message: string; status: string }> {
    try {
      // Verify push exists
      const push = await this.radarPushRepo.findById('', pushId);
      if (!push) {
        throw new NotFoundException({
          code: 'CONTENT_QUALITY_001',
          message: 'Push not found',
        });
      }

      // In a real implementation, this would update a status field in the database
      // For now, we just return success

      // Invalidate cache
      await this.cacheManager.del(CACHE_KEYS.CONTENT_QUALITY_METRICS);

      return {
        message: '已忽略该推送',
        status: 'ignored',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to mark push as ignored: ${error.message}`,
      );
    }
  }

  /**
   * Get quality trends for the last 30 days
   */
  async getQualityTrends(range: string = '30d'): Promise<QualityTrends> {
    try {
      // Validate range format (should be like '7d', '30d', '90d')
      if (!VALID_RANGE_PATTERN.test(range)) {
        throw new BadRequestException({
          code: 'CONTENT_QUALITY_004',
          message: 'Invalid range format. Expected format: {number}d (e.g., 7d, 30d, 90d)',
        });
      }
      const days = parseInt(range.replace('d', ''), 10) || 30;

      // Get daily average ratings
      const dailyRatings = await this.pushFeedbackRepo.getDailyAverageRatings(days);

      // Get daily low-rated push counts
      const dailyLowRated = await this.pushFeedbackRepo.getDailyLowRatedPushCounts(days, 3.0);

      // Create a map for easy lookup
      const lowRatedMap = new Map(dailyLowRated.map(item => [item.date, item.lowRatedCount]));

      // Build trend data
      const averageRatingTrend: QualityTrendDataPoint[] = dailyRatings.map(item => ({
        date: item.date,
        value: Number(parseFloat(String(item.averageRating)).toFixed(2)),
      }));

      const lowRatedPushCountTrend: QualityTrendDataPoint[] = dailyRatings.map(item => ({
        date: item.date,
        value: lowRatedMap.get(item.date) || 0,
      }));

      // TODO: Add radar type grouping when feedback is linked to radar types
      // For now, we return the overall trends

      return {
        averageRatingTrend,
        lowRatedPushCountTrend,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to get quality trends: ${error.message}`,
      );
    }
  }

  /**
   * Parse relevance score safely from various input types
   */
  private parseRelevanceScore(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Generate optimization suggestions based on push data and feedback
   */
  private generateOptimizationSuggestions(
    push: RadarPush,
    feedback: Array<{ rating: number; comment: string | null }>,
  ): string[] {
    const suggestions: string[] = [];

    if (feedback.length === 0) {
      return suggestions;
    }

    const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
    const relevanceScore = this.parseRelevanceScore(push.relevanceScore);

    // Check if relevance score is high but rating is low
    if (relevanceScore > 0.8 && avgRating < 3.0) {
      suggestions.push(`相关性评分过高（${relevanceScore.toFixed(2)}），但用户反馈显示内容不够相关`);
      suggestions.push('建议调整AI相关性算法权重');
    }

    // Check for content quality issues
    const lowQualityComments = feedback.filter(f =>
      f.comment?.includes('质量') ||
      f.comment?.includes('无用') ||
      f.comment?.includes('不好') ||
      f.comment?.includes('差'),
    );
    if (lowQualityComments.length > feedback.length / 2) {
      suggestions.push('内容质量不佳，建议优化信息源筛选');
    }

    // Check for relevance issues
    const relevanceComments = feedback.filter(f =>
      f.comment?.includes('相关') ||
      f.comment?.includes('匹配') ||
      f.comment?.includes('需求'),
    );
    if (relevanceComments.length > feedback.length / 2) {
      suggestions.push('用户反馈显示内容与需求不匹配，建议改进推荐算法');
    }

    // Check for source issues
    const source = push.analyzedContent?.rawContent?.source || '';
    if (source && avgRating < 3.0) {
      suggestions.push(`信息源${source}的内容可能需要更严格的筛选`);
    }

    return suggestions;
  }
}
