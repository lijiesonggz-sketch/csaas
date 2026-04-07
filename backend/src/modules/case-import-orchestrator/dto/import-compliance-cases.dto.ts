import { IsOptional, IsString, Length } from 'class-validator'

export class UploadComplianceCasesDto {
  @IsString()
  @Length(2, 20)
  regulatorCode: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  batchId?: string
}

export class ImportComplianceCasesDto extends UploadComplianceCasesDto {
  @IsString()
  @Length(1, 2000)
  filePath: string

  @IsOptional()
  @IsString()
  @Length(1, 255)
  sourceFileName?: string
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

export interface ComplianceCaseImportEnqueueResult {
  jobId: string
  batchId: string
  fileName: string
  regulatorCode: string
  status: 'queued'
}
