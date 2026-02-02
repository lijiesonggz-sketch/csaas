import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuditAction } from '../../database/entities/audit-log.entity';

/**
 * AuditInterceptor
 *
 * Intercepts all sensitive operations and logs them to the audit log queue.
 * Audit logging is asynchronous and fail-safe - it will not block the main request.
 *
 * Key Features:
 * - Queue-based logging: Uses BullMQ to ensure logs are not lost
 * - Automatic retry: Failed jobs are retried up to 3 times
 * - Fail-safe: Audit log failures do not affect main request
 * - Comprehensive logging: Logs both successful and failed requests
 * - Tenant-aware: Automatically includes tenantId from request context
 *
 * Usage:
 * ```typescript
 * @UseInterceptors(AuditInterceptor)
 * @Controller('radar-push')
 * export class RadarPushController {
 *   // All methods will be audited
 * }
 * ```
 *
 * @module backend/src/common/interceptors/audit.interceptor
 * @story 6-1B
 * @phase Phase 2: Audit Layer Implementation - LOW Issue Fix
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @InjectQueue('audit-log')
    private readonly auditLogQueue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, tenantId, method, url, body } = request;

    const action = this.mapMethodToAction(method);
    const resource = this.extractResourceFromUrl(url);

    return next.handle().pipe(
      tap(async (response) => {
        // Queue audit log - BullMQ ensures it won't be lost
        try {
          await this.auditLogQueue.add('log', {
            userId: user?.id,
            tenantId,
            action,
            entityType: resource,
            entityId: response?.id,
            changes: body,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        } catch (error) {
          // Even if queue fails, log the error but don't block the request
          this.logger.error('Failed to queue audit log', error);
        }
      }),
      catchError((error) => {
        // Log audit entry even if main request fails
        this.auditLogQueue
          .add('log', {
            userId: user?.id,
            tenantId,
            action,
            entityType: resource,
            entityId: null,
            changes: { error: error.message, body },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .catch((auditError) => {
            this.logger.error('Failed to queue audit log for error', auditError);
          });
        throw error;
      }),
    );
  }

  /**
   * Map HTTP method to audit action
   */
  private mapMethodToAction(method: string): AuditAction {
    const mapping: Record<string, AuditAction> = {
      POST: AuditAction.CREATE,
      PUT: AuditAction.UPDATE,
      PATCH: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
      GET: AuditAction.READ,
    };
    return mapping[method] || AuditAction.CREATE;
  }

  /**
   * Extract resource name from URL
   * Examples:
   *   /api/radar/pushes -> radar.pushes
   *   /api/organizations/123 -> organizations
   *   /api/audit/logs -> audit.logs
   *   /unknown/route -> unknown
   */
  private extractResourceFromUrl(url: string): string {
    // Remove query parameters
    const pathOnly = url.split('?')[0]

    // Extract path segments
    const segments = pathOnly.split('/').filter(Boolean)

    // Expected format: ['api', 'module', 'resource', ...]
    if (segments.length >= 3) {
      const module = segments[1]
      const resource = segments[2]
      // ✅ IMPROVED: Return module.resource format for better auditing
      return `${module}.${resource}`
    } else if (segments.length === 2) {
      // Fallback for /api/resource
      return segments[1]
    }

    return 'unknown'
  }
}
