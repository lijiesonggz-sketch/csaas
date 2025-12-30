import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator'

/**
 * 创建问卷填写记录DTO
 */
export class CreateSurveyDto {
  @IsString()
  questionnaireTaskId: string

  @IsString()
  @MaxLength(100)
  respondentName: string

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  respondentEmail?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  respondentDepartment?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  respondentPosition?: string
}
