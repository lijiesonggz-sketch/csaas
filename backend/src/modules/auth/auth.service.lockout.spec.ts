import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, DataSource, QueryRunner } from 'typeorm'
import { UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { AuthService } from './auth.service'
import { User, UserRole } from '../../database/entities'
import { LoginDto } from './dto/login.dto'
import { AccountLockedException } from '../../common/exceptions/account-locked.exception'

describe('AuthService - Account Lockout', () => {
  let service: AuthService
  let jwtService: JwtService
  let userRepository: Repository<User>
  let dataSource: DataSource
  let queryRunner: QueryRunner

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$10$test-hash',
    name: 'Test User',
    role: UserRole.CONSULTANT,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    tenantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    projects: [],
    organizationMembers: [],
  }

  const createMockQueryRunner = () => {
    const manager = {
      findOne: jest.fn(),
      save: jest.fn(),
    }
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager,
    } as unknown as QueryRunner
  }

  beforeEach(async () => {
    queryRunner = createMockQueryRunner()

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
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    jwtService = module.get<JwtService>(JwtService)
    userRepository = module.get<Repository<User>>(getRepositoryToken(User))
    dataSource = module.get<DataSource>(DataSource)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('isAccountLocked', () => {
    it('should return isLocked: false when lockedUntil is null', () => {
      const user = { ...mockUser, lockedUntil: null }
      const result = service.isAccountLocked(user)
      expect(result.isLocked).toBe(false)
      expect(result.lockExpiresIn).toBeUndefined()
    })

    it('should return isLocked: false when lockedUntil is in the past', () => {
      const pastDate = new Date()
      pastDate.setMinutes(pastDate.getMinutes() - 10)
      const user = { ...mockUser, lockedUntil: pastDate }
      const result = service.isAccountLocked(user)
      expect(result.isLocked).toBe(false)
    })

    it('should return isLocked: true with lockExpiresIn when lockedUntil is in the future', () => {
      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)
      const user = { ...mockUser, lockedUntil: futureDate }
      const result = service.isAccountLocked(user)
      expect(result.isLocked).toBe(true)
      expect(result.lockExpiresIn).toBeGreaterThan(0)
      expect(result.lockExpiresIn).toBeLessThanOrEqual(30 * 60)
    })

    it('should calculate remaining seconds correctly', () => {
      const futureDate = new Date()
      futureDate.setSeconds(futureDate.getSeconds() + 90)
      const user = { ...mockUser, lockedUntil: futureDate }
      const result = service.isAccountLocked(user)
      expect(result.isLocked).toBe(true)
      expect(result.lockExpiresIn).toBeGreaterThanOrEqual(90)
      expect(result.lockExpiresIn).toBeLessThanOrEqual(92)
    })
  })

  describe('lockAccount', () => {
    it('should set lockedUntil to 30 minutes in the future', async () => {
      const user = { ...mockUser }
      const beforeLock = new Date()

      await service.lockAccount(user)

      expect(user.lockedUntil).toBeDefined()
      const lockedUntil = new Date(user.lockedUntil!)
      const expectedUnlockTime = new Date(beforeLock)
      expectedUnlockTime.setMinutes(expectedUnlockTime.getMinutes() + 30)

      // Allow 1 second tolerance for test execution time
      expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(expectedUnlockTime.getTime() - 1000)
      expect(lockedUntil.getTime()).toBeLessThanOrEqual(expectedUnlockTime.getTime() + 1000)
    })

    it('should save user through repository when no queryRunner provided', async () => {
      const user = { ...mockUser }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      await service.lockAccount(user)

      expect(userRepository.save).toHaveBeenCalledWith(user)
    })

    it('should save user through queryRunner when provided', async () => {
      const user = { ...mockUser }
      const mockSave = jest.fn().mockResolvedValue(user)
      const qr = { manager: { save: mockSave } } as any

      await service.lockAccount(user, qr)

      expect(mockSave).toHaveBeenCalledWith(user)
      expect(userRepository.save).not.toHaveBeenCalled()
    })
  })

  describe('resetLoginAttempts', () => {
    it('should reset failedLoginAttempts to 0', async () => {
      const user = { ...mockUser, failedLoginAttempts: 5 }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      await service.resetLoginAttempts(user)

      expect(user.failedLoginAttempts).toBe(0)
    })

    it('should clear lockedUntil', async () => {
      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)
      const user = { ...mockUser, lockedUntil: futureDate }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      await service.resetLoginAttempts(user)

      expect(user.lockedUntil).toBeNull()
    })

    it('should set lastLoginAt to current time', async () => {
      const user = { ...mockUser }
      const beforeReset = new Date()
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      await service.resetLoginAttempts(user)

      expect(user.lastLoginAt).toBeDefined()
      const lastLoginAt = new Date(user.lastLoginAt!)
      expect(lastLoginAt.getTime()).toBeGreaterThanOrEqual(beforeReset.getTime() - 1000)
    })

    it('should save through queryRunner when provided', async () => {
      const user = { ...mockUser }
      const mockSave = jest.fn().mockResolvedValue(user)
      const qr = { manager: { save: mockSave } } as any

      await service.resetLoginAttempts(user, qr)

      expect(mockSave).toHaveBeenCalledWith(user)
    })
  })

  describe('incrementFailedAttempts', () => {
    it('should increment failedLoginAttempts by 1', async () => {
      const user = { ...mockUser, failedLoginAttempts: 2 }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      await service.incrementFailedAttempts(user)

      expect(user.failedLoginAttempts).toBe(3)
    })

    it('should handle undefined failedLoginAttempts as 0', async () => {
      const user = { ...mockUser, failedLoginAttempts: undefined as any }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      await service.incrementFailedAttempts(user)

      expect(user.failedLoginAttempts).toBe(1)
    })

    it('should not lock account when attempts are below threshold', async () => {
      const user = { ...mockUser, failedLoginAttempts: 3 }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      const result = await service.incrementFailedAttempts(user)

      expect(result.locked).toBe(false)
      expect(result.lockExpiresIn).toBeUndefined()
      expect(user.lockedUntil).toBeNull()
    })

    it('should lock account when attempts reach 5', async () => {
      const user = { ...mockUser, failedLoginAttempts: 4 }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      const result = await service.incrementFailedAttempts(user)

      expect(result.locked).toBe(true)
      expect(result.lockExpiresIn).toBe(30 * 60) // 30 minutes in seconds
      expect(user.lockedUntil).toBeDefined()
    })

    it('should lock account when attempts exceed 5', async () => {
      const user = { ...mockUser, failedLoginAttempts: 5 }
      jest.spyOn(userRepository, 'save').mockResolvedValue(user)

      const result = await service.incrementFailedAttempts(user)

      expect(result.locked).toBe(true)
      expect(user.lockedUntil).toBeDefined()
    })

    it('should save through queryRunner when provided and not locked', async () => {
      const user = { ...mockUser, failedLoginAttempts: 1 }
      const mockSave = jest.fn().mockResolvedValue(user)
      const qr = { manager: { save: mockSave } } as any

      await service.incrementFailedAttempts(user, qr)

      expect(mockSave).toHaveBeenCalledWith(user)
    })

    it('should save through queryRunner when provided and locked', async () => {
      const user = { ...mockUser, failedLoginAttempts: 4 }
      const mockSave = jest.fn().mockResolvedValue(user)
      const qr = { manager: { save: mockSave } } as any

      await service.incrementFailedAttempts(user, qr)

      expect(mockSave).toHaveBeenCalledWith(user)
    })
  })

  describe('validateUser - AC1: Login Failure Counter', () => {
    it('should increment failedLoginAttempts on password failure', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      const user = { ...mockUser, failedLoginAttempts: 0 }
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException)
      expect(user.failedLoginAttempts).toBe(1)
    })

    it('should record failed attempt time implicitly through update', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      const user = { ...mockUser, failedLoginAttempts: 0 }
      const saveSpy = jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)

      try {
        await service.validateUser(loginDto)
      } catch (e) {
        // Expected
      }

      expect(saveSpy).toHaveBeenCalled()
    })
  })

  describe('validateUser - AC2: Account Lockout after 5 failures', () => {
    it('should lock account after 5 consecutive failed attempts', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      const user = { ...mockUser, failedLoginAttempts: 4 }
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await expect(service.validateUser(loginDto)).rejects.toThrow(AccountLockedException)
      expect(user.lockedUntil).toBeDefined()
    })

    it('should throw AccountLockedException with correct error format', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      const user = { ...mockUser, failedLoginAttempts: 4 }
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      try {
        await service.validateUser(loginDto)
        fail('Should have thrown AccountLockedException')
      } catch (error) {
        expect(error).toBeInstanceOf(AccountLockedException)
        expect(error.response.statusCode).toBe(403)
        expect(error.response.error).toBe('AccountLocked')
        expect(error.response.lockExpiresIn).toBe(30 * 60)
        expect(error.response.message).toContain('账户已锁定')
        expect(error.response.message).toContain('30')
      }
    })
  })

  describe('validateUser - AC3: Prevent Login During Lockout', () => {
    it('should reject login when account is locked', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)
      const user = { ...mockUser, lockedUntil: futureDate }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)

      await expect(service.validateUser(loginDto)).rejects.toThrow(AccountLockedException)
    })

    it('should not verify password when account is locked', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 30)
      const user = { ...mockUser, lockedUntil: futureDate }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      const bcryptCompareSpy = jest.spyOn(bcrypt, 'compare')

      try {
        await service.validateUser(loginDto)
      } catch (e) {
        // Expected
      }

      expect(bcryptCompareSpy).not.toHaveBeenCalled()
    })

    it('should return remaining lock time in error response', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 15)
      const user = { ...mockUser, lockedUntil: futureDate }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)

      try {
        await service.validateUser(loginDto)
        fail('Should have thrown AccountLockedException')
      } catch (error) {
        expect(error.response.lockExpiresIn).toBeGreaterThan(14 * 60)
        expect(error.response.lockExpiresIn).toBeLessThanOrEqual(15 * 60)
      }
    })

    it('should show correct remaining minutes in error message', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() + 25)
      const user = { ...mockUser, lockedUntil: futureDate }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)

      try {
        await service.validateUser(loginDto)
        fail('Should have thrown AccountLockedException')
      } catch (error) {
        expect(error.response.message).toContain('25')
      }
    })
  })

  describe('validateUser - AC4: Reset Counter on Successful Login', () => {
    it('should reset failedLoginAttempts to 0 on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const user = { ...mockUser, failedLoginAttempts: 3 }
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await service.validateUser(loginDto)

      expect(user.failedLoginAttempts).toBe(0)
    })

    it('should clear lockedUntil on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const futureDate = new Date()
      futureDate.setMinutes(futureDate.getMinutes() - 5) // Already expired
      const user = { ...mockUser, lockedUntil: futureDate }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await service.validateUser(loginDto)

      expect(user.lockedUntil).toBeNull()
    })

    it('should update lastLoginAt on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const user = { ...mockUser, lastLoginAt: null }
      const beforeLogin = new Date()
      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await service.validateUser(loginDto)

      expect(user.lastLoginAt).toBeDefined()
      expect(new Date(user.lastLoginAt!).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime() - 1000)
    })
  })

  describe('validateUser - AC5: Auto-unlock after lock period', () => {
    it('should allow login when lock period has expired', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const pastDate = new Date()
      pastDate.setMinutes(pastDate.getMinutes() - 35) // 35 minutes ago
      const user = { ...mockUser, lockedUntil: pastDate, failedLoginAttempts: 5 }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      const result = await service.validateUser(loginDto)

      expect(result).toBeDefined()
      expect(result.email).toBe('test@example.com')
    })

    it('should reset counter on successful login after lock expiry', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      const pastDate = new Date()
      pastDate.setMinutes(pastDate.getMinutes() - 35)
      const user = { ...mockUser, lockedUntil: pastDate, failedLoginAttempts: 5 }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await service.validateUser(loginDto)

      expect(user.failedLoginAttempts).toBe(0)
      expect(user.lockedUntil).toBeNull()
    })

    it('should reject with UnauthorizedException if password is wrong after lock expiry', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      const pastDate = new Date()
      pastDate.setMinutes(pastDate.getMinutes() - 35)
      const user = { ...mockUser, lockedUntil: pastDate, failedLoginAttempts: 5 }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('validateUser - Concurrent Request Safety', () => {
    it('should use pessimistic write lock when fetching user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      const findOneSpy = jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockUser)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(mockUser)

      await service.validateUser(loginDto)

      expect(findOneSpy).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          where: { email: 'test@example.com' },
          lock: { mode: 'pessimistic_write' },
        }),
      )
    })

    it('should start transaction before operations', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockUser)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(mockUser)

      await service.validateUser(loginDto)

      expect(queryRunner.startTransaction).toHaveBeenCalled()
    })

    it('should commit transaction on success', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockUser)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(mockUser)

      await service.validateUser(loginDto)

      expect(queryRunner.commitTransaction).toHaveBeenCalled()
    })

    it('should rollback transaction on error', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(queryRunner.manager, 'findOne').mockRejectedValue(new Error('Database error'))

      await expect(service.validateUser(loginDto)).rejects.toThrow('Database error')
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled()
    })

    it('should release queryRunner in finally block', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(mockUser)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(mockUser)

      await service.validateUser(loginDto)

      expect(queryRunner.release).toHaveBeenCalled()
    })

    it('should release queryRunner even on error', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      }

      jest.spyOn(queryRunner.manager, 'findOne').mockRejectedValue(new Error('Database error'))

      try {
        await service.validateUser(loginDto)
      } catch (e) {
        // Expected
      }

      expect(queryRunner.release).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle user not found', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(null)

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should handle exact 30-minute lock boundary', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'correct-password',
      }

      // Exactly 30 minutes ago (boundary condition)
      const boundaryDate = new Date()
      boundaryDate.setMinutes(boundaryDate.getMinutes() - 30)
      const user = { ...mockUser, lockedUntil: boundaryDate }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      // Should be allowed since lock has expired
      const result = await service.validateUser(loginDto)
      expect(result).toBeDefined()
    })

    it('should handle rapid successive failed attempts', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      }

      // Simulate 4 failed attempts already
      const user = { ...mockUser, failedLoginAttempts: 4 }

      jest.spyOn(queryRunner.manager, 'findOne').mockResolvedValue(user)
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never)
      jest.spyOn(queryRunner.manager, 'save').mockResolvedValue(user)

      // 5th attempt should trigger lock
      await expect(service.validateUser(loginDto)).rejects.toThrow(AccountLockedException)
      expect(user.lockedUntil).toBeDefined()
    })
  })
})
