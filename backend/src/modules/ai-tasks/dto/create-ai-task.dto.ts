import { IsString, IsObject, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'

export class CreateAITaskDto {
  @IsString()
  projectId: string

  @IsString()
  type: string

  @IsObject()
  input: Record<string, any>

  @IsOptional()
  @IsEnum(AIModel)
  model?: AIModel

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number
}
