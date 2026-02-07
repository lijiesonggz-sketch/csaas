import { SetMetadata } from '@nestjs/common'
import { UserRole } from '../../../database/entities/user.entity'

/**
 * Roles Decorator
 *
 * Marks a route as requiring specific user roles.
 * Used in conjunction with RolesGuard.
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @Get('admin-only')
 * adminOnlyRoute() {
 *   return 'Only admins can see this'
 * }
 * ```
 *
 * @param roles - Array of required user roles
 */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles)
