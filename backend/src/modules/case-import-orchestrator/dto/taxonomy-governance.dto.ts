import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator'

export class ImportTaxonomyRuntimeProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/)
  sourceVersion: string
}

export type TaxonomyGovernanceDomainSummaryDto = {
  l1Code: string
  l1Name: string
  catalogL2Count: number
  runtimeProfileCount: number
  rulebookEntryCount: number
  mappingSourceVersion: string | null
  rulebookVersion: string | null
  fallbackBucket: string | null
  readinessStage: string | null
}

export type TaxonomyGovernanceSummaryDto = {
  generatedAt: string
  sourceVersion: string | null
  domains: TaxonomyGovernanceDomainSummaryDto[]
}

export type TaxonomyRuntimeProfileImportResultDto = {
  sourceVersion: string
  importedRowCount: number
  cacheRefreshed: boolean
  replacedSnapshot: boolean
}

export type TaxonomyRuntimeProfileExportResultDto = {
  fileName: string
  csvContent: string
  sourceVersion: string
  rowCount: number
}
