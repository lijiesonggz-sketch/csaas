import { IsOptional, IsString, IsEnum, IsInt, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Radar type enum for content quality queries
 */
export enum RadarTypeFilter {
  TECH = 'tech',
  INDUSTRY = 'industry',
  COMPLIANCE = 'compliance',
}

/**
 * Get Low Rated Pushes DTO
 *
 * Query parameters for fetching low-rated pushes
 *
 * @story 7-2
 */
export class GetLowRatedPushesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RadarTypeFilter)
  radarType?: RadarTypeFilter;
}

/**
 * Get Quality Trends DTO
 *
 * Query parameters for fetching quality trend data
 *
 * @story 7-2
 */
export class GetQualityTrendsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+d$/, { message: 'Range must be in format {number}d (e.g., 7d, 30d, 90d)' })
  range?: string = '30d';
}

/**
 * Rating Distribution Response
 */
export interface RatingDistributionResponse {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

/**
 * Content Quality Metrics Response
 */
export interface ContentQualityMetricsResponse {
  averageRating: number;
  totalFeedback: number;
  lowRatedPushes: number;
  targetAchievement: number;
  ratingDistribution: RatingDistributionResponse;
}

/**
 * Low Rated Push Response Item
 */
export interface LowRatedPushResponse {
  pushId: string;
  title: string;
  radarType: 'tech' | 'industry' | 'compliance';
  averageRating: number;
  feedbackCount: number;
  createdAt: string;
}

/**
 * Low Rated Pushes Response
 */
export interface LowRatedPushesResponse {
  data: LowRatedPushResponse[];
  meta: {
    total: number;
  };
}

/**
 * Push Feedback Item Response
 */
export interface PushFeedbackItemResponse {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

/**
 * Push Feedback Detail Response
 */
export interface PushFeedbackDetailResponse {
  push: {
    id: string;
    title: string;
    summary: string;
    fullContent: string | null;
    radarType: string;
    relevanceScore: number;
    source: string;
  };
  feedback: PushFeedbackItemResponse[];
  optimizationSuggestions: string[];
  status: 'pending' | 'optimized' | 'ignored';
}

/**
 * Quality Trend Data Point Response
 */
export interface QualityTrendDataPointResponse {
  date: string;
  value: number;
  tech?: number;
  industry?: number;
  compliance?: number;
}

/**
 * Quality Trends Response
 */
export interface QualityTrendsResponse {
  averageRatingTrend: QualityTrendDataPointResponse[];
  lowRatedPushCountTrend: QualityTrendDataPointResponse[];
}

/**
 * Mark as Optimized Response
 */
export interface MarkAsOptimizedResponse {
  message: string;
  status: string;
}

/**
 * Mark as Ignored Response
 */
export interface MarkAsIgnoredResponse {
  message: string;
  status: string;
}
