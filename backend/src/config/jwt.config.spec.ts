import { jwtConfig, validateJwtConfig } from './jwt.config'

describe('JWT Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset process.env before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('jwtConfig', () => {
    it('should use JWT_SECRET from environment variable', () => {
      process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters'

      // Re-import to get fresh config
      const { jwtConfig: freshConfig } = require('./jwt.config')

      expect(freshConfig.secret).toBe('test-secret-key-that-is-at-least-32-characters')
    })

    it('should not have default secret (secret should be undefined when env not set)', () => {
      delete process.env.JWT_SECRET

      const { jwtConfig: freshConfig } = require('./jwt.config')

      expect(freshConfig.secret).toBeUndefined()
    })

    it('should use JWT_EXPIRES_IN from environment variable', () => {
      process.env.JWT_EXPIRES_IN = '1h'

      const { jwtConfig: freshConfig } = require('./jwt.config')

      expect(freshConfig.signOptions.expiresIn).toBe('1h')
    })

    it('should default to 2h when JWT_EXPIRES_IN is not set', () => {
      delete process.env.JWT_EXPIRES_IN

      const { jwtConfig: freshConfig } = require('./jwt.config')

      expect(freshConfig.signOptions.expiresIn).toBe('2h')
    })
  })

  describe('validateJwtConfig', () => {
    it('should not throw error when JWT_SECRET is set and >= 32 characters', () => {
      process.env.JWT_SECRET = 'valid-secret-key-that-is-at-least-32-chars'

      expect(() => validateJwtConfig()).not.toThrow()
    })

    it('should throw error when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET

      expect(() => validateJwtConfig()).toThrow('JWT_SECRET environment variable is not set')
    })

    it('should throw error when JWT_SECRET is empty string', () => {
      process.env.JWT_SECRET = ''

      // Empty string is falsy, so it triggers the "not set" error
      expect(() => validateJwtConfig()).toThrow('JWT_SECRET environment variable is not set')
    })

    it('should throw error when JWT_SECRET is less than 32 characters', () => {
      process.env.JWT_SECRET = 'short-secret'

      expect(() => validateJwtConfig()).toThrow('JWT_SECRET must be at least 32 characters long, got 12 characters')
    })

    it('should throw error when JWT_SECRET is exactly 31 characters', () => {
      process.env.JWT_SECRET = 'this-is-exactly-31-characters!!'

      expect(() => validateJwtConfig()).toThrow('JWT_SECRET must be at least 32 characters long, got 31 characters')
    })

    it('should not throw error when JWT_SECRET is exactly 32 characters', () => {
      process.env.JWT_SECRET = 'this-is-exactly-32-characters!!!'

      expect(() => validateJwtConfig()).not.toThrow()
    })

    it('should accept secrets longer than 32 characters', () => {
      process.env.JWT_SECRET = 'this-is-a-much-longer-secret-key-for-production-use-only'

      expect(() => validateJwtConfig()).not.toThrow()
    })

    it('should throw error when JWT_SECRET exceeds 512 characters', () => {
      process.env.JWT_SECRET = 'a'.repeat(513)

      expect(() => validateJwtConfig()).toThrow('JWT_SECRET must not exceed 512 characters, got 513 characters')
    })

    it('should accept secrets with exactly 512 characters', () => {
      process.env.JWT_SECRET = 'b'.repeat(512)

      expect(() => validateJwtConfig()).not.toThrow()
    })
  })
})
