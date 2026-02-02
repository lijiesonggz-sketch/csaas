import {
  IsArray,
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  validate,
  Min,
  Max,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Checklist Item DTO
 */
export class ChecklistItemDto {
  // @ApiProperty({ description: '检查项ID' })
  @IsString()
  id: string

  // @ApiProperty({ description: '检查项内容' })
  @IsString()
  text: string

  // @ApiProperty({ description: '检查项类别' })
  @IsString()
  category: string

  // @ApiProperty({ description: '是否已勾选' })
  checked: boolean

  // @ApiProperty({ description: '排序顺序' })
  @IsNumber()
  order: number
}

/**
 * Solution DTO
 */
export class SolutionDto {
  // @ApiProperty({ description: '解决方案名称' })
  @IsString()
  name: string

  // @ApiProperty({ description: '预计成本' })
  @IsNumber()
  estimatedCost: number

  // @ApiProperty({ description: '预期收益' })
  @IsNumber()
  expectedBenefit: number

  // @ApiProperty({ description: 'ROI评分 (1-10)' })
  @IsNumber()
  @Min(1)
  @Max(10)
  roiScore: number

  // @ApiProperty({ description: '实施周期' })
  @IsString()
  implementationTime: string
}

/**
 * Compliance Playbook DTO
 *
 * Story 4.2 - Phase 5.3: DTO类
 *
 * 合规应对剧本响应DTO
 */
export class CompliancePlaybookDto {
  // @ApiProperty({ description: '剧本ID' })
  @IsString()
  id: string

  // @ApiProperty({ description: '推送ID' })
  @IsString()
  pushId: string

  // @ApiProperty({
  //   description: '检查清单项',
  //   type: [ChecklistItemDto],
  // })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklistItems: ChecklistItemDto[]

  // @ApiProperty({
  //   description: '解决方案列表',
  //   type: [SolutionDto],
  // })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolutionDto)
  solutions: SolutionDto[]

  // @ApiProperty({ description: '报告模板' })
  @IsString()
  reportTemplate: string

  // @ApiPropertyOptional({
  //   description: '政策参考链接',
  //   type: [String],
  // })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  policyReference?: string[]

  // @ApiProperty({ description: '生成时间' })
  @IsDate()
  @Type(() => Date)
  generatedAt: Date
}
