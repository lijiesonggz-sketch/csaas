import { IsString, IsEnum, IsNotEmpty } from 'class-validator'
import { ProjectMemberRole } from '../../../database/entities/project-member.entity'

export class AddProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string

  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole
}
