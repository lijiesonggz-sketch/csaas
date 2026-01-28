import { Test, TestingModule } from '@nestjs/testing'
import { JwtStrategy } from './jwt.strategy'
import { ConfigService } from '@nestjs/config'

describe('JwtStrategy', () => {
  let strategy: JwtStrategy
  let configService: ConfigService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test-secret-key'
              }
              return null
            }),
          },
        },
      ],
    }).compile()

    strategy = module.get<JwtStrategy>(JwtStrategy)
    configService = module.get<ConfigService>(ConfigService)
  })

  it('should be defined', () => {
    expect(strategy).toBeDefined()
  })

  describe('validate', () => {
    it('should extract user information from JWT payload', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'CONSULTANT',
      }

      const result = await strategy.validate(payload)

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CONSULTANT',
      })
    })

    it('should map sub to userId', async () => {
      const payload = {
        sub: 'user-456',
        email: 'another@example.com',
        role: 'CLIENT_PM',
      }

      const result = await strategy.validate(payload)

      expect(result.userId).toBe('user-456')
    })
  })

  describe('configuration', () => {
    it('should use JWT_SECRET from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET')
    })
  })
})
