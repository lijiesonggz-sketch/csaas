import { IsString, IsOptional, IsNotEmpty } from 'class-validator'

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  clientName?: string

  @IsOptional()
  @IsString()
  standardName?: string
}
