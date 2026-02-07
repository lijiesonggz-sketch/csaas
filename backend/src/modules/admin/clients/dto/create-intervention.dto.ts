import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Create Intervention DTO
 *
 * DTO for creating a new customer intervention record.
 *
 * @story 7-3
 * @module backend/src/modules/admin/clients/dto
 */
export class CreateInterventionDto {
  @ApiProperty({
    description: 'Type of intervention',
    enum: ['contact', 'survey', 'training', 'config_adjustment'],
    example: 'contact',
  })
  @IsEnum(['contact', 'survey', 'training', 'config_adjustment'])
  @IsNotEmpty()
  interventionType: 'contact' | 'survey' | 'training' | 'config_adjustment';

  @ApiProperty({
    description: 'Result of the intervention',
    enum: ['contacted', 'resolved', 'churned', 'pending'],
    example: 'contacted',
  })
  @IsEnum(['contacted', 'resolved', 'churned', 'pending'])
  @IsNotEmpty()
  result: 'contacted' | 'resolved' | 'churned' | 'pending';

  @ApiProperty({
    description: 'Additional notes about the intervention',
    required: false,
    example: '客户反馈推送内容不够相关，已调整关注领域',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
