import { IsString, Length } from 'class-validator'

export class ImportComplianceCasesDto {
  @IsString()
  @Length(1, 2000)
  filePath: string

  @IsString()
  @Length(2, 20)
  regulatorCode: string
}

export interface ComplianceCaseImportRowFailure {
  rowNumber: number
  caseNumber: string | null
  message: string
}

export interface ComplianceCaseImportResult {
  batchId: string
  filePath: string
  regulatorCode: string
  totalRows: number
  importedCount: number
  failedCount: number
  failures: ComplianceCaseImportRowFailure[]
}
