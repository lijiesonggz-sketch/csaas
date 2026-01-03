import { IsString, IsEnum, IsNotEmpty } from 'class-validator'
import { AITaskType } from '../../../database/entities/ai-task.entity'

export class RollbackTaskDto {
  @IsString()
  @IsNotEmpty()
  projectId: string

  @IsEnum(AITaskType)
  type: AITaskType
}
