import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PushFeedback } from '../entities/push-feedback.entity';

/**
 * PushFeedbackRepository
 *
 * Repository for push feedback operations.
 * Platform-level repository for content quality management.
 *
 * @module backend/src/database/repositories
 * @story 7-2
 */
@Injectable()
export class PushFeedbackRepository {
  constructor(
    @InjectRepository(PushFeedback)
    private readonly repository: Repository<PushFeedback>,
  ) {}

  /**
   * Create a new feedback record
   */
  async create(data: Partial<PushFeedback>): Promise<PushFeedback> {
    const feedback = this.repository.create(data);
    return this.repository.save(feedback);
  }

  /**
   * Find feedback by ID
   */
  async findById(id: string): Promise<PushFeedback | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['push', 'user'],
    });
  }

  /**
   * Find feedback by push ID and user ID (for duplicate check)
   */
  async findByPushAndUser(pushId: string, userId: string): Promise<PushFeedback | null> {
    return this.repository.findOne({
      where: { pushId, userId },
    });
  }

  /**
   * Find all feedback for a specific push
   */
  async findByPushId(pushId: string): Promise<PushFeedback[]> {
    return this.repository.find({
      where: { pushId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all feedback by a specific user
   */
  async findByUserId(userId: string): Promise<PushFeedback[]> {
    return this.repository.find({
      where: { userId },
      relations: ['push'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get average rating for a specific push
   */
  async getAverageRatingForPush(pushId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('feedback')
      .select('AVG(feedback.rating)', 'average')
      .where('feedback.pushId = :pushId', { pushId })
      .getRawOne();

    return parseFloat(result?.average || '0');
  }

  /**
   * Get rating distribution (count for each rating 1-5)
   */
  async getRatingDistribution(): Promise<Record<number, number>> {
    const results = await this.repository
      .createQueryBuilder('feedback')
      .select('feedback.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .groupBy('feedback.rating')
      .getRawMany();

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    results.forEach((row) => {
      distribution[parseInt(row.rating, 10)] = parseInt(row.count, 10);
    });

    return distribution;
  }

  /**
   * Get overall average rating
   */
  async getOverallAverageRating(): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('feedback')
      .select('AVG(feedback.rating)', 'average')
      .getRawOne();

    return parseFloat(result?.average || '0');
  }

  /**
   * Get total feedback count
   */
  async getTotalCount(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Get low-rated pushes (average rating < 3.0)
   */
  async getLowRatedPushes(minRating: number = 3.0): Promise<
    Array<{
      pushId: string;
      averageRating: number;
      feedbackCount: number;
    }>
  > {
    return this.repository
      .createQueryBuilder('feedback')
      .select('feedback.pushId', 'pushId')
      .addSelect('AVG(feedback.rating)', 'average_rating')
      .addSelect('COUNT(*)', 'feedback_count')
      .groupBy('feedback.pushId')
      .having('AVG(feedback.rating) < :minRating', { minRating })
      .orderBy('average_rating', 'ASC')
      .getRawMany()
      .then(results => results.map(r => ({
        pushId: r.pushId,
        averageRating: parseFloat(r.average_rating),
        feedbackCount: parseInt(r.feedback_count),
      })));
  }

  /**
   * Get feedback count for date range
   */
  async getFeedbackCountForDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        createdAt: MoreThan(startDate),
      },
    });
  }

  /**
   * Get daily average ratings for trend analysis
   */
  async getDailyAverageRatings(days: number = 30): Promise<
    Array<{
      date: string;
      averageRating: number;
      feedbackCount: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.repository
      .createQueryBuilder('feedback')
      .select('DATE(feedback.createdAt)', 'date')
      .addSelect('AVG(feedback.rating)', 'average_rating')
      .addSelect('COUNT(*)', 'feedback_count')
      .where('feedback.createdAt >= :startDate', { startDate })
      .groupBy('DATE(feedback.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany()
      .then(results => results.map(r => ({
        date: r.date,
        averageRating: parseFloat(r.average_rating),
        feedbackCount: parseInt(r.feedback_count),
      })));
  }

  /**
   * Get daily low-rated push counts for trend analysis
   */
  async getDailyLowRatedPushCounts(days: number = 30, threshold: number = 3.0): Promise<
    Array<{
      date: string;
      lowRatedCount: number;
    }>
  > {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // This query finds pushes with average rating below threshold per day
    const results = await this.repository
      .createQueryBuilder('feedback')
      .select('DATE(feedback.createdAt)', 'date')
      .addSelect('feedback.pushId', 'push_id')
      .addSelect('AVG(feedback.rating)', 'avg_rating')
      .where('feedback.createdAt >= :startDate', { startDate })
      .groupBy('DATE(feedback.createdAt)')
      .addGroupBy('feedback.pushId')
      .having('AVG(feedback.rating) < :threshold', { threshold })
      .setParameter('startDate', startDate)
      .setParameter('threshold', threshold)
      .getRawMany();

    // Aggregate by date
    const countsByDate = new Map<string, number>();
    results.forEach((row) => {
      const date = row.date;
      countsByDate.set(date, (countsByDate.get(date) || 0) + 1);
    });

    return Array.from(countsByDate.entries()).map(([date, lowRatedCount]) => ({
      date,
      lowRatedCount,
    }));
  }

  /**
   * Delete feedback by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0;
  }

  /**
   * Find recent feedback by organization
   * Uses push relation to filter by organization
   */
  async findRecentByOrganization(
    organizationId: string,
    days: number = 30,
  ): Promise<PushFeedback[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.repository
      .createQueryBuilder('feedback')
      .leftJoinAndSelect('feedback.push', 'push')
      .where('push.organizationId = :organizationId', { organizationId })
      .andWhere('feedback.createdAt >= :startDate', { startDate })
      .orderBy('feedback.createdAt', 'DESC')
      .getMany();
  }
}
