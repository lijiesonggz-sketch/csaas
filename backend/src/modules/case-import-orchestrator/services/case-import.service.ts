import { unlink } from 'fs/promises'
import { resolve, sep } from 'path'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as XLSX from 'xlsx'
import { Repository } from 'typeorm'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { CreateComplianceCaseDto } from '../../knowledge-graph/dto/compliance-case.dto'
import { ComplianceCaseService } from '../../knowledge-graph/services/compliance-case.service'
import {
  KG_CASE_IMPORT_UPLOAD_DIR,
} from '../constants/case-import.constants'
import {
  ComplianceCaseImportResult,
  ComplianceCaseImportRowFailure,
  ImportComplianceCasesDto,
} from '../dto/import-compliance-cases.dto'

type SpreadsheetRow = Record<string, unknown>

type NormalizedRow = {
  caseCode: string
  caseTitle: string | null
  sourceOrg: string | null
  penalizedPerson: string | null
  authorityName: string | null
  regulatorCode: string
  caseDate: string | null
  caseFacts: string | null
  penaltyReason: string | null
  rawSourceUrl: string | null
  rawContentId: string | null
}

const FIELD_ALIASES = {
  caseNumber: [
    'case_number',
    'case no',
    'case_no',
    '案件编号',
    '行政处罚决定书文号',
    '处罚决定书文号',
    '决定书文号',
    '文号',
    '文档id',
    '索引id',
  ],
  caseTitle: ['case_title', '标题', '案件标题', '处罚标题'],
  penalizedOrg: [
    'penalized_entity',
    '处罚对象',
    '被处罚对象',
    '被处罚机构',
    '被处罚当事人',
    '被处罚单位',
    '机构名称',
  ],
  penalizedPerson: [
    'penalized_person',
    '被处罚当事人姓名',
  ],
  violationSummary: [
    'violation_summary',
    '处罚事宜',
    '违法行为类型',
    '主要违法违规事实',
    '主要违法违规事实（案由）',
    '事实摘要',
    '违规摘要',
  ],
  violationReason: [
    'violation_reason',
    '处罚原因',
    '处罚依据',
    '行政处罚依据',
    '违规原因',
    '违法依据',
  ],
  penaltyDate: ['penalty_date', '处罚日期', '作出处罚决定日期', '决定日期', '时间'],
  sourceUrl: ['source_url', '原文链接', '来源链接', '标题链接', '链接', 'url'],
  rawContentId: ['raw_content_id', 'rawcontentid'],
  authorityName: ['authority_name', '来源监管机构', '监管机构名称', '监管机构'],
} as const

const REGULATOR_LABELS: Record<string, string> = {
  PBOC: '中国人民银行',
  NFRA: '国家金融监督管理总局',
  CSRC: '中国证券监督管理委员会',
}

@Injectable()
export class CaseImportService {
  constructor(
    private readonly complianceCaseService: ComplianceCaseService,
    @InjectRepository(RawContent)
    private readonly rawContentRepository: Repository<RawContent>,
  ) {}

  async importCases(params: ImportComplianceCasesDto): Promise<ComplianceCaseImportResult> {
    const regulatorCode = this.normalizeRegulatorCode(params.regulatorCode)
    try {
      const workbook = XLSX.readFile(params.filePath)
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new BadRequestException('Workbook does not contain any worksheet')
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, {
        defval: null,
        raw: false,
      })
      const rows = rawRows.filter((row) => this.hasRowContent(row))
      const batchId = params.batchId ?? this.buildBatchId(regulatorCode)
      const failures: ComplianceCaseImportRowFailure[] = []
      let importedCount = 0

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2

        try {
          const normalized = await this.normalizeRow(row, rowNumber, regulatorCode)
          const dto: CreateComplianceCaseDto = {
            caseCode: normalized.caseCode,
            caseTitle: normalized.caseTitle,
            sourceOrg: normalized.sourceOrg,
            penalizedPerson: normalized.penalizedPerson,
            authorityName: normalized.authorityName,
            regulatorCode: normalized.regulatorCode,
            caseDate: normalized.caseDate,
            caseFacts: normalized.caseFacts,
            penaltyReason: normalized.penaltyReason,
            rawSourceUrl: normalized.rawSourceUrl,
            rawContentId: normalized.rawContentId,
            importBatchId: batchId,
            status: 'pending',
          }

          await this.complianceCaseService.createCase(dto)
          importedCount += 1
        } catch (error) {
          failures.push({
            rowNumber,
            caseNumber: this.extractCaseNumber(row),
            message: error instanceof Error ? error.message : 'Unknown import failure',
          })
        }
      }

      return {
        batchId,
        filePath: params.filePath,
        regulatorCode,
        totalRows: rows.length,
        importedCount,
        failedCount: failures.length,
        failures,
      }
    } finally {
      await this.cleanupManagedUpload(params.filePath)
    }
  }

  private async normalizeRow(
    row: SpreadsheetRow,
    rowNumber: number,
    regulatorCode: string,
  ): Promise<NormalizedRow> {
    const caseNumber = this.extractCaseNumber(row)
    const caseTitle = this.extractString(row, FIELD_ALIASES.caseTitle)
    const violationSummary = this.extractString(row, FIELD_ALIASES.violationSummary)
    const violationReason = this.extractString(row, FIELD_ALIASES.violationReason)

    if (!caseNumber && !caseTitle) {
      throw new BadRequestException(`Row ${rowNumber}: case number or case title is required`)
    }

    if (!violationSummary && !violationReason) {
      throw new BadRequestException(
        `Row ${rowNumber}: violation summary or penalty reason is required`,
      )
    }

    const rawSourceUrl = this.extractString(row, FIELD_ALIASES.sourceUrl)
    const rawContentId = await this.resolveRawContentId(
      this.extractString(row, FIELD_ALIASES.rawContentId),
      rawSourceUrl,
      rowNumber,
    )

    return {
      caseCode: this.buildCaseCode(regulatorCode, caseNumber, caseTitle, rowNumber),
      caseTitle,
      sourceOrg: this.extractString(row, FIELD_ALIASES.penalizedOrg),
      penalizedPerson: this.extractString(row, FIELD_ALIASES.penalizedPerson),
      authorityName:
        this.extractString(row, FIELD_ALIASES.authorityName) ??
        REGULATOR_LABELS[regulatorCode] ??
        regulatorCode,
      regulatorCode,
      caseDate: this.extractDate(row, FIELD_ALIASES.penaltyDate),
      caseFacts: violationSummary,
      penaltyReason: violationReason,
      rawSourceUrl,
      rawContentId,
    }
  }

  private async resolveRawContentId(
    explicitRawContentId: string | null,
    rawSourceUrl: string | null,
    rowNumber: number,
  ): Promise<string | null> {
    if (explicitRawContentId) {
      if (!this.isUuid(explicitRawContentId)) {
        throw new BadRequestException(`Row ${rowNumber}: raw_content_id must be a valid UUID`)
      }

      return explicitRawContentId
    }

    if (!rawSourceUrl) {
      return null
    }

    const rawContent = await this.rawContentRepository.findOne({
      where: { url: rawSourceUrl },
    })

    return rawContent?.id ?? null
  }

  private extractCaseNumber(row: SpreadsheetRow): string | null {
    return this.extractString(row, FIELD_ALIASES.caseNumber)
  }

  private extractString(row: SpreadsheetRow, aliases: readonly string[]): string | null {
    const lookup = new Map(
      Object.entries(row).map(([key, value]) => [this.normalizeHeader(key), value]),
    )

    for (const alias of aliases) {
      const value = lookup.get(this.normalizeHeader(alias))

      if (value === undefined || value === null) {
        continue
      }

      const trimmed = String(value).trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }

    return null
  }

  private extractDate(row: SpreadsheetRow, aliases: readonly string[]): string | null {
    const value = this.extractString(row, aliases)

    if (!value) {
      return null
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value
    }

    const compactDashedDateTime = value.match(/^(\d{4})-(\d{2})-(\d{2})\d{2}:\d{2}:\d{2}$/)
    if (compactDashedDateTime) {
      return `${compactDashedDateTime[1]}-${compactDashedDateTime[2]}-${compactDashedDateTime[3]}`
    }

    const compactSlashedDateTime = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\d{2}:\d{2}:\d{2}$/)
    if (compactSlashedDateTime) {
      return `${compactSlashedDateTime[1]}-${compactSlashedDateTime[2].padStart(2, '0')}-${compactSlashedDateTime[3].padStart(2, '0')}`
    }

    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
      return value.replace(/\//g, '-').replace(/-(\d)(?!\d)/g, '-0$1')
    }

    const maybeExcelNumber = Number(value)
    if (!Number.isNaN(maybeExcelNumber) && maybeExcelNumber > 30000) {
      const parsed = XLSX.SSF.parse_date_code(maybeExcelNumber)
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      }
    }

    const parsedDate = new Date(value)
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10)
    }

    throw new BadRequestException(`Invalid date value: ${value}`)
  }

  private buildCaseCode(
    regulatorCode: string,
    caseNumber: string | null,
    caseTitle: string | null,
    rowNumber: number,
  ): string {
    const rawIdentifier = caseNumber ?? `TITLE-${this.hashText(caseTitle ?? `ROW-${rowNumber}`)}`
    const normalizedIdentifier = rawIdentifier
      .toUpperCase()
      .replace(/[^A-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return `${regulatorCode}-${normalizedIdentifier || `ROW-${rowNumber}`}`
  }

  private buildBatchId(regulatorCode: string): string {
    return `${regulatorCode}-${Date.now()}`
  }

  private normalizeRegulatorCode(code: string): string {
    const normalized = code.trim().toUpperCase()

    if (!normalized) {
      throw new BadRequestException('regulatorCode is required')
    }

    return normalized
  }

  private normalizeHeader(header: string): string {
    return header.toLowerCase().replace(/[\s_\-()（）]/g, '')
  }

  private hasRowContent(row: SpreadsheetRow): boolean {
    return Object.values(row).some((value) => value !== null && String(value).trim().length > 0)
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  private hashText(value: string): string {
    let hash = 0

    for (const char of value) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    }

    return hash.toString(36).toUpperCase()
  }

  private async cleanupManagedUpload(filePath: string): Promise<void> {
    if (!this.isManagedUpload(filePath)) {
      return
    }

    try {
      await unlink(filePath)
    } catch {
      // Ignore temp file cleanup errors to avoid masking import results.
    }
  }

  private isManagedUpload(filePath: string): boolean {
    const normalizedUploadDir = resolve(KG_CASE_IMPORT_UPLOAD_DIR)
    const normalizedFilePath = resolve(filePath)

    return (
      normalizedFilePath === normalizedUploadDir ||
      normalizedFilePath.startsWith(`${normalizedUploadDir}${sep}`)
    )
  }
}
