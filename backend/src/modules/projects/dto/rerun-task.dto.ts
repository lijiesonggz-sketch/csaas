import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator'
import { AITaskType } from '../../../database/entities/ai-task.entity'

export class RerunTaskDto {
  @IsString()
  @IsNotEmpty()
  projectId: string

  @IsEnum(AITaskType)
  type: AITaskType

  @IsOptional()
  @IsString()
  reason?: string
}
