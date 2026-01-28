import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * JWT Authentication Guard
 *
 * Protects routes by requiring valid JWT token.
 * Use with @UseGuards(JwtAuthGuard) decorator.
 *
 * @module backend/src/modules/auth/guards
 *
 * @example
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() user: any) {
 *   return user
 * }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
