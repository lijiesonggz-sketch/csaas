import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for getting trend data
 *
 * @module backend/src/modules/admin/dashboard/dto
 * @story 7-1
 */
export class GetTrendDataDto {
  @ApiProperty({
    enum: ['availability', 'push_success_rate', 'ai_cost', 'customer_activity'],
    description: 'Metric type to get trend data for',
  })
  @IsEnum(['availability', 'push_success_rate', 'ai_cost', 'customer_activity'])
  metric: 'availability' | 'push_success_rate' | 'ai_cost' | 'customer_activity';

  @ApiProperty({
    enum: ['7d', '30d', '90d'],
    description: 'Time range for trend data',
    default: '30d',
  })
  @IsEnum(['7d', '30d', '90d'])
  range: '7d' | '30d' | '90d' = '30d';
}
