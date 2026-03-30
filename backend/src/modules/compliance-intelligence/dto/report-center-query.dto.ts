import { Transform } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator'

export const REPORT_CENTER_STATUSES = [
  'not_ready',
  'ready_to_generate',
  'generating',
  'ready',
  'failed',
] as const

export type ReportCenterStatus = (typeof REPORT_CENTER_STATUSES)[number]

export const REPORT_CENTER_SORT_FIELDS = [
  'updatedAt',
  'generatedAt',
  'projectName',
  'reportStatus',
] as const

export type ReportCenterSortBy = (typeof REPORT_CENTER_SORT_FIELDS)[number]
export type ReportCenterSortOrder = 'asc' | 'desc'

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export class ReportCenterQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(REPORT_CENTER_STATUSES, { each: true })
  status?: ReportCenterStatus[]

  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @IsOptional()
  @IsDateString()
  dateTo?: string

  @IsOptional()
  @IsIn(REPORT_CENTER_SORT_FIELDS)
  sortBy?: ReportCenterSortBy = 'updatedAt'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: ReportCenterSortOrder = 'desc'
}
