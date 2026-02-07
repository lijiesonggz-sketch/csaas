import { IsString, IsEmail, IsOptional, IsEnum, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum IndustryType {
  BANKING = 'banking',
  SECURITIES = 'securities',
  INSURANCE = 'insurance',
  ENTERPRISE = 'enterprise',
}

export enum OrganizationScale {
  LARGE = 'large',
  MEDIUM = 'medium',
  SMALL = 'small',
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
}

/**
 * Create Client DTO
 *
 * Data transfer object for creating a new client organization.
 *
 * @story 6-2
 */
export class CreateClientDto {
  @ApiProperty({ description: '客户名称', example: '杭州银行' })
  @IsString()
  @Length(1, 255)
  name: string

  @ApiPropertyOptional({ description: '联系人姓名', example: '张三' })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  contactPerson?: string

  @ApiPropertyOptional({ description: '联系人邮箱', example: 'zhangsan@example.com' })
  @IsEmail()
  @IsOptional()
  contactEmail?: string

  @ApiPropertyOptional({
    description: '行业类型',
    enum: IndustryType,
    example: IndustryType.BANKING,
  })
  @IsEnum(IndustryType)
  @IsOptional()
  industryType?: IndustryType

  @ApiPropertyOptional({
    description: '机构规模',
    enum: OrganizationScale,
    example: OrganizationScale.LARGE,
  })
  @IsEnum(OrganizationScale)
  @IsOptional()
  scale?: OrganizationScale
}
