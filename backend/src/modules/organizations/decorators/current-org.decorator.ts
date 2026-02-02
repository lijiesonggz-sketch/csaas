import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * CurrentOrg Decorator
 *
 * Extracts the current organization ID and user ID from the request object.
 * Must be used after OrganizationGuard to ensure organizationId is set.
 *
 * @module backend/src/modules/organizations/decorators
 *
 * @example
 * @UseGuards(JwtAuthGuard, OrganizationGuard)
 * @Get(':id')
 * async findOne(@Param('id') id: string, @CurrentOrg() currentOrg: { organizationId: string; userId: string }) {
 *   // currentOrg is automatically injected and validated
 *   return this.organizationsService.findOne(id)
 * }
 */
export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): { organizationId: string; userId: string } => {
    const request = ctx.switchToHttp().getRequest()
    return {
      organizationId: request.orgId,
      userId: request.user?.id || request.user?.userId,
    }
  },
)
