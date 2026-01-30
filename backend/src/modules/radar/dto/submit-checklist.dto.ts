import { IsArray, IsString, IsOptional } from 'class-validator'
// import { Type } from 'class-transformer'
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Submit Checklist DTO
 *
 * Story 4.2 - Phase 5.3: DTO类
 *
 * 用于提交合规自查清单
 */
export class SubmitChecklistDto {
  // @ApiProperty({
  //   description: '已勾选的检查项ID列表',
  //   type: [String],
  //   example: ['item-1', 'item-2', 'item-3'],
  // })
  @IsArray({ message: 'checkedItems must be an array' })
  @IsString({ each: true, message: 'Each checkedItem must be a string' })
  checkedItems: string[]

  // @ApiProperty({
  //   description: '未勾选的检查项ID列表',
  //   type: [String],
  //   example: ['item-4', 'item-5'],
  // })
  @IsArray({ message: 'uncheckedItems must be an array' })
  @IsString({ each: true, message: 'Each uncheckedItem must be a string' })
  uncheckedItems: string[]

  // @ApiPropertyOptional({
  //   description: '附加备注',
  //   type: String,
  //   example: 'Additional observations',
  // })
  @IsOptional()
  @IsString()
  notes?: string
}
