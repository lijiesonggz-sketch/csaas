import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { AuthService } from './auth.service'
import { User } from '../../database/entities'
import { LoginDto } from './dto/login.dto'

describe('AuthService - JWT Authentication', () => {
  let service: AuthService
  let jwtService: JwtService
  let userRepository: Repository<User>

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$10$test-hash',
    name: 'Test User',
    role: 'CONSULTANT',
  }

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-123' }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    jwtService = module.get<JwtService>(JwtService)
    userRepository = module.get<Repository<User>>(getRepositoryToken(User))
  })

  describe('login', () => {
    it('should return JWT token on successful login', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(mockUser as User)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(mockQueryRunner.manager, 'save').mockResolvedValue(mockUser as User)
      jest.spyOn(jwtService, 'sign').mockReturnValue('signed-jwt-token')

      // Act
      const result = await service.login(loginDto)

      // Assert
      expect(result).toBeDefined()
      expect(result.access_token).toBe('signed-jwt-token')
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        tenantId: undefined,
      })
    })

    it('should throw UnauthorizedException for invalid email', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'wrong@example.com',
        password: 'password123',
      }

      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(null)

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException)
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials')
    })

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(mockUser as User)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      jest.spyOn(mockQueryRunner.manager, 'save').mockResolvedValue(mockUser as User)

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should include correct payload in JWT token', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(mockQueryRunner.manager, 'findOne').mockResolvedValue(mockUser as User)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(mockQueryRunner.manager, 'save').mockResolvedValue(mockUser as User)

      const signSpy = jest.spyOn(jwtService, 'sign').mockReturnValue('jwt-token')

      // Act
      await service.login(loginDto)

      // Assert
      expect(signSpy).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      })
    })
  })
})
