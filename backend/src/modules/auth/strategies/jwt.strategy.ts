import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

/**
 * JWT Authentication Strategy
 *
 * Validates JWT tokens and extracts user information.
 * Used by JwtAuthGuard to protect routes.
 *
 * @module backend/src/modules/auth/strategies
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    })
  }

  /**
   * Validate JWT payload and extract user information
   *
   * @param payload - JWT token payload
   * @returns User object with id, email, and role
   */
  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    }
  }
}
