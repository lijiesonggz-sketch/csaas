import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, StreamableFile, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@/database/entities/user.entity';
import { CostOptimizationService } from './cost-optimization.service';
import { GetCostTrendsDto } from './dto/get-cost-trends.dto';
import { CostOptimizationSuggestionDto } from './dto/cost-optimization-suggestion.dto';
import { ExportCostReportDto } from './dto/export-cost-report.dto';
import { BatchOptimizeDto } from './dto/batch-optimize.dto';

/**
 * Cost Optimization Controller
 *
 * Provides endpoints for AI cost monitoring and optimization.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization
 */
@ApiTags('Admin - Cost Optimization')
@ApiBearerAuth()
@Controller('api/v1/admin/cost-optimization')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CostOptimizationController {
  constructor(private readonly costOptimizationService: CostOptimizationService) {}

  /**
   * Get cost metrics overview
   *
   * Returns total cost, average cost per organization, and top cost organizations.
   *
   * @returns Cost metrics overview
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get cost metrics overview',
    description:
      'Returns total AI cost, average cost per organization, and top cost organizations for the current month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cost metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalCost: {
          type: 'number',
          example: 1500.5,
          description: 'Total AI cost for current month (CNY)',
        },
        averageCostPerOrganization: {
          type: 'number',
          example: 500.17,
          description: 'Average cost per organization (CNY)',
        },
        topCostOrganizations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              organizationId: { type: 'string', example: 'org-123' },
              organizationName: { type: 'string', example: 'Acme Corp' },
              cost: { type: 'number', example: 600.5 },
              count: { type: 'number', example: 150 },
            },
          },
        },
        period: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getCostMetrics() {
    return this.costOptimizationService.getCostMetrics();
  }

  /**
   * Get organization cost details
   *
   * Returns detailed cost information for a specific organization.
   *
   * @param organizationId - Organization ID
   * @returns Organization cost details
   */
  @Get('organizations/:organizationId/cost')
  @ApiOperation({
    summary: 'Get organization cost details',
    description:
      'Returns detailed AI cost information for a specific organization, including cost breakdown by task type.',
  })
  @ApiParam({
    name: 'organizationId',
    description: 'Organization ID',
    type: 'string',
    example: 'org-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization cost details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', example: 'org-123' },
        organizationName: { type: 'string', example: 'Acme Corp' },
        totalCost: { type: 'number', example: 450.5 },
        costBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taskType: { type: 'string', example: 'tech_analysis' },
              cost: { type: 'number', example: 200.5 },
              count: { type: 'number', example: 50 },
              percentage: { type: 'number', example: 44.5 },
            },
          },
        },
        isExceeded: { type: 'boolean', example: false },
        threshold: { type: 'number', example: 500 },
        period: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganizationCostDetails(@Param('organizationId') organizationId: string) {
    return this.costOptimizationService.getOrganizationCostDetails(organizationId);
  }

  /**
   * Get cost trends
   *
   * Returns daily cost trends for the specified period.
   *
   * @param query - Query parameters
   * @returns Cost trends
   */
  @Get('trends')
  @ApiOperation({
    summary: 'Get cost trends',
    description: 'Returns daily AI cost trends for the specified period (default: last 30 days).',
  })
  @ApiResponse({
    status: 200,
    description: 'Cost trends retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        trends: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-02-01' },
              cost: { type: 'number', example: 50.5 },
              count: { type: 'number', example: 10 },
            },
          },
        },
        period: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getCostTrends(@Query() query: GetCostTrendsDto) {
    return this.costOptimizationService.getCostTrends(query.days);
  }

  /**
   * Get cost optimization suggestions
   *
   * Returns AI cost optimization suggestions for organizations.
   *
   * @param organizationId - Optional organization ID
   * @returns List of cost optimization suggestions
   */
  @Get('suggestions')
  @ApiOperation({
    summary: 'Get cost optimization suggestions',
    description:
      'Analyzes AI usage patterns and provides cost optimization suggestions for organizations.',
  })
  @ApiQuery({
    name: 'organizationId',
    description: 'Optional organization ID to get suggestions for a specific organization',
    required: false,
    type: 'string',
    example: 'org-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Cost optimization suggestions retrieved successfully',
    type: [CostOptimizationSuggestionDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getCostOptimizationSuggestions(@Query('organizationId') organizationId?: string) {
    return this.costOptimizationService.getCostOptimizationSuggestions(organizationId);
  }

  /**
   * Export cost report
   *
   * Exports AI usage cost data in CSV or Excel format.
   *
   * @param query - Export parameters
   * @param res - Express response object
   * @returns File download
   */
  @Get('export')
  @ApiOperation({
    summary: 'Export cost report',
    description: 'Exports AI usage cost data in CSV or Excel format.',
  })
  @ApiQuery({
    name: 'format',
    description: 'Export format',
    enum: ['csv', 'excel'],
    required: false,
    example: 'csv',
  })
  @ApiQuery({
    name: 'startDate',
    description: 'Start date (ISO 8601 format)',
    required: false,
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    description: 'End date (ISO 8601 format)',
    required: false,
    example: '2026-01-31',
  })
  @ApiQuery({
    name: 'organizationId',
    description: 'Optional organization ID to filter by',
    required: false,
    example: 'org-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Cost report exported successfully',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async exportCostReport(@Query() query: ExportCostReportDto, @Res() res: Response) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const { buffer, filename, mimeType } = await this.costOptimizationService.exportCostReport(
      query.format || 'csv',
      startDate,
      endDate,
      query.organizationId,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  /**
   * Batch optimize organizations
   *
   * Applies cost optimization actions to multiple organizations.
   *
   * @param dto - Batch optimization parameters
   * @param req - Express request object (contains user info)
   * @returns Batch optimization results
   */
  @Post('batch-optimize')
  @ApiOperation({
    summary: 'Batch optimize organizations',
    description: 'Applies cost optimization actions to multiple organizations at once.',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch optimization completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'number', example: 5 },
        failed: { type: 'number', example: 1 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              organizationId: { type: 'string', example: 'org-123' },
              organizationName: { type: 'string', example: 'Acme Corp' },
              status: { type: 'string', enum: ['success', 'failed'], example: 'success' },
              message: { type: 'string', example: 'Model switched to qwen-plus for cost optimization' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async batchOptimize(@Body() dto: BatchOptimizeDto, @Request() req: any) {
    const userId = req.user.userId;
    return this.costOptimizationService.batchOptimize(
      dto.organizationIds,
      dto.action,
      userId,
      dto.notes,
    );
  }
}
