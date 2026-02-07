import { IsInt, IsOptional, IsString, Min, Max, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Submit Feedback DTO
 *
 * Request body for submitting push feedback
 *
 * @story 7-2
 */
export class SubmitFeedbackDto {
  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Optional comment/feedback text',
    required: false,
    maxLength: 1000,
    example: '内容很有用，帮助我了解了最新的技术趋势',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  comment?: string;
}

/**
 * Feedback Response DTO
 */
export class FeedbackResponseDto {
  @ApiProperty({ description: 'Feedback ID' })
  id: string;

  @ApiProperty({ description: 'Push ID' })
  pushId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Rating from 1 to 5' })
  rating: number;

  @ApiProperty({ description: 'Comment text', nullable: true })
  comment: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}
