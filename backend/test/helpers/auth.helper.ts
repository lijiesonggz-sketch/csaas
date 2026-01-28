import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { User } from '../../src/database/entities'

/**
 * E2E Test Authentication Helper
 *
 * Provides utilities for generating JWT tokens for E2E testing.
 * This bypasses the need to actually log in during tests.
 */

/**
 * Generate a JWT token for testing purposes
 *
 * @param user - User object (must have id, email, role)
 * @returns JWT token as Bearer string
 */
export async function generateTestToken(user: { id: string; email: string; role?: string }): Promise<string> {
  // Create a minimal testing module with JwtService
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      JwtModule.registerAsync({
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          secret: configService.get('JWT_SECRET'),
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRATION', '1d'),
          },
        }),
        inject: [ConfigService],
      }),
    ],
  }).compile()

  const jwtService = module.get<JwtService>(JwtService)

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || 'USER',
  }

  const token = jwtService.sign(payload)

  // Clean up module
  await module.close()

  return `Bearer ${token}`
}

/**
 * Generate auth headers for E2E test requests
 *
 * @param user - User object
 * @returns Headers object with Authorization
 */
export async function getAuthHeaders(user: { id: string; email: string; role?: string }): Promise<{
  Authorization: string
  'x-user-id'?: string
}> {
  const token = await generateTestToken(user)

  return {
    Authorization: token,
    // Keep x-user-id for backwards compatibility during transition
    'x-user-id': user.id,
  }
}

/**
 * Default test user credentials
 */
export const TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test-integration@example.com',
  name: 'Test Integration User',
  role: 'USER',
}

/**
 * Get auth headers for default test user
 */
export async function getDefaultAuthHeaders(): Promise<{
  Authorization: string
  'x-user-id'?: string
}> {
  return getAuthHeaders(TEST_USER)
}
