import { dirname, join, normalize } from 'node:path/posix'
import { Injectable } from '@nestjs/common'
import * as matter from 'gray-matter'
import * as Papa from 'papaparse'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import {
  ThinkTankParsedMethodLibrary,
  ThinkTankParsedWorkflowDefinition,
  ThinkTankRuntimeFileDescriptor,
} from './runtime.types'

type ParsedWorkflowFields = Record<string, unknown>

@Injectable()
export class ThinkTankWorkflowParserService {
  parseWorkflow(descriptor: ThinkTankRuntimeFileDescriptor): ThinkTankParsedWorkflowDefinition {
    if (descriptor.extension === '.md') {
      return this.parseMarkdownWorkflow(descriptor)
    }

    if (descriptor.extension === '.yaml' || descriptor.extension === '.yml') {
      return this.parseYamlWorkflow(descriptor)
    }

    if (descriptor.extension === '.csv') {
      return this.parseCsvWorkflow(descriptor)
    }

    throw new ThinkTankRuntimeError(
      ThinkTankRuntimeErrorCode.UnsupportedExtension,
      'Workflow definitions must be Markdown, YAML, or CSV files',
      { sourcePath: descriptor.relativePath, details: { extension: descriptor.extension } },
    )
  }

  parseMethodLibrary(descriptor: ThinkTankRuntimeFileDescriptor): ThinkTankParsedMethodLibrary {
    if (descriptor.extension !== '.csv') {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.UnsupportedExtension,
        'Method libraries must be CSV files',
        { sourcePath: descriptor.relativePath, details: { extension: descriptor.extension } },
      )
    }

    const parsed = this.parseCsvRows(descriptor, 'Method library CSV is malformed')
    const headers = (parsed.meta.fields ?? [])
      .map((field) => field.trim())
      .filter((field) => field.length > 0)

    if (headers.length === 0 || parsed.data.length === 0) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Method library CSV must include headers and at least one row',
        { sourcePath: descriptor.relativePath },
      )
    }

    return {
      headers,
      rowCount: parsed.data.length,
    }
  }

  private parseMarkdownWorkflow(
    descriptor: ThinkTankRuntimeFileDescriptor,
  ): ThinkTankParsedWorkflowDefinition {
    const { data: frontmatter, content: body } = this.parseMarkdownMatter(descriptor)
    const title = this.asString(frontmatter.title) ?? body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
    const description =
      this.asString(frontmatter.description) ??
      body.match(/\*\*Goal:\*\*\s*(.+?)\s*$/m)?.[1]?.trim() ??
      body.match(/^description:\s*['"]?(.+?)['"]?\s*$/m)?.[1]?.trim()

    if (!title) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow Markdown is missing a title',
        { sourcePath: descriptor.relativePath },
      )
    }

    return {
      title,
      description,
      firstPromptSource: this.resolveFirstPromptSource(
        descriptor.relativePath,
        this.asString(frontmatter.firstPromptSource) ??
          this.asString(frontmatter.first_prompt_source) ??
          this.extractFirstPromptReference(body),
      ),
    }
  }

  private parseYamlWorkflow(
    descriptor: ThinkTankRuntimeFileDescriptor,
  ): ThinkTankParsedWorkflowDefinition {
    const fields = this.parseYamlFields(descriptor)
    const title =
      this.asString(fields.title) ?? this.asString(fields.displayName) ?? this.asString(fields.name)

    if (!title) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow YAML is missing a name or title',
        { sourcePath: descriptor.relativePath },
      )
    }

    return {
      title,
      description: this.asString(fields.description),
      firstPromptSource: this.resolveFirstPromptSource(
        descriptor.relativePath,
        this.asString(fields.firstPromptSource) ?? this.asString(fields.first_prompt_source),
      ),
    }
  }

  private parseCsvWorkflow(
    descriptor: ThinkTankRuntimeFileDescriptor,
  ): ThinkTankParsedWorkflowDefinition {
    const parsed = this.parseCsvRows(descriptor, 'Workflow CSV is malformed')

    const row = parsed.data[0]
    const title =
      this.asString(row?.title) ?? this.asString(row?.displayName) ?? this.asString(row?.name)

    if (!title) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow CSV is missing a title, displayName, or name column',
        { sourcePath: descriptor.relativePath },
      )
    }

    return {
      title,
      description: this.asString(row.description),
      firstPromptSource: this.resolveFirstPromptSource(
        descriptor.relativePath,
        this.asString(row.firstPromptSource) ?? this.asString(row.first_prompt_source),
      ),
    }
  }

  private parseCsvRows(descriptor: ThinkTankRuntimeFileDescriptor, errorMessage: string) {
    const parsed = Papa.parse<Record<string, string>>(descriptor.content, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      throw new ThinkTankRuntimeError(ThinkTankRuntimeErrorCode.WorkflowMalformed, errorMessage, {
        sourcePath: descriptor.relativePath,
        details: { errors: parsed.errors.map((error) => error.message) },
      })
    }

    return parsed
  }

  private parseMarkdownMatter(descriptor: ThinkTankRuntimeFileDescriptor) {
    try {
      return matter(descriptor.content)
    } catch (error) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow Markdown frontmatter is malformed',
        { sourcePath: descriptor.relativePath, cause: error },
      )
    }
  }

  private parseYamlFields(descriptor: ThinkTankRuntimeFileDescriptor): ParsedWorkflowFields {
    try {
      return matter(`---\n${descriptor.content}\n---\n`).data
    } catch (error) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow YAML is malformed',
        { sourcePath: descriptor.relativePath, cause: error },
      )
    }
  }

  private extractFirstPromptReference(content: string): string | undefined {
    const patterns = [
      /Read fully and follow:\s*`?([^`\r\n]+?\.md)`?/i,
      /Load:\s*`?([^`\r\n]+?\.md)`?/i,
      /Load next step:\s*`?([^`\r\n]+?\.md)`?/i,
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)?.[1]?.trim()
      if (match && !match.includes('{')) {
        return match
      }
    }

    return undefined
  }

  private resolveFirstPromptSource(workflowPath: string, promptReference?: string) {
    if (!promptReference) {
      return workflowPath
    }

    if (promptReference.startsWith('_bmad/')) {
      return normalize(promptReference)
    }

    return normalize(join(dirname(workflowPath), promptReference))
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }
}
