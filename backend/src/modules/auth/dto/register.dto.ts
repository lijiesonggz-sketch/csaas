import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator'
import { UserRole } from '../../../database/entities'

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsEnum(UserRole)
  role: UserRole
}
