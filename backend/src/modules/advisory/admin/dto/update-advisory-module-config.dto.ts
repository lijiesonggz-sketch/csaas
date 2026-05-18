import { IsArray, IsBoolean, IsInt, IsOptional, Min } from 'class-validator'
import { UserRole } from '../../../../database/entities/user.entity'

export class UpdateAdvisoryModuleConfigDto {
  @IsBoolean()
  enabled: boolean

  @IsArray()
  allowedRoles: UserRole[]

  @IsOptional()
  @IsInt()
  @Min(1)
  dataRetentionDays?: number

  @IsOptional()
  @IsBoolean()
  privacyConfirmed?: boolean
}
