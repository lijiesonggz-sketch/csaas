import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuditLogService, QueryAuditLogDto } from './audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../organizations/guards/tenant.guard';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import { AuditLog } from '../../database/entities/audit-log.entity';

/**
 * AuditLogController
 *
 * Provides API endpoints for querying audit logs.
 * Access is restricted to authenticated users within their tenant scope.
 *
 * Note: In a production system, this should be further restricted to admin users only.
 * For now, we use TenantGuard to ensure users can only see their tenant's audit logs.
 *
 * @module backend/src/modules/audit/audit-log.controller
 * @story 6-1B
 * @phase Phase 2: Audit Layer Implementation - Task 2.5
 */
@Controller('api/audit/logs')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Get all audit logs for current tenant
   *
   * GET /api/audit/logs?limit=100&offset=0
   *
   * @param tenantId - Tenant ID (injected by TenantGuard)
   * @param query - Query parameters (limit, offset)
   * @returns Array of audit logs
   */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: QueryAuditLogDto,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findAll(tenantId, query);
  }

  /**
   * Get audit logs for a specific resource
   *
   * GET /api/audit/logs/:resourceId?resource=RadarPush
   *
   * @param tenantId - Tenant ID (injected by TenantGuard)
   * @param resourceId - Resource ID
   * @param resource - Resource type (e.g., 'RadarPush', 'Organization')
   * @returns Array of audit logs for the resource
   */
  @Get(':resourceId')
  async findByResource(
    @CurrentTenant() tenantId: string,
    @Param('resourceId') resourceId: string,
    @Query('resource') resource: string,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findByResource(tenantId, resource, resourceId);
  }
}
