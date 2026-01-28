import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * CurrentUser Decorator
 *
 * Extracts the authenticated user from the request object.
 * Must be used after JwtAuthGuard to ensure user is authenticated.
 *
 * @module backend/src/modules/auth/decorators
 *
 * @example
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() user: any) {
 *   return user
 * }
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  return request.user
})
