import { IsString, IsEmail, IsOptional, IsEnum, Length } from 'class-validator'
import { IndustryType, OrganizationScale, OrganizationStatus } from './create-client.dto'

/**
 * Update Client DTO
 *
 * Data transfer object for updating an existing client organization.
 *
 * @story 6-2
 */
export class UpdateClientDto {
  @IsString()
  @IsOptional()
  @Length(1, 255)
  name?: string

  @IsString()
  @IsOptional()
  @Length(1, 255)
  contactPerson?: string

  @IsEmail()
  @IsOptional()
  contactEmail?: string

  @IsEnum(IndustryType)
  @IsOptional()
  industryType?: IndustryType

  @IsEnum(OrganizationScale)
  @IsOptional()
  scale?: OrganizationScale

  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus
}
