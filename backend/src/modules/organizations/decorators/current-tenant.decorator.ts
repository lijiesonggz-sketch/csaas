import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * CurrentTenant Decorator
 *
 * Extracts tenantId from the request context.
 * Must be used with TenantGuard to ensure tenantId is injected.
 *
 * Usage:
 * ```typescript
 * @UseGuards(TenantGuard)
 * @Controller('radar-push')
 * export class RadarPushController {
 *   @Get()
 *   async findAll(@CurrentTenant() tenantId: string) {
 *     // tenantId is automatically extracted from request context
 *     return this.radarPushService.findAll(tenantId)
 *   }
 * }
 * ```
 *
 * @module backend/src/modules/organizations/decorators/current-tenant.decorator
 * @story 6-1A
 * @phase Phase 2: API Layer Permission Validation
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.tenantId
  },
)
