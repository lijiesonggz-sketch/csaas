import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for getting alerts with filters
 *
 * @module backend/src/modules/admin/dashboard/dto
 * @story 7-1
 */
export class GetAlertsDto {
  @ApiPropertyOptional({
    enum: ['unresolved', 'resolved', 'ignored'],
    description: 'Filter by alert status',
  })
  @IsOptional()
  @IsEnum(['unresolved', 'resolved', 'ignored'])
  status?: 'unresolved' | 'resolved' | 'ignored';

  @ApiPropertyOptional({
    enum: ['high', 'medium', 'low'],
    description: 'Filter by alert severity',
  })
  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  severity?: 'high' | 'medium' | 'low';

  @ApiPropertyOptional({
    description: 'Filter by alert type',
  })
  @IsOptional()
  alertType?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
