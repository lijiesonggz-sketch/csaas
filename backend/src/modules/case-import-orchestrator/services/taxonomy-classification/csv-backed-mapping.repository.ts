import * as fs from 'fs'
import * as path from 'path'
import { Injectable } from '@nestjs/common'
import * as Papa from 'papaparse'
import type { MappingRepository } from './mapping-repository.interface'
import type { TaxonomyMappingRecord } from './contracts/classification-result.contract'

const DEFAULT_MAPPING_RELATIVE_PATH = 'docs/it-taxonomy-to-kg-semantic-mapping-2026-04-07.csv'
const REQUIRED_HEADERS = [
  '一级编码',
  '一级类型',
  '二级编码',
  '二级子类型',
  '定义口径',
  '建议canonicalTheme',
  '建议aliases',
  '建议keywords',
] as const

type CsvMappingRow = Record<string, string>

export type CsvBackedMappingRepositoryOptions = {
  mappingPath?: string
  csvText?: string
  mappingVersion?: string
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}

function splitPipeList(value?: string): string[] {
  return dedupe(
    (value ?? '')
      .split('|')
      .map((entry) => entry.replace(/\s+/g, '').trim())
      .filter((entry) => entry.length > 0),
  )
}

function resolveExistingPath(candidates: string[]): string {
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    throw new Error(
      `Taxonomy mapping CSV not found. Tried candidates: ${candidates.join(', ')}`,
    )
  }

  return found
}

function resolveWorkspaceArtifactPath(relativePath: string): string {
  const normalizedRelativePath = relativePath.replace(/\//g, path.sep)
  const candidates = [
    path.resolve(process.cwd(), normalizedRelativePath),
    path.resolve(process.cwd(), '..', normalizedRelativePath),
    path.resolve(__dirname, '../../../../../', normalizedRelativePath),
    path.resolve(__dirname, '../../../../../../', normalizedRelativePath),
  ]

  return resolveExistingPath(candidates)
}

function resolveMappingVersion(mappingPath: string | null, explicitVersion?: string): string {
  if (explicitVersion) {
    return explicitVersion
  }
  if (!mappingPath) {
    throw new Error('Taxonomy mapping version is required when mappingPath is not provided')
  }

  const basename = path.basename(mappingPath)
  const match = basename.match(/(\d{4}-\d{2}-\d{2})/)
  if (!match) {
    throw new Error(
      `Taxonomy mapping version is not parseable from path: ${mappingPath}. Provide mappingVersion explicitly.`,
    )
  }

  return match[1]
}

@Injectable()
export class CsvBackedMappingRepository implements MappingRepository {
  private readonly mappingPath: string | null
  private readonly csvText: string | null
  private readonly mappingVersion: string
  private cachedMappings: TaxonomyMappingRecord[] | null = null

  constructor(options: CsvBackedMappingRepositoryOptions = {}) {
    this.csvText = options.csvText ?? null
    this.mappingPath = this.csvText ? null : options.mappingPath ?? DEFAULT_MAPPING_RELATIVE_PATH
    this.mappingVersion = resolveMappingVersion(
      this.mappingPath,
      options.mappingVersion,
    )
  }

  loadAll(): TaxonomyMappingRecord[] {
    if (!this.cachedMappings) {
      this.cachedMappings = this.parseMappings(this.csvText ?? this.readCsvFromDisk())
    }

    return this.cachedMappings.map((mapping) => ({
      ...mapping,
      aliases: [...mapping.aliases],
      keywords: [...mapping.keywords],
    }))
  }

  loadByL1Code(l1Code: string): TaxonomyMappingRecord[] {
    return this.loadAll().filter((mapping) => mapping.l1Code === l1Code)
  }

  getVersion(): string {
    return this.mappingVersion
  }

  private readCsvFromDisk(): string {
    if (!this.mappingPath) {
      throw new Error('Taxonomy mapping CSV path is not readable')
    }

    const resolvedPath = resolveWorkspaceArtifactPath(this.mappingPath)
    return fs.readFileSync(resolvedPath, 'utf8')
  }

  private parseMappings(csvText: string): TaxonomyMappingRecord[] {
    const parsed = Papa.parse<CsvMappingRow>(csvText, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      throw new Error(
        `Taxonomy mapping CSV schema validation failed. Parse errors: ${parsed.errors
          .map((error) => `${error.code}@${error.row}`)
          .join(', ')}`,
      )
    }

    this.validateHeaders(parsed.meta.fields ?? [])

    return parsed.data.map((row, index) => this.mapRow(row, index + 2))
  }

  private validateHeaders(fields: string[]): void {
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !fields.includes(header))
    if (missingHeaders.length > 0) {
      throw new Error(
        `Taxonomy mapping CSV schema validation failed. Missing columns: ${missingHeaders.join(', ')}`,
      )
    }
  }

  private mapRow(row: CsvMappingRow, lineNumber: number): TaxonomyMappingRecord {
    const l1Code = (row['一级编码'] ?? '').trim()
    const l2Code = (row['二级编码'] ?? '').trim()
    const l2Name = (row['二级子类型'] ?? '').trim()

    if (!l1Code || !l2Code) {
      throw new Error(
        `Taxonomy mapping CSV schema validation failed at line ${lineNumber}: 一级编码/二级编码不能为空`,
      )
    }
    if (!l2Name) {
      throw new Error(
        `Taxonomy mapping CSV schema validation failed at line ${lineNumber}: 二级子类型不能为空`,
      )
    }

    return {
      l1Code,
      l1Name: (row['一级类型'] ?? '').trim(),
      l2Code,
      l2Name,
      definition: (row['定义口径'] ?? '').trim(),
      canonicalTheme: (row['建议canonicalTheme'] ?? '').trim(),
      aliases: splitPipeList(row['建议aliases']),
      keywords: splitPipeList(row['建议keywords']),
    }
  }
}
