import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator'
import { ProjectStatus } from '../../../database/entities/project.entity'

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  clientName?: string

  @IsOptional()
  @IsString()
  standardName?: string

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
