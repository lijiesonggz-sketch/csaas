import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { LoginDto } from './dto/login.dto'

describe('AuthController - JWT Endpoints', () => {
  let controller: AuthController
  let service: AuthService

  const mockLoginResult = {
    access_token: 'test-jwt-token',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CONSULTANT',
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue(mockLoginResult),
            register: jest.fn(),
            validateUser: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<AuthController>(AuthController)
    service = module.get<AuthService>(AuthService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('POST /auth/login', () => {
    it('should return JWT token and user info', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      // Act
      const result = await controller.login(loginDto)

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockLoginResult,
      })
      expect(service.login).toHaveBeenCalledWith(loginDto)
    })

    it('should call authService.login with correct credentials', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      // Act
      await controller.login(loginDto)

      // Assert
      expect(service.login).toHaveBeenCalledTimes(1)
      expect(service.login).toHaveBeenCalledWith(loginDto)
    })
  })

  describe('GET /auth/profile', () => {
    it('should return current user profile', async () => {
      // Arrange
      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CONSULTANT',
      }

      // Act
      const result = await controller.getProfile(mockUser)

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockUser,
      })
    })

    it('should extract user from request', async () => {
      // Arrange
      const mockUser = {
        userId: 'user-456',
        email: 'another@example.com',
        role: 'CLIENT_PM',
      }

      // Act
      const result = await controller.getProfile(mockUser)

      // Assert
      expect(result.data).toEqual(mockUser)
    })
  })
})
