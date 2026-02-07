import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../organizations/guards/tenant.guard';
import { OrganizationGuard } from '../../organizations/guards/organization.guard';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { PushFeedbackService } from '../services/push-feedback.service';
import { SubmitFeedbackDto } from '../dto/submit-feedback.dto';

/**
 * PushFeedbackController
 *
 * Controller for user feedback operations on radar pushes.
 * Allows users to submit ratings and comments for pushes.
 *
 * @module backend/src/modules/radar/controllers
 * @story 7-2
 */
@Controller('api/v1/radar/pushes/:id/feedback')
@ApiTags('radar-push-feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, OrganizationGuard)
@UseInterceptors(AuditInterceptor)
export class PushFeedbackController {
  constructor(private readonly pushFeedbackService: PushFeedbackService) {}

  /**
   * Submit feedback for a push
   *
   * POST /api/v1/radar/pushes/:id/feedback
   */
  @Post()
  @ApiOperation({ summary: 'Submit feedback for a push' })
  @ApiParam({ name: 'id', description: 'Push ID' })
  @ApiResponse({
    status: 201,
    description: 'Feedback submitted successfully',
    schema: {
      example: {
        id: 'uuid',
        pushId: 'uuid',
        userId: 'uuid',
        rating: 4,
        comment: '内容很有用，帮助我了解了最新的技术趋势',
        createdAt: '2026-02-04T10:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid rating' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Push not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Feedback already submitted' })
  async submitFeedback(
    @Param('id') pushId: string,
    @Body() data: SubmitFeedbackDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.id;
      const feedback = await this.pushFeedbackService.submitFeedback(pushId, userId, data);
      return feedback;
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
   * Get current user's feedback for a push
   *
   * GET /api/v1/radar/pushes/:id/feedback
   */
  @Get()
  @ApiOperation({ summary: "Get current user's feedback for a push" })
  @ApiParam({ name: 'id', description: 'Push ID' })
  @ApiResponse({
    status: 200,
    description: 'Feedback retrieved successfully',
    schema: {
      example: {
        data: {
          id: 'uuid',
          rating: 4,
          comment: '内容很有用...',
          createdAt: '2026-02-04T10:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'No feedback found',
    schema: {
      example: {
        data: null,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserFeedback(
    @Param('id') pushId: string,
    @Request() req,
  ) {
    try {
      const userId = req.user.id;
      const feedback = await this.pushFeedbackService.getUserFeedback(pushId, userId);
      return { data: feedback };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get user feedback: ${error.message}`,
      );
    }
  }
}
