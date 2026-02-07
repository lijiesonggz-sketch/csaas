import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Batch Optimize DTO
 *
 * Request parameters for batch cost optimization.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization/dto
 */
export class BatchOptimizeDto {
  @ApiProperty({
    description: 'Array of organization IDs to optimize',
    type: [String],
    example: ['org-123', 'org-456'],
  })
  @IsArray()
  @IsString({ each: true })
  organizationIds: string[];

  @ApiProperty({
    description: 'Optimization action to perform',
    enum: ['switch_model', 'enable_caching', 'optimize_prompts'],
    example: 'switch_model',
  })
  @IsEnum(['switch_model', 'enable_caching', 'optimize_prompts'])
  action: 'switch_model' | 'enable_caching' | 'optimize_prompts';

  @ApiProperty({
    description: 'Optional notes for the optimization',
    required: false,
    example: 'Switching to qwen-plus for cost reduction',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
