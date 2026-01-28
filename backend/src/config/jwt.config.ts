/**
 * JWT Configuration
 *
 * Provides JWT configuration for authentication tokens.
 * In production, JWT_SECRET must be set in environment variables.
 *
 * @module backend/src/config/jwt.config
 */

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
}
