import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * CurrentOrg Decorator
 *
 * Extracts the current organization ID from the request object.
 * Must be used after OrganizationGuard to ensure organizationId is set.
 *
 * @module backend/src/modules/organizations/decorators
 *
 * @example
 * @UseGuards(JwtAuthGuard, OrganizationGuard)
 * @Get(':id')
 * async findOne(@Param('id') id: string, @CurrentOrg() orgId: string) {
 *   // orgId is automatically injected and validated
 *   return this.organizationsService.findOne(id)
 * }
 */
export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.orgId
  },
)
