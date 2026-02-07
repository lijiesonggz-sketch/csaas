import { Injectable, BadRequestException } from '@nestjs/common'
import * as Papa from 'papaparse'
import { CreateClientDto, IndustryType, OrganizationScale } from './dto/create-client.dto'

/**
 * CSV Parser Service
 *
 * Service for parsing CSV files into client DTOs.
 *
 * @story 6-2
 * @module backend/src/modules/admin/clients/csv-parser.service
 */
@Injectable()
export class CsvParserService {
  /**
   * Parse CSV file buffer into CreateClientDto array
   *
   * Expected CSV format:
   * name,contactPerson,contactEmail,industryType,scale
   * "客户名称","联系人","email@example.com","banking","large"
   *
   * @param buffer - CSV file buffer
   * @returns Array of CreateClientDto
   */
  parseClientsCsv(buffer: Buffer): CreateClientDto[] {
    const csvText = buffer.toString('utf-8')

    const parseResult = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (parseResult.errors.length > 0) {
      throw new BadRequestException(
        `CSV parsing failed: ${parseResult.errors.map((e) => e.message).join(', ')}`,
      )
    }

    const clients: CreateClientDto[] = []

    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i]
      const rowNumber = i + 2 // +2 because header is row 1, data starts at row 2

      try {
        const client = this.validateAndTransformRow(row, rowNumber)
        clients.push(client)
      } catch (error) {
        throw new BadRequestException(
          `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Invalid data'}`,
        )
      }
    }

    if (clients.length === 0) {
      throw new BadRequestException('CSV file is empty or contains no valid data')
    }

    return clients
  }

  /**
   * Validate and transform a CSV row into CreateClientDto
   */
  private validateAndTransformRow(row: Record<string, string>, rowNumber: number): CreateClientDto {
    // Required fields
    if (!row.name || row.name.trim() === '') {
      throw new Error(`name is required`)
    }

    // Optional email validation
    if (row.contactEmail && !this.isValidEmail(row.contactEmail)) {
      throw new Error(`contactEmail is invalid: ${row.contactEmail}`)
    }

    // Validate industryType enum
    if (row.industryType && !Object.values(IndustryType).includes(row.industryType as IndustryType)) {
      throw new Error(
        `industryType must be one of: ${Object.values(IndustryType).join(', ')}. Got: ${row.industryType}`,
      )
    }

    // Validate scale enum
    if (row.scale && !Object.values(OrganizationScale).includes(row.scale as OrganizationScale)) {
      throw new Error(
        `scale must be one of: ${Object.values(OrganizationScale).join(', ')}. Got: ${row.scale}`,
      )
    }

    return {
      name: row.name.trim(),
      contactPerson: row.contactPerson?.trim(),
      contactEmail: row.contactEmail?.trim(),
      industryType: row.industryType as IndustryType,
      scale: row.scale as OrganizationScale,
    }
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Generate CSV template for download
   *
   * @returns CSV template string
   */
  generateCsvTemplate(): string {
    const headers = ['name', 'contactPerson', 'contactEmail', 'industryType', 'scale']
    const exampleRow = [
      '示例客户',
      '张三',
      'zhangsan@example.com',
      'banking',
      'large',
    ]

    return Papa.unparse({
      fields: headers,
      data: [exampleRow],
    })
  }
}
