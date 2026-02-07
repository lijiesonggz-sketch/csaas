import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsArray, IsUUID } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum RelevanceFilter {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Bulk Config DTO
 *
 * Data transfer object for bulk configuration of clients.
 *
 * @story 6-2
 */
export class BulkConfigDto {
  @ApiProperty({
    description: '要配置的客户组织 ID 列表',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  organizationIds: string[]

  @ApiPropertyOptional({ description: '推送开始时间 (HH:mm)', example: '09:00' })
  @IsString()
  @IsOptional()
  pushStartTime?: string

  @ApiPropertyOptional({ description: '推送结束时间 (HH:mm)', example: '18:00' })
  @IsString()
  @IsOptional()
  pushEndTime?: string

  @ApiPropertyOptional({ description: '每日推送上限', example: 5, minimum: 1, maximum: 20 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  dailyPushLimit?: number

  @ApiPropertyOptional({
    description: '相关性过滤级别',
    enum: RelevanceFilter,
    example: RelevanceFilter.HIGH,
  })
  @IsEnum(RelevanceFilter)
  @IsOptional()
  relevanceFilter?: RelevanceFilter
}
