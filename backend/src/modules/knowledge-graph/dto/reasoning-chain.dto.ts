import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty, IsNumber, Min, Max, IsEnum } from 'class-validator'

export class ReasoningChainTaxonomyDto {
  @ApiProperty({ example: 'IT', description: 'L1 分类代码' })
  @IsString()
  @IsNotEmpty()
  l1Code: string

  @ApiProperty({ example: '信息技术', description: 'L1 分类名称' })
  @IsString()
  @IsNotEmpty()
  l1Name: string

  @ApiProperty({ example: 'IT-01', description: 'L2 分类代码' })
  @IsString()
  @IsNotEmpty()
  l2Code: string

  @ApiProperty({ example: '数据安全', description: 'L2 分类名称' })
  @IsString()
  @IsNotEmpty()
  l2Name: string
}

export class ReasoningChainFailureModeDto {
  @ApiProperty({ description: '失效模式 ID' })
  @IsString()
  @IsNotEmpty()
  failureModeId: string

  @ApiProperty({ example: 'FM-001', description: '失效模式代码' })
  @IsString()
  @IsNotEmpty()
  failureModeCode: string

  @ApiProperty({ example: '数据泄露', description: '失效模式名称' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 'INTEGRITY_FAILURE', description: '失效模式类别' })
  @IsString()
  @IsNotEmpty()
  category: string

  @ApiProperty({ example: 5, description: '关联的控制点数量' })
  @IsNumber()
  @Min(0)
  controlPointCount: number
}

export class ReasoningChainControlPointDto {
  @ApiProperty({ description: '控制点 ID' })
  @IsString()
  @IsNotEmpty()
  controlId: string

  @ApiProperty({ example: 'CP-001', description: '控制点代码' })
  @IsString()
  @IsNotEmpty()
  controlCode: string

  @ApiProperty({ example: '数据加密控制', description: '控制点名称' })
  @IsString()
  @IsNotEmpty()
  controlName: string

  @ApiProperty({ example: 'hard', description: '成熟度等级' })
  @IsString()
  @IsNotEmpty()
  maturityLevel: string

  @ApiProperty({ example: 85.5, description: '权威性评分' })
  @IsNumber()
  @Min(0)
  @Max(100)
  authoritativeScore: number

  @ApiProperty({ example: 'both', description: '来源类型' })
  @IsString()
  @IsNotEmpty()
  originType: string

  @ApiProperty({ example: 'PRIMARY', description: '与失效模式的关联度' })
  @IsString()
  @IsNotEmpty()
  failureModeRelevance: string

  @ApiProperty({ description: '关联的失效模式 ID' })
  @IsString()
  @IsNotEmpty()
  failureModeId: string
}

export class ReasoningChainObligationDto {
  @ApiProperty({ description: '义务 ID' })
  @IsString()
  @IsNotEmpty()
  obligationId: string

  @ApiProperty({ example: 'OBL-001', description: '义务代码' })
  @IsString()
  @IsNotEmpty()
  obligationCode: string

  @ApiProperty({ description: '义务文本' })
  @IsString()
  @IsNotEmpty()
  obligationText: string

  @ApiProperty({ example: 'MANDATORY', description: '义务类型' })
  @IsString()
  @IsNotEmpty()
  obligationType: string

  @ApiProperty({ description: '关联的控制点 ID' })
  @IsString()
  @IsNotEmpty()
  controlId: string

  @ApiProperty({ example: 'FULL', description: '覆盖程度' })
  @IsString()
  @IsNotEmpty()
  coverage: string
}

export class ReasoningChainResponseDto {
  @ApiProperty({ type: ReasoningChainTaxonomyDto })
  taxonomy: ReasoningChainTaxonomyDto

  @ApiProperty({ type: [ReasoningChainFailureModeDto] })
  failureModes: ReasoningChainFailureModeDto[]

  @ApiProperty({ type: [ReasoningChainControlPointDto] })
  controlPoints: ReasoningChainControlPointDto[]

  @ApiProperty({ type: [ReasoningChainObligationDto] })
  obligations: ReasoningChainObligationDto[]
}
