import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { User } from '../../database/entities'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
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

  async validateUser(loginDto: LoginDto): Promise<User> {
    const { email, password } = loginDto

    const user = await this.userRepository.findOne({ where: { email } })
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return user
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
      },
    }
  }
}
