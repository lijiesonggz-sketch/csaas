import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';

/**
 * Export Cost Report DTO
 *
 * Request parameters for exporting cost reports.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization/dto
 */
export class ExportCostReportDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['csv', 'excel'],
    example: 'csv',
    required: false,
    default: 'csv',
  })
  @IsEnum(['csv', 'excel'])
  @IsOptional()
  format?: 'csv' | 'excel' = 'csv';

  @ApiProperty({
    description: 'Start date (ISO 8601 format)',
    example: '2026-01-01',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date (ISO 8601 format)',
    example: '2026-01-31',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Optional organization ID to filter by',
    example: 'org-123',
    required: false,
  })
  @IsOptional()
  organizationId?: string;
}
