import { IsString, IsEnum, IsOptional } from 'class-validator'
import { AITaskType } from '../../../database/entities/ai-task.entity'

export class RerunTaskDto {
  @IsOptional()
  @IsString()
  projectId?: string

  @IsEnum(AITaskType)
  type: AITaskType

  @IsOptional()
  @IsString()
  reason?: string
}
