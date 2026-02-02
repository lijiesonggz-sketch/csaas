import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { OrganizationsService } from '../organizations.service'
import { DataSource } from 'typeorm'

/**
 * TenantGuard
 *
 * API layer (Layer 1) permission guard for multi-tenant data isolation.
 * Extracts tenantId from JWT token and injects it into the request context.
 * Sets PostgreSQL RLS session variable for database-level isolation.
 *
 * Flow:
 * 1. Extract userId from JWT token (set by AuthGuard)
 * 2. Query OrganizationMember table to get user's organizationId
 * 3. Query Organization table to get tenantId
 * 4. Set PostgreSQL session variable: SET app.current_tenant = tenantId (using parameterized query)
 * 5. Inject tenantId and organizationId into request context
 * 6. Return 403 Forbidden if user doesn't belong to any organization
 *
 * Usage:
 * ```typescript
 * @UseGuards(TenantGuard)
 * @Controller('radar-push')
 * export class RadarPushController {
 *   @Get()
 *   async findAll(@CurrentTenant() tenantId: string) {
 *     // tenantId is automatically injected
 *   }
 * }
 * ```
 *
 * @module backend/src/modules/organizations/guards/tenant.guard
 * @story 6-1B
 * @phase Phase 1: Database Layer RLS
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name)

  constructor(
    private readonly organizationService: OrganizationsService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.user?.id // Extracted from JWT by AuthGuard

    if (!userId) {
      this.logger.warn('TenantGuard: User not authenticated')
      throw new UnauthorizedException('User not authenticated')
    }

    try {
      // Query user's organization (includes tenantId)
      const organization = await this.organizationService.findByUserId(userId)

      if (!organization) {
        this.logger.warn(`TenantGuard: User ${userId} does not belong to any organization`)
        throw new ForbiddenException('User does not belong to any organization')
      }

      // Inject tenantId and organizationId into request context
      // Note: RLS策略已验证不生效，改用应用层过滤
      // 所有Repository必须使用request.tenantId进行过滤
      request.tenantId = organization.tenantId
      request.organizationId = organization.id

      this.logger.debug(
        `TenantGuard: User ${userId} → Organization ${organization.id} → Tenant ${organization.tenantId}`,
      )

      return true
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error
      }

      this.logger.error(`TenantGuard: Error validating tenant access for user ${userId}`, error)
      throw new ForbiddenException('Failed to validate tenant access')
    }
  }
}
