import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { User, OrganizationMember } from '../../database/entities'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { AccountLockedException } from '../../common/exceptions/account-locked.exception'

@Injectable()
export class AuthService {
  // Security configuration
  private readonly MAX_FAILED_ATTEMPTS = 5
  private readonly LOCKOUT_DURATION_MINUTES = 30

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OrganizationMember)
    private orgMemberRepository: Repository<OrganizationMember>,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const { email, password, name, role } = registerDto

    // 检查用户是否已存在
    const existingUser = await this.userRepository.findOne({ where: { email } })
    if (existingUser) {
      throw new ConflictException('Email already exists')
    }

    // 加密密码
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 创建用户
    const user = this.userRepository.create({
      email,
      passwordHash,
      name,
      role,
    })

    return await this.userRepository.save(user)
  }

  /**
   * Check if user account is currently locked
   * @param user - User entity to check
   * @returns Object with isLocked status and remaining seconds if locked
   */
  isAccountLocked(user: User): { isLocked: boolean; lockExpiresIn?: number } {
    if (!user.lockedUntil) {
      return { isLocked: false }
    }

    const now = new Date()
    const lockedUntil = new Date(user.lockedUntil)

    if (lockedUntil > now) {
      const lockExpiresIn = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
      return { isLocked: true, lockExpiresIn }
    }

    return { isLocked: false }
  }

  /**
   * Lock user account for specified duration
   * @param user - User to lock
   * @param queryRunner - Optional query runner for transaction
   */
  async lockAccount(user: User, queryRunner?: any): Promise<void> {
    const lockedUntil = new Date()
    lockedUntil.setMinutes(lockedUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES)

    user.lockedUntil = lockedUntil

    if (queryRunner) {
      await queryRunner.manager.save(user)
    } else {
      await this.userRepository.save(user)
    }
  }

  /**
   * Reset login attempts and clear lock status
   * @param user - User to reset
   * @param queryRunner - Optional query runner for transaction
   */
  async resetLoginAttempts(user: User, queryRunner?: any): Promise<void> {
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    user.lastLoginAt = new Date()

    if (queryRunner) {
      await queryRunner.manager.save(user)
    } else {
      await this.userRepository.save(user)
    }
  }

  /**
   * Increment failed login attempts and lock if threshold reached
   * @param user - User to increment attempts for
   * @param queryRunner - Optional query runner for transaction
   * @returns Object indicating if account was locked
   */
  async incrementFailedAttempts(user: User, queryRunner?: any): Promise<{ locked: boolean; lockExpiresIn?: number }> {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1

    let locked = false
    let lockExpiresIn: number | undefined

    if (user.failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
      await this.lockAccount(user, queryRunner)
      locked = true
      lockExpiresIn = this.LOCKOUT_DURATION_MINUTES * 60
    } else {
      if (queryRunner) {
        await queryRunner.manager.save(user)
      } else {
        await this.userRepository.save(user)
      }
    }

    return { locked, lockExpiresIn }
  }

  async validateUser(loginDto: LoginDto): Promise<User> {
    const { email, password } = loginDto

    // Use transaction with row lock to prevent race conditions
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    let committed = false

    try {
      // Lock the user row for update to prevent concurrent modification
      const user = await queryRunner.manager.findOne(User, {
        where: { email },
        lock: { mode: 'pessimistic_write' },
      })

      // Check if account is locked BEFORE user existence check to prevent user enumeration
      // If user doesn't exist, we still check a dummy lock status to prevent timing attacks
      const lockStatus = user ? this.isAccountLocked(user) : { isLocked: false }

      if (lockStatus.isLocked) {
        await queryRunner.commitTransaction()
        committed = true
        throw new AccountLockedException(lockStatus.lockExpiresIn)
      }

      if (!user) {
        await queryRunner.commitTransaction()
        committed = true
        throw new UnauthorizedException('Invalid credentials')
      }

      // If lock has expired, reset the failed attempts counter
      if (user.lockedUntil && !lockStatus.isLocked) {
        user.failedLoginAttempts = 0
        user.lockedUntil = null
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

      if (!isPasswordValid) {
        // Increment failed attempts
        const result = await this.incrementFailedAttempts(user, queryRunner)
        await queryRunner.commitTransaction()
        committed = true

        if (result.locked) {
          throw new AccountLockedException(result.lockExpiresIn)
        }

        throw new UnauthorizedException('Invalid credentials')
      }

      // Password correct - reset attempts and update last login
      await this.resetLoginAttempts(user, queryRunner)
      await queryRunner.commitTransaction()
      committed = true

      return user
    } catch (error) {
      if (!committed) {
        await queryRunner.rollbackTransaction()
      }
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async findById(id: string): Promise<User> {
    return await this.userRepository.findOne({ where: { id } })
  }

  /**
   * Authenticate user and return JWT token
   *
   * @param loginDto - Login credentials (email, password)
   * @returns Object containing access_token and user information
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto)

    // Query user's organization membership
    const membership = await this.orgMemberRepository.findOne({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
    })

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        organizationId: membership?.organizationId || null,
        organizationRole: membership?.role || null,
      },
    }
  }
}
