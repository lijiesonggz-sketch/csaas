import { IsString, IsOptional, IsInt, Min, Max, IsIn, Matches } from 'class-validator'

/**
 * Update Push Preference DTO
 *
 * Used for updating organization push preferences.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdatePushPreferenceDto {
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: '时间格式必须为 HH:mm',
  })
  pushStartTime?: string

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: '时间格式必须为 HH:mm',
  })
  pushEndTime?: string

  @IsInt()
  @IsOptional()
  @Min(1, { message: '推送上限至少为 1' })
  @Max(20, { message: '推送上限最多为 20' })
  dailyPushLimit?: number

  @IsString()
  @IsOptional()
  @IsIn(['high_only', 'high_medium'], {
    message: '相关性过滤必须是 high_only 或 high_medium',
  })
  relevanceFilter?: 'high_only' | 'high_medium'
}

/**
 * Push Preference Response DTO
 *
 * Used for returning push preference data to clients.
 */
export class PushPreferenceResponseDto {
  id: string
  organizationId: string
  pushStartTime: string
  pushEndTime: string
  dailyPushLimit: number
  relevanceFilter: 'high_only' | 'high_medium'
  createdAt: string
  updatedAt: string
}
