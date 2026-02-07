import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { User, UserRole } from '../../src/database/entities'
import { DataSource } from 'typeorm'
import { INestApplication } from '@nestjs/common'
import * as bcrypt from 'bcrypt'

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
export async function generateTestToken(user: {
  id: string
  email: string
  role?: string
}): Promise<string> {
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

/**
 * Create a test user in the database
 * Used by penetration tests and audit tests
 *
 * @param dataSource - TypeORM DataSource
 * @param userData - User data (email, password, name)
 * @returns Created User entity
 */
export async function createTestUser(
  dataSource?: DataSource,
  userData?: {
    email: string
    password: string
    name: string
    tenantId?: string
  }
): Promise<User> {
  // If no arguments, return TEST_USER for backwards compatibility
  if (!dataSource || !userData) {
    return TEST_USER as any
  }

  const userRepo = dataSource.getRepository(User)
  const passwordHash = await bcrypt.hash(userData.password, 10)

  const user = await userRepo.save({
    email: userData.email,
    passwordHash,
    name: userData.name,
    tenantId: userData.tenantId || '00000000-0000-0000-0000-000000000000',
    role: UserRole.RESPONDENT,
  })

  return user
}

/**
 * Get auth token by logging in with email and password
 * Used by penetration tests and audit tests
 *
 * @param app - NestJS application instance
 * @param email - User email
 * @param password - User password
 * @returns JWT token as Bearer string
 */
export async function getAuthToken(
  app?: INestApplication,
  email?: string,
  password?: string
): Promise<string> {
  // If only one argument (user object), use generateTestToken
  if (app && typeof app === 'object' && 'id' in app) {
    return generateTestToken(app as any)
  }

  // If app, email, password provided, perform actual login
  if (app && email && password) {
    // For now, we'll generate a token directly without actual login
    // In a real scenario, you'd call the login endpoint
    const userRepo = app.get(DataSource).getRepository(User)
    const user = await userRepo.findOne({ where: { email } })

    if (!user) {
      throw new Error(`User with email ${email} not found`)
    }

    return generateTestToken({
      id: user.id,
      email: user.email,
      role: user.role || 'USER',
    })
  }

  throw new Error('Invalid arguments for getAuthToken')
}
