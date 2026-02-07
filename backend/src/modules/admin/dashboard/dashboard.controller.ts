import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Request,
  UseGuards,
  InternalServerErrorException,
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
import { DashboardService } from './dashboard.service';
import { AlertService } from './alert.service';
import { HealthMonitorService } from './health-monitor.service';
import { GetAlertsDto, GetTrendDataDto } from './dto';

/**
 * DashboardController
 *
 * Controller for admin dashboard operations.
 * Platform-level admin access (not tenant-scoped).
 *
 * @module backend/src/modules/admin/dashboard
 * @story 7-1
 */
@Controller('api/v1/admin/dashboard')
@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly alertService: AlertService,
    private readonly healthMonitorService: HealthMonitorService,
  ) {}

  /**
   * Get system health metrics
   */
  @Get('health')
  @ApiOperation({ summary: 'Get system health metrics' })
  @ApiResponse({
    status: 200,
    description: 'Health metrics retrieved successfully',
    schema: {
      example: {
        availability: {
          current: 99.7,
          target: 99.5,
          status: 'healthy',
          uptime: 43200,
          downtime: 129.6,
        },
        pushSuccessRate: {
          current: 98.5,
          target: 98.0,
          status: 'healthy',
          totalPushes: 1000,
          successfulPushes: 985,
          failedPushes: 15,
        },
        aiCost: {
          today: 150.5,
          thisMonth: 4500.0,
          avgPerClient: 450.0,
          target: 500.0,
          status: 'healthy',
        },
        customerActivity: {
          totalCustomers: 10,
          activeCustomers: 8,
          activityRate: 80.0,
          target: 70.0,
          status: 'healthy',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getHealthMetrics() {
    try {
      return await this.dashboardService.getHealthMetrics();
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to get health metrics: ${error.message}`,
      );
    }
  }

  /**
   * Get alert list
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get alert list with filters' })
  @ApiResponse({
    status: 200,
    description: 'Alerts retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            type: 'crawler_failure',
            severity: 'high',
            message: '技术雷达爬虫连续失败 3 次',
            occurredAt: '2026-02-04T10:00:00Z',
            status: 'unresolved',
            metadata: {
              source: 'GARTNER',
              failureCount: 3,
            },
          },
        ],
        meta: {
          total: 5,
          unresolved: 3,
          severityCounts: {
            high: 2,
            medium: 1,
            low: 0,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid filters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getAlerts(@Query() filters: GetAlertsDto) {
    return await this.alertService.getAlerts(filters);
  }

  /**
   * Resolve an alert
   */
  @Put('alerts/:id/resolve')
  @ApiOperation({ summary: 'Mark alert as resolved' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: 200,
    description: 'Alert resolved successfully',
    schema: {
      example: {
        id: 'uuid',
        type: 'crawler_failure',
        severity: 'high',
        message: '技术雷达爬虫连续失败 3 次',
        status: 'resolved',
        resolvedAt: '2026-02-04T11:00:00Z',
        resolvedBy: 'user-uuid',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async resolveAlert(@Param('id') id: string, @Request() req) {
    return await this.alertService.resolveAlert(id, req.user.id);
  }

  /**
   * Get health trend data
   */
  @Get('trends')
  @ApiOperation({ summary: 'Get health trend data for a metric' })
  @ApiResponse({
    status: 200,
    description: 'Trend data retrieved successfully',
    schema: {
      example: {
        metric: 'availability',
        range: '30d',
        data: [
          {
            date: '2026-01-05',
            value: 99.8,
          },
          {
            date: '2026-01-06',
            value: 99.6,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getTrendData(@Query() query: GetTrendDataDto) {
    return await this.healthMonitorService.getTrendData(query.metric, query.range);
  }
}
