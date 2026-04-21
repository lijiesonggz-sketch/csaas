import { ApiProperty } from '@nestjs/swagger'

export class RegulationGraphSourceDto {
  @ApiProperty()
  sourceId: string

  @ApiProperty()
  sourceCode: string

  @ApiProperty()
  sourceName: string

  @ApiProperty({ required: false, nullable: true })
  sourceLevel: string | null

  @ApiProperty({ required: false, nullable: true })
  authorityName: string | null

  @ApiProperty()
  clauseCount: number

  @ApiProperty()
  obligationCount: number

  @ApiProperty()
  controlPointCount: number
}

export class RegulationGraphClauseDto {
  @ApiProperty()
  clauseId: string

  @ApiProperty()
  clauseCode: string

  @ApiProperty({ required: false, nullable: true })
  articleNo: string | null

  @ApiProperty({ required: false, nullable: true })
  sectionPath: string | null

  @ApiProperty()
  clauseText: string

  @ApiProperty({ required: false, nullable: true })
  clauseSummary: string | null

  @ApiProperty({ required: false, nullable: true })
  mandatoryLevel: string | null

  @ApiProperty()
  obligationCount: number

  @ApiProperty()
  controlPointCount: number
}

export class RegulationGraphObligationDto {
  @ApiProperty()
  obligationId: string

  @ApiProperty()
  obligationCode: string

  @ApiProperty()
  obligationText: string

  @ApiProperty()
  obligationType: string

  @ApiProperty({ type: [String] })
  applicableSector: string[]

  @ApiProperty()
  clauseId: string

  @ApiProperty()
  clauseCode: string

  @ApiProperty({ required: false, nullable: true })
  clauseSummary: string | null

  @ApiProperty()
  controlPointCount: number
}

export class RegulationGraphControlPointDto {
  @ApiProperty()
  edgeId: string

  @ApiProperty()
  controlId: string

  @ApiProperty()
  controlCode: string

  @ApiProperty()
  controlName: string

  @ApiProperty({ required: false, nullable: true })
  maturityLevel: string | null

  @ApiProperty({ required: false, nullable: true })
  authoritativeScore: number | null

  @ApiProperty({ required: false, nullable: true })
  originType: string | null

  @ApiProperty({ type: [String] })
  applicableSector: string[]

  @ApiProperty()
  coverage: string

  @ApiProperty()
  obligationId: string

  @ApiProperty()
  obligationCode: string

  @ApiProperty()
  clauseId: string

  @ApiProperty()
  clauseCode: string
}

export class RegulationGraphResponseDto {
  @ApiProperty({ type: RegulationGraphSourceDto })
  source: RegulationGraphSourceDto

  @ApiProperty({ type: [RegulationGraphClauseDto] })
  clauses: RegulationGraphClauseDto[]

  @ApiProperty({ type: [RegulationGraphObligationDto] })
  obligations: RegulationGraphObligationDto[]

  @ApiProperty({ type: [RegulationGraphControlPointDto] })
  controlPoints: RegulationGraphControlPointDto[]
}
