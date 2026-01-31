import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';

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
  topicName: string;

  /**
   * Topic type - tech or industry
   *
   * @default 'tech'
   */
  @IsEnum(['tech', 'industry'])
  @IsOptional()
  topicType?: 'tech' | 'industry' = 'tech';

  /**
   * Optional description of the topic
   *
   * @example "云原生技术包括容器化、微服务、Kubernetes等"
   * @maxLength 500
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
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
  id: string;

  /**
   * Organization ID
   */
  organizationId: string;

  /**
   * Topic name
   */
  topicName: string;

  /**
   * Topic type
   */
  topicType: 'tech' | 'industry';

  /**
   * Optional description
   */
  description?: string;

  /**
   * Creation timestamp
   */
  createdAt: string;

  /**
   * Optional count of related pushes
   */
  relatedPushCount?: number;
}
