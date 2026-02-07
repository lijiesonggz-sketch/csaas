import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user.entity';
import { ContentQualityService } from './content-quality.service';
import { GetLowRatedPushesDto, GetQualityTrendsDto } from './dto';

/**
 * ContentQualityController
 *
 * Controller for content quality management operations.
 * Platform-level admin access for monitoring and optimizing content quality.
 *
 * @module backend/src/modules/admin/content-quality
 * @story 7-2
 */
@Controller('api/v1/admin/content-quality')
@ApiTags('admin-content-quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ContentQualityController {
  constructor(private readonly contentQualityService: ContentQualityService) {}

  /**
   * Get content quality metrics
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get content quality metrics' })
  @ApiResponse({
    status: 200,
    description: 'Content quality metrics retrieved successfully',
    schema: {
      example: {
        averageRating: 4.2,
        totalFeedback: 150,
        lowRatedPushes: 12,
        targetAchievement: 85,
        ratingDistribution: {
          5: 80,
          4: 45,
          3: 15,
          2: 6,
          1: 4,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getContentQualityMetrics() {
    try {
      return await this.contentQualityService.getContentQualityMetrics();
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get content quality metrics: ${error.message}`,
      );
    }
  }

  /**
   * Get low-rated pushes
   */
  @Get('low-rated')
  @ApiOperation({ summary: 'Get low-rated pushes (rating < 3.0)' })
  @ApiResponse({
    status: 200,
    description: 'Low-rated pushes retrieved successfully',
    schema: {
      example: {
        data: [
          {
            pushId: 'uuid',
            title: '某技术文章标题',
            radarType: 'tech',
            averageRating: 2.3,
            feedbackCount: 5,
            createdAt: '2026-02-01T10:00:00Z',
          },
        ],
        meta: {
          total: 12,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getLowRatedPushes(@Query() query: GetLowRatedPushesDto) {
    try {
      return await this.contentQualityService.getLowRatedPushes({
        limit: query.limit,
        radarType: query.radarType,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get low-rated pushes: ${error.message}`,
      );
    }
  }

  /**
   * Get push feedback details
   */
  @Get('pushes/:id/feedback')
  @ApiOperation({ summary: 'Get feedback details for a specific push' })
  @ApiParam({ name: 'id', description: 'Push ID' })
  @ApiResponse({
    status: 200,
    description: 'Push feedback details retrieved successfully',
    schema: {
      example: {
        push: {
          id: 'uuid',
          title: '某技术文章标题',
          summary: '摘要内容...',
          fullContent: '完整内容...',
          radarType: 'tech',
          relevanceScore: 0.85,
          source: 'GARTNER',
        },
        feedback: [
          {
            id: 'uuid',
            rating: 2,
            comment: '内容与我的需求不太相关',
            createdAt: '2026-02-04T10:00:00Z',
            user: {
              id: 'uuid',
              name: '用户姓名',
            },
          },
        ],
        optimizationSuggestions: [
          '相关性评分过高（0.85），但用户反馈显示内容不够相关',
          '建议调整AI相关性算法权重',
        ],
        status: 'pending',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Push not found' })
  async getPushFeedbackDetails(@Param('id') id: string) {
    try {
      return await this.contentQualityService.getPushFeedbackDetails(id);
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
  @Put('pushes/:id/optimize')
  @ApiOperation({ summary: 'Mark push as optimized' })
  @ApiParam({ name: 'id', description: 'Push ID' })
  @ApiResponse({
    status: 200,
    description: 'Push marked as optimized successfully',
    schema: {
      example: {
        message: '已标记为已优化',
        status: 'optimized',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Push not found' })
  async markPushAsOptimized(@Param('id') id: string) {
    try {
      return await this.contentQualityService.markPushAsOptimized(id);
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
  @Put('pushes/:id/ignore')
  @ApiOperation({ summary: 'Mark push as ignored' })
  @ApiParam({ name: 'id', description: 'Push ID' })
  @ApiResponse({
    status: 200,
    description: 'Push marked as ignored successfully',
    schema: {
      example: {
        message: '已忽略该推送',
        status: 'ignored',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Push not found' })
  async markPushAsIgnored(@Param('id') id: string) {
    try {
      return await this.contentQualityService.markPushAsIgnored(id);
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
   * Get quality trends
   */
  @Get('trends')
  @ApiOperation({ summary: 'Get quality trends over time' })
  @ApiResponse({
    status: 200,
    description: 'Quality trends retrieved successfully',
    schema: {
      example: {
        averageRatingTrend: [
          { date: '2026-01-05', value: 4.1 },
          { date: '2026-01-06', value: 4.2 },
        ],
        lowRatedPushCountTrend: [
          { date: '2026-01-05', value: 3 },
          { date: '2026-01-06', value: 2 },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getQualityTrends(@Query() query: GetQualityTrendsDto) {
    try {
      return await this.contentQualityService.getQualityTrends(query.range);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get quality trends: ${error.message}`,
      );
    }
  }
}
