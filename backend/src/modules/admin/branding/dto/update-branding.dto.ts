import { IsString, IsOptional, Length, Matches, IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * Update Branding DTO
 *
 * Data transfer object for updating tenant branding configuration.
 *
 * @story 6-3
 */
export class UpdateBrandingDto {
  @ApiProperty({ description: '公司名称', example: 'ABC 咨询公司', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  companyName?: string

  @ApiProperty({ description: '品牌 Logo URL', example: 'https://example.com/logo.png', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 500)
  brandLogoUrl?: string

  @ApiProperty({ description: '主题色 (HEX)', example: '#1890ff', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid HEX color code' })
  brandPrimaryColor?: string

  @ApiProperty({ description: '次要主题色 (HEX)', example: '#52c41a', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid HEX color code' })
  brandSecondaryColor?: string

  @ApiProperty({ description: '联系邮箱', example: 'contact@abc.com', required: false })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsOptional()
  contactEmail?: string

  @ApiProperty({ description: '联系电话', example: '400-123-4567', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 50, { message: '联系电话长度不能超过 50 字符' })
  contactPhone?: string

  @ApiProperty({ description: '邮件签名', example: 'ABC 咨询公司\n专业的技术咨询服务', required: false })
  @IsString()
  @IsOptional()
  @Length(0, 1000, { message: '邮件签名不能超过 1000 字符' })
  emailSignature?: string
}
