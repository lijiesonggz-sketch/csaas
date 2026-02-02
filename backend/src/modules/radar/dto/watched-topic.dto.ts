import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional, Matches } from 'class-validator'

/**
 * DTO for creating a new watched topic
 *
 * @story Story 5.1 - Configure Focus Technical Areas
 */
export class CreateWatchedTopicDto {
  /**
   * Topic name
   *
   * @example "云原生"
   * @maxLength 100
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_]+$/, {
    message: '领域名称只能包含字母、数字、中文、空格、连字符和下划线',
  })
  topicName: string

  /**
   * Topic type - tech or industry
   *
   * @default 'tech'
   */
  @IsEnum(['tech', 'industry'])
  @IsOptional()
  topicType?: 'tech' | 'industry' = 'tech'

  /**
   * Optional description of the topic
   *
   * @example "云原生技术包括容器化、微服务、Kubernetes等"
   * @maxLength 500
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Matches(/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_,，。、；：""''（）()]+$/, {
    message: '描述只能包含字母、数字、中文和常用标点符号',
  })
  description?: string
}

/**
 * DTO for watched topic response
 *
 * @story Story 5.1 - Configure Focus Technical Areas
 */
export class WatchedTopicResponseDto {
  /**
   * Topic ID
   */
  id: string

  /**
   * Organization ID
   */
  organizationId: string

  /**
   * Topic name
   */
  topicName: string

  /**
   * Topic type
   */
  topicType: 'tech' | 'industry'

  /**
   * Optional description
   */
  description?: string

  /**
   * Creation timestamp
   */
  createdAt: string

  /**
   * Optional count of related pushes
   */
  relatedPushCount?: number
}
