import { IsString, IsEnum, IsUrl, IsOptional, IsBoolean, MaxLength, Matches } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * CreateRadarSourceDto
 *
 * Story 3.1: 创建雷达信息源的输入验证
 */
export class CreateRadarSourceDto {
  @IsString()
  @MaxLength(255)
  source: string

  @IsEnum(['tech', 'industry', 'compliance'])
  category: 'tech' | 'industry' | 'compliance'

  @IsUrl()
  @MaxLength(1000)
  url: string

  @IsEnum(['wechat', 'recruitment', 'conference', 'website'])
  type: 'wechat' | 'recruitment' | 'conference' | 'website'

  @IsOptional()
  @IsString()
  @MaxLength(255)
  peerName?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    {
      message: 'crawlSchedule must be a valid cron expression',
    },
  )
  crawlSchedule?: string

  @IsOptional()
  crawlConfig?: {
    selector?: string
    listSelector?: string
    titleSelector?: string
    contentSelector?: string
    dateSelector?: string
    authorSelector?: string
    paginationPattern?: string
    maxPages?: number
  }
}

/**
 * UpdateRadarSourceDto
 *
 * Story 3.1: 更新雷达信息源的输入验证
 */
export class UpdateRadarSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string

  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  url?: string

  @IsOptional()
  @IsEnum(['wechat', 'recruitment', 'conference', 'website'])
  type?: 'wechat' | 'recruitment' | 'conference' | 'website'

  @IsOptional()
  @IsString()
  @MaxLength(255)
  peerName?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    {
      message: 'crawlSchedule must be a valid cron expression',
    },
  )
  crawlSchedule?: string

  @IsOptional()
  crawlConfig?: {
    selector?: string
    listSelector?: string
    titleSelector?: string
    contentSelector?: string
    dateSelector?: string
    authorSelector?: string
    paginationPattern?: string
    maxPages?: number
  }
}

/**
 * QueryRadarSourceDto
 *
 * Story 3.1: 查询雷达信息源的参数验证
 */
export class QueryRadarSourceDto {
  @IsOptional()
  @IsEnum(['tech', 'industry', 'compliance'])
  category?: 'tech' | 'industry' | 'compliance'

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean
}
