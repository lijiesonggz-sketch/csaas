/**
 * JWT Configuration
 *
 * Provides JWT configuration for authentication tokens.
 * In production, JWT_SECRET must be set in environment variables.
 *
 * @module backend/src/config/jwt.config
 */

export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  },
}

/**
 * Validates JWT configuration at application startup
 * Ensures JWT_SECRET is set and meets minimum length requirement (32 characters)
 *
 * @throws Error if JWT_SECRET is not set or is less than 32 characters
 */
export function validateJwtConfig(): void {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }

  if (secret.length < 32) {
    throw new Error(`JWT_SECRET must be at least 32 characters long, got ${secret.length} characters`)
  }

  if (secret.length > 512) {
    throw new Error(`JWT_SECRET must not exceed 512 characters, got ${secret.length} characters`)
  }
}
