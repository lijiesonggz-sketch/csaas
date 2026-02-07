import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Get Cost Trends DTO
 *
 * Query parameters for getting cost trends.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization/dto
 */
export class GetCostTrendsDto {
  @ApiPropertyOptional({
    description: 'Number of days to look back',
    minimum: 1,
    maximum: 365,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}
