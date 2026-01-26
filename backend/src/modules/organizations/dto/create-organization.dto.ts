import { IsString, IsOptional, IsUUID, MinLength, MaxLength, Matches } from 'class-validator'

/**
 * DTO for creating a new organization
 */
export class CreateOrganizationDto {
  @IsString()
  @MinLength(3, { message: '组织名称至少 3 个字符' })
  @MaxLength(100, { message: '组织名称最多 100 个字符' })
  @Matches(/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_]+$/, {
    message: '组织名称只能包含中文、字母、数字、空格、短横线和下划线'
  })
  name: string
}

/**
 * DTO for updating an organization
 */
export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_]+$/)
  name?: string
}

/**
 * DTO for linking project to organization
 */
export class LinkProjectDto {
  @IsUUID()
  projectId: string
}

/**
 * Organization statistics response
 */
export interface OrganizationStatsDto {
  id: string
  memberCount: number
  projectCount: number
  weaknessSnapshotCount: number
}

/**
 * User organization response with role
 */
export interface UserOrganizationResponse {
  organization: Organization
  role: 'admin' | 'member'
}

import { Organization } from '../../../database/entities/organization.entity'
