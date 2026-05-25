import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import {
  AdvisoryWorkflowOutput,
  AdvisoryWorkflowOutputSection,
} from '../../../database/entities/advisory-workflow-output.entity'
import { AdvisoryAccessService, AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { AdvisorySessionRepository } from '../sessions/advisory-session.repository'
import { AdvisoryWorkflowOutputRepository } from './advisory-workflow-output.repository'
import { AdvisoryOutputPdfRendererService } from './advisory-output-pdf-renderer.service'

export type AdvisoryOutputExportFormat = 'markdown' | 'pdf'

export interface AdvisoryOutputExportResult {
  buffer: Buffer
  contentType: 'text/markdown; charset=utf-8' | 'application/pdf'
  fileName: string
  outputId: string
  format: AdvisoryOutputExportFormat
  sectionCount: number
}

export interface AdvisoryOutputExportContext {
  user: AdvisoryAccessUser
  tenantId: string
  sessionId: string
  format: string
}

const AI_LABEL = '[AI Generated]'
const EXPORT_FORMATS = new Set<AdvisoryOutputExportFormat>(['markdown', 'pdf'])
const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8' as const
const PDF_CONTENT_TYPE = 'application/pdf' as const
const INVALID_FORMAT_MESSAGE = '仅支持 Markdown 和 PDF 导出。'
const OUTPUT_NOT_FOUND_MESSAGE = 'ThinkTank report output was not found.'
const EMPTY_OUTPUT_MESSAGE = '报告至少需要一个章节后才能导出。'
const LABEL_MISSING_MESSAGE = '报告缺少 AI 生成标识，无法导出。'
const EXPORT_FAILED_MESSAGE = '报告导出失败，请重试；如果仍失败，请检查网络或联系管理员。'
const PDF_FONT_STACK = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", Arial, sans-serif'
const EXPORT_MAX_SECTION_COUNT = 80
const EXPORT_MAX_CONTENT_LENGTH = 250_000

@Injectable()
export class AdvisoryOutputExportService {
  constructor(
    private readonly accessService: AdvisoryAccessService,
    private readonly sessionRepository: AdvisorySessionRepository,
    private readonly outputRepository: AdvisoryWorkflowOutputRepository,
    private readonly eventService: AdvisoryEventService,
    private readonly pdfRenderer: AdvisoryOutputPdfRendererService,
  ) {}

  async exportSessionOutput(
    context: AdvisoryOutputExportContext,
  ): Promise<AdvisoryOutputExportResult> {
    const format = this.normalizeFormat(context.format)

    await this.accessService.assertThinkTankModuleAvailable(context.user, context.tenantId)
    const session = await this.sessionRepository.findSessionById(
      context.tenantId,
      context.sessionId,
    )

    if (!session) {
      throw new NotFoundException(OUTPUT_NOT_FOUND_MESSAGE)
    }

    this.assertSessionOwner(session, context.user.id)

    const output =
      (await this.outputRepository.findActiveDraftForSession(context.tenantId, session.id)) ??
      (await this.outputRepository.findLatestCompletedForSession(context.tenantId, session.id))

    if (!output) {
      throw new NotFoundException(OUTPUT_NOT_FOUND_MESSAGE)
    }

    this.assertOutputOwner(output, context.user.id)
    this.assertExportableOutput(output)

    const generatedAt = new Date().toISOString()
    const rendered =
      format === 'markdown'
        ? {
            buffer: Buffer.from(this.renderMarkdown(output), 'utf8'),
            contentType: MARKDOWN_CONTENT_TYPE,
          }
        : await this.renderPdf(output, generatedAt)
    const sectionCount = output.sections.length

    await this.eventService.emitAuditStrict({
      eventName: ThinkTankEventName.OutputExported,
      tenantId: context.tenantId,
      actorId: context.user.id,
      subjectType: ThinkTankSubjectType.Output,
      subjectId: output.id,
      outcome: ThinkTankEventOutcome.Success,
      privacyClassification: ThinkTankPrivacyClassification.Operational,
      optional: {
        sessionId: session.id,
        outputId: output.id,
        workflowType: output.workflowKey,
      },
      audit: {
        action: AuditAction.READ,
        entityType: 'ThinkTankWorkflowOutput',
        entityId: output.id,
        organizationId: context.user.organizationId ?? null,
      },
      metadata: {
        format,
        workflow_key: output.workflowKey,
        section_count: sectionCount,
        ai_label_metadata_present: true,
      },
    })

    return {
      buffer: rendered.buffer,
      contentType: rendered.contentType,
      fileName: this.buildFileName(output, format, generatedAt),
      outputId: output.id,
      format,
      sectionCount,
    }
  }

  private normalizeFormat(format: string): AdvisoryOutputExportFormat {
    const normalized = typeof format === 'string' ? format.trim().toLowerCase() : ''

    if (!EXPORT_FORMATS.has(normalized as AdvisoryOutputExportFormat)) {
      throw new BadRequestException(INVALID_FORMAT_MESSAGE)
    }

    return normalized as AdvisoryOutputExportFormat
  }

  private assertExportableOutput(output: AdvisoryWorkflowOutput): void {
    if (!this.hasRequiredAiLabelMetadata(output)) {
      throw new BadRequestException(LABEL_MISSING_MESSAGE)
    }

    if (!Array.isArray(output.sections) || output.sections.length === 0) {
      throw new BadRequestException(EMPTY_OUTPUT_MESSAGE)
    }

    if (output.sections.length > EXPORT_MAX_SECTION_COUNT) {
      throw new BadRequestException('报告章节过多，请拆分后导出。')
    }

    if (this.measureOutputContentLength(output) > EXPORT_MAX_CONTENT_LENGTH) {
      throw new BadRequestException('报告内容过长，请拆分后导出。')
    }

    const allSectionsLabeled = output.sections.every(
      (section) =>
        section.aiLabel === AI_LABEL &&
        typeof section.contentMarkdown === 'string' &&
        section.contentMarkdown.includes(AI_LABEL) &&
        section.metadata?.ai_generated === true &&
        section.metadata?.machine_readable === true,
    )

    if (!allSectionsLabeled) {
      throw new BadRequestException(LABEL_MISSING_MESSAGE)
    }
  }

  private assertSessionOwner(session: { actorId?: string | null }, actorId: string): void {
    if (session.actorId !== actorId) {
      throw new NotFoundException(OUTPUT_NOT_FOUND_MESSAGE)
    }
  }

  private assertOutputOwner(output: { actorId?: string | null }, actorId: string): void {
    if (output.actorId !== actorId) {
      throw new NotFoundException(OUTPUT_NOT_FOUND_MESSAGE)
    }
  }

  private measureOutputContentLength(output: AdvisoryWorkflowOutput): number {
    return [
      output.title,
      output.summary,
      ...output.sections.flatMap((section) => [section.heading, section.contentMarkdown]),
    ].reduce((total, value) => total + (typeof value === 'string' ? value.length : 0), 0)
  }

  private hasRequiredAiLabelMetadata(output: AdvisoryWorkflowOutput): boolean {
    const metadata = output.aiLabelMetadata ?? {}

    return (
      (metadata.visible_label === AI_LABEL || metadata.visibleLabel === AI_LABEL) &&
      metadata.ai_generated === true &&
      metadata.machine_readable === true
    )
  }

  private renderMarkdown(output: AdvisoryWorkflowOutput): string {
    return [
      `# ${this.toMarkdownHeadingText(output.title)}`,
      ...output.sections.flatMap((section) => [
        `## ${this.toMarkdownHeadingText(section.heading)}`,
        this.toHumanMarkdownContent(section.contentMarkdown),
      ]),
      '',
    ]
      .filter((part) => part !== undefined && part !== null && String(part).trim().length > 0)
      .join('\n\n')
  }

  private async renderPdf(
    output: AdvisoryWorkflowOutput,
    generatedAt: string,
  ): Promise<{ buffer: Buffer; contentType: typeof PDF_CONTENT_TYPE }> {
    try {
      return {
        buffer: await this.pdfRenderer.render(this.renderPdfHtml(output, generatedAt)),
        contentType: PDF_CONTENT_TYPE,
      }
    } catch {
      throw new ServiceUnavailableException(EXPORT_FAILED_MESSAGE)
    }
  }

  private renderSectionMetadata(section: AdvisoryWorkflowOutputSection): string {
    const stepLabel =
      this.readText(section.metadata?.step_label) ?? this.readText(section.metadata?.stepLabel)
    const generatedAt =
      this.readText(section.metadata?.generated_at) ?? this.readText(section.metadata?.generatedAt)
    const provider = this.readText(section.metadata?.provider)
    const model = this.readText(section.metadata?.model)
    const parts = [
      stepLabel ? `Step: ${stepLabel}` : null,
      generatedAt ? `Generated at: ${generatedAt}` : null,
      provider ? `Provider: ${provider}` : null,
      model ? `Model: ${model}` : null,
    ].filter(Boolean)

    return parts.length > 0 ? parts.join('\n') : ''
  }

  private renderPdfHtml(output: AdvisoryWorkflowOutput, generatedAt: string): string {
    const sectionsHtml = output.sections
      .map(
        (section) => `
          <section class="section">
            <div class="section-heading">
              <h2>${this.escapeHtml(section.heading)}</h2>
              <span>${this.escapeHtml(section.aiLabel || AI_LABEL)}</span>
            </div>
            <div class="markdown">${this.renderMarkdownHtml(section.contentMarkdown)}</div>
            <p class="section-meta">${this.escapeHtml(this.renderSectionMetadata(section))}</p>
          </section>
        `,
      )
      .join('')

    return `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 18mm 14mm; }
            body {
              margin: 0;
              color: #111827;
              background: #ffffff;
              font-family: ${PDF_FONT_STACK};
            }
            main { display: grid; gap: 18px; }
            header {
              padding-bottom: 16px;
              border-bottom: 1px solid #d1d5db;
            }
            h1 { margin: 0; font-size: 26px; line-height: 1.25; }
            h2 { margin: 0; font-size: 18px; line-height: 1.35; }
            h3, h4 { margin: 10px 0 6px; }
            p { margin: 8px 0; line-height: 1.75; font-size: 13px; }
            ul { margin: 8px 0 8px 20px; padding: 0; }
            li { margin: 4px 0; line-height: 1.65; font-size: 13px; }
            .summary { color: #4b5563; }
            .label-row {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 12px;
              color: #4b5563;
              font-size: 12px;
            }
            .label {
              display: inline-flex;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 4px 8px;
              color: #1f2937;
            }
            .section {
              break-inside: avoid;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 14px 16px;
            }
            .section-heading {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 10px;
            }
            .section-heading span {
              white-space: nowrap;
              font-size: 12px;
              color: #4b5563;
            }
            .section-meta {
              margin-top: 12px;
              border-top: 1px solid #e5e7eb;
              padding-top: 8px;
              color: #6b7280;
              font-size: 11px;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <main>
            <header>
              <h1>${this.escapeHtml(output.title)}</h1>
              ${output.summary ? `<p class="summary">${this.escapeHtml(output.summary)}</p>` : ''}
              <div class="label-row">
                <span class="label">${AI_LABEL}</span>
                <span>Workflow: ${this.escapeHtml(output.workflowKey)}</span>
                <span>Exported at: ${this.escapeHtml(generatedAt)}</span>
              </div>
            </header>
            ${sectionsHtml}
          </main>
        </body>
      </html>
    `
  }

  private renderMarkdownHtml(content: string): string {
    const lines = content.split('\n')
    const blocks: string[] = []
    let index = 0

    while (index < lines.length) {
      const trimmed = lines[index].trim()
      if (!trimmed) {
        index += 1
        continue
      }
      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        const level = Math.min(heading[1].length + 1, 4)
        blocks.push(`<h${level}>${this.escapeHtml(heading[2])}</h${level}>`)
        index += 1
        continue
      }
      if (/^[-*]\s+/.test(trimmed)) {
        const items: string[] = []
        while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
          items.push(`<li>${this.escapeHtml(lines[index].trim().replace(/^[-*]\s+/, ''))}</li>`)
          index += 1
        }
        blocks.push(`<ul>${items.join('')}</ul>`)
        continue
      }
      const paragraphLines: string[] = []
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,3})\s+/.test(lines[index].trim()) &&
        !/^[-*]\s+/.test(lines[index].trim())
      ) {
        paragraphLines.push(lines[index])
        index += 1
      }
      blocks.push(`<p>${this.escapeHtml(paragraphLines.join('\n'))}</p>`)
    }

    return blocks.join('')
  }

  private buildFileName(
    output: AdvisoryWorkflowOutput,
    format: AdvisoryOutputExportFormat,
    generatedAt: string,
  ): string {
    const timestamp = generatedAt.replace(/[-:TZ.]/g, '').slice(0, 14)
    const ext = format === 'markdown' ? 'md' : 'pdf'
    const workflow = this.sanitizeFilePart(output.workflowKey || 'thinktank')

    return `thinktank-report-${workflow}-${timestamp}.${ext}`
  }

  private sanitizeFilePart(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'thinktank'
    )
  }

  private readText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private toMarkdownHeadingText(value: string): string {
    const normalized = value
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const safe = normalized || 'ThinkTank Report'

    return safe.replace(/([\\`*_{}\[\]()#+.!|-])/g, '\\$1')
  }

  private toHumanMarkdownContent(value: string): string {
    const normalized = value.replace(/\r\n?/g, '\n').trim()
    const escapedLabel = AI_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    return normalized.replace(new RegExp(`^${escapedLabel}\\s*`, 'i'), '').trim()
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }
}
