import { ApiProperty } from '@nestjs/swagger';

/**
 * Cost Optimization Suggestion DTO
 *
 * Represents a cost optimization suggestion for an organization.
 *
 * @story 7-4
 * @module backend/src/modules/admin/cost-optimization/dto
 */
export class CostOptimizationSuggestionDto {
  @ApiProperty({
    description: 'Organization ID',
    example: 'org-123',
  })
  organizationId: string;

  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corp',
  })
  organizationName: string;

  @ApiProperty({
    description: 'Current monthly cost (CNY)',
    example: 600.5,
  })
  currentCost: number;

  @ApiProperty({
    description: 'Estimated cost after optimization (CNY)',
    example: 450.3,
  })
  estimatedCostAfterOptimization: number;

  @ApiProperty({
    description: 'Potential savings (CNY)',
    example: 150.2,
  })
  potentialSavings: number;

  @ApiProperty({
    description: 'Savings percentage',
    example: 25.03,
  })
  savingsPercentage: number;

  @ApiProperty({
    description: 'List of optimization suggestions',
    type: [String],
    example: [
      'Switch tech_analysis tasks from qwen-max to qwen-plus (save ~30%)',
      'Reduce token usage by optimizing prompts',
      'Consider batch processing for similar tasks',
    ],
  })
  suggestions: string[];

  @ApiProperty({
    description: 'Priority level for optimization',
    enum: ['high', 'medium', 'low'],
    example: 'high',
  })
  priority: 'high' | 'medium' | 'low';
}
