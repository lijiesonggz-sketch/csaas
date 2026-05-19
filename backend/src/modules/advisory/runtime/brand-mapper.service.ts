import { Injectable } from '@nestjs/common'

const BRAND_TOKEN_PATTERN = /(?<![_/\\.-])\b(?:BMAD|BMad|BMM|CIS|bmad|bmm|cis)\b(?![_/\\.-])/g

@Injectable()
export class ThinkTankBrandMapperService {
  mapVisibleText(content: string): string {
    if (!content) return content

    const lines = content.split(/(\r?\n)/)
    let openFence: { marker: '`' | '~'; length: number } | null = null

    return lines
      .map((line) => {
        if (line === '\n' || line === '\r\n') {
          return line
        }

        const fenceMatch = line.match(/^( {0,3})(`{3,}|~{3,})(.*)$/)
        if (fenceMatch) {
          const markerRun = fenceMatch[2]
          const marker = markerRun[0] as '`' | '~'
          if (!openFence) {
            openFence = { marker, length: markerRun.length }
          } else if (
            openFence.marker === marker &&
            markerRun.length >= openFence.length &&
            fenceMatch[3].trim().length === 0
          ) {
            openFence = null
          }
          return line
        }

        if (openFence) {
          return line
        }

        if (this.isDiagnosticLogLine(line)) {
          return line
        }

        return this.mapInlineCodeAwareSegments(line)
      })
      .join('')
  }

  private isDiagnosticLogLine(line: string) {
    const trimmed = line.trimStart()
    const level = '(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)'

    return (
      new RegExp(`^(?:\\[${level}\\]|${level})(?::|\\s)`, 'i').test(trimmed) ||
      new RegExp(
        `^\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?\\s+(?:\\[${level}\\]|${level})(?::|\\s)`,
        'i',
      ).test(trimmed)
    )
  }

  private mapInlineCodeAwareSegments(line: string): string {
    let output = ''
    let cursor = 0

    while (cursor < line.length) {
      const openingIndex = line.indexOf('`', cursor)
      if (openingIndex === -1) {
        output += this.mapBrandTokens(line.slice(cursor))
        break
      }

      output += this.mapBrandTokens(line.slice(cursor, openingIndex))

      const markerLength = this.countBackticks(line, openingIndex)
      const closingIndex = this.findClosingBackticks(
        line,
        openingIndex + markerLength,
        markerLength,
      )

      if (closingIndex === -1) {
        output += this.mapBrandTokens(line.slice(openingIndex))
        break
      }

      output += line.slice(openingIndex, closingIndex + markerLength)
      cursor = closingIndex + markerLength
    }

    return output
  }

  private countBackticks(line: string, start: number) {
    let index = start
    while (line[index] === '`') {
      index += 1
    }

    return index - start
  }

  private findClosingBackticks(line: string, start: number, markerLength: number) {
    let index = start

    while (index < line.length) {
      const candidate = line.indexOf('`', index)
      if (candidate === -1) return -1

      if (this.countBackticks(line, candidate) === markerLength) {
        return candidate
      }

      index = candidate + 1
    }

    return -1
  }

  private mapBrandTokens(segment: string) {
    return segment.replace(BRAND_TOKEN_PATTERN, 'ThinkTank')
  }
}
