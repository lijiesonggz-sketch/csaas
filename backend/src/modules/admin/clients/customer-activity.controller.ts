import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../../database/entities/user.entity';
import { CustomerActivityService } from './customer-activity.service';
import { CustomerInterventionService } from './customer-intervention.service';
import { CreateInterventionDto } from './dto/create-intervention.dto';

/**
 * Customer Activity Controller
 *
 * Provides endpoints for customer activity tracking, churn risk monitoring,
 * and intervention management.
 *
 * @story 7-3
 * @module backend/src/modules/admin/clients
 */
@Controller('api/v1/admin/clients')
@ApiTags('admin-customer-activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CustomerActivityController {
  constructor(
    private readonly activityService: CustomerActivityService,
    private readonly interventionService: CustomerInterventionService,
  ) {}

  /**
   * Valid status values for filtering
   */
  private readonly VALID_STATUSES = ['high_active', 'medium_active', 'low_active', 'churn_risk'];

  /**
   * Valid sort fields
   */
  private readonly VALID_SORT_FIELDS = ['monthlyActivityRate', 'name', 'lastActiveAt'];

  /**
   * Get customer activity list
   */
  @Get('activity')
  @ApiOperation({ summary: 'Get customer activity list' })
  @ApiResponse({ status: 200, description: 'Returns list of customer activities' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async getClientActivity(
    @Query('status') status?: string,
    @Query('sort') sort: string = 'monthlyActivityRate',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    // Validate status if provided
    if (status && !this.VALID_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${this.VALID_STATUSES.join(', ')}`,
      );
    }

    // Validate sort field
    if (!this.VALID_SORT_FIELDS.includes(sort)) {
      throw new BadRequestException(
        `Invalid sort field. Must be one of: ${this.VALID_SORT_FIELDS.join(', ')}`,
      );
    }

    // Validate order
    if (order !== 'asc' && order !== 'desc') {
      throw new BadRequestException('Invalid order. Must be "asc" or "desc"');
    }

    // Validate pagination
    if (page < 1) {
      throw new BadRequestException('Page must be at least 1');
    }
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return this.activityService.getClientActivityList({ status, sort, order, page, limit });
  }

  /**
   * Get single client activity details
   */
  @Get(':id/activity')
  @ApiOperation({ summary: 'Get single client activity details' })
  @ApiResponse({ status: 200, description: 'Returns client activity details' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getClientActivityDetails(@Param('id') organizationId: string) {
    return this.activityService.getClientActivityDetails(organizationId);
  }

  /**
   * Get churn risk clients
   */
  @Get('churn-risk')
  @ApiOperation({ summary: 'Get churn risk clients' })
  @ApiResponse({ status: 200, description: 'Returns list of churn risk clients' })
  async getChurnRiskClients() {
    return this.activityService.getClientActivityList({
      status: 'churn_risk',
      sort: 'monthlyActivityRate',
      order: 'asc',
    });
  }

  /**
   * Get client segmentation statistics
   */
  @Get('segmentation')
  @ApiOperation({ summary: 'Get client segmentation statistics' })
  @ApiResponse({ status: 200, description: 'Returns client segmentation data' })
  async getSegmentation() {
    return this.activityService.getClientSegmentation();
  }

  /**
   * Record intervention for client
   */
  @Post(':id/interventions')
  @ApiOperation({ summary: 'Record intervention for client' })
  @ApiResponse({ status: 201, description: 'Intervention recorded successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async createIntervention(
    @Param('id') organizationId: string,
    @Body() dto: CreateInterventionDto,
    @Request() req,
  ) {
    return this.interventionService.createIntervention({
      ...dto,
      organizationId,
      createdBy: req.user.id,
    });
  }

  /**
   * Get interventions for a client
   */
  @Get(':id/interventions')
  @ApiOperation({ summary: 'Get interventions for a client' })
  @ApiResponse({ status: 200, description: 'Returns list of interventions' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  async getInterventions(@Param('id') organizationId: string) {
    return this.interventionService.getInterventions(organizationId);
  }

  /**
   * Get intervention suggestions for a client
   */
  @Get(':id/intervention-suggestions')
  @ApiOperation({ summary: 'Get intervention suggestions for a client' })
  @ApiResponse({ status: 200, description: 'Returns intervention suggestions' })
  async getInterventionSuggestions(@Param('id') organizationId: string) {
    // Get client details first
    const details = await this.activityService.getClientActivityDetails(organizationId);
    const factors = await this.activityService.getChurnRiskFactors(organizationId);

    return this.interventionService.getInterventionSuggestions(
      details.monthlyActivityRate,
      factors,
    );
  }

  /**
   * Manually trigger activity rate calculation for a client
   */
  @Post(':id/calculate-activity')
  @ApiOperation({ summary: 'Manually trigger activity rate calculation' })
  @ApiResponse({ status: 200, description: 'Activity rate calculated' })
  async calculateActivityRate(@Param('id') organizationId: string) {
    return this.activityService.calculateMonthlyActivityRate(organizationId);
  }
}
