import { Inject, Injectable, Optional } from '@nestjs/common'
import * as Papa from 'papaparse'
import { THINKTANK_WORKFLOW_REGISTRY_OPTIONS } from './runtime.constants'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import {
  ThinkTankWorkflowMetadata,
  ThinkTankWorkflowRegistryOptions,
  ThinkTankWorkflowSourceConfig,
} from './runtime.types'
import { ThinkTankWorkflowParserService } from './workflow-parser.service'

type CsvManifestRow = Record<string, string>

const DEFAULT_MANIFEST_PATHS = [
  '_bmad/_config/thinktank-runtime-workflows.csv',
  '_bmad/_config/skill-manifest.csv',
  '_bmad/_config/workflow-manifest.csv',
]

const THINKTANK_RUNTIME_WORKFLOW_KEYS = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
]

const WORKFLOW_METADATA_OVERRIDES: Record<
  string,
  Partial<
    Pick<ThinkTankWorkflowSourceConfig, 'scenarioLabel' | 'methodLibraryPaths' | 'agentSourcePaths'>
  >
> = {
  brainstorming: {
    scenarioLabel: 'Creative ideation and divergent thinking',
    methodLibraryPaths: ['_bmad/core/skills/bmad-brainstorming/brain-methods.csv'],
    agentSourcePaths: ['_bmad/cis/agents/brainstorming-coach.md'],
  },
  'domain-research': {
    scenarioLabel: 'Domain and industry research',
    agentSourcePaths: ['_bmad/bmm/agents/analyst.md'],
  },
  'market-research': {
    scenarioLabel: 'Market, competitor, and customer research',
    agentSourcePaths: ['_bmad/bmm/agents/analyst.md'],
  },
  'product-brief': {
    scenarioLabel: 'Product opportunity framing',
    agentSourcePaths: ['_bmad/bmm/agents/analyst.md'],
  },
  prd: {
    scenarioLabel: 'Product requirements definition',
    agentSourcePaths: ['_bmad/bmm/agents/pm.md'],
  },
  'problem-solving': {
    scenarioLabel: 'Systematic diagnosis and solution design',
    methodLibraryPaths: ['_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv'],
    agentSourcePaths: ['_bmad/cis/agents/creative-problem-solver.md'],
  },
  'design-thinking': {
    scenarioLabel: 'Human-centered discovery and solution framing',
    methodLibraryPaths: ['_bmad/cis/workflows/bmad-cis-design-thinking/design-methods.csv'],
    agentSourcePaths: ['_bmad/cis/agents/design-thinking-coach.md'],
  },
  storytelling: {
    scenarioLabel: 'Narrative framing and communication',
    methodLibraryPaths: ['_bmad/cis/workflows/bmad-cis-storytelling/story-types.csv'],
    agentSourcePaths: ['_bmad/cis/agents/storyteller/storyteller.md'],
  },
}

@Injectable()
export class ThinkTankWorkflowRegistryService {
  constructor(
    private readonly fileProvider: ThinkTankRuntimeFileProviderService,
    private readonly brandMapper: ThinkTankBrandMapperService,
    private readonly workflowParser: ThinkTankWorkflowParserService,
    @Optional()
    @Inject(THINKTANK_WORKFLOW_REGISTRY_OPTIONS)
    private readonly options?: ThinkTankWorkflowRegistryOptions,
  ) {}

  async discoverWorkflows(): Promise<ThinkTankWorkflowMetadata[]> {
    const sources = await this.resolveSources()
    const workflows = await Promise.all(sources.map((source) => this.toWorkflowMetadata(source)))

    this.assertUniqueWorkflowKeys(workflows)

    return workflows.sort((left, right) => left.key.localeCompare(right.key))
  }

  async findWorkflow(key: string): Promise<ThinkTankWorkflowMetadata | null> {
    const normalizedKey = this.normalizeKey(key)
    const workflows = await this.discoverWorkflows()

    return workflows.find((workflow) => workflow.key === normalizedKey) ?? null
  }

  private async resolveSources(): Promise<ThinkTankWorkflowSourceConfig[]> {
    if (this.options?.workflowSources?.length) {
      return this.options.workflowSources
    }

    if (this.options?.workflowSourcePaths?.length) {
      return this.options.workflowSourcePaths.map((sourcePath) => ({ sourcePath }))
    }

    const sources = [
      ...(await this.loadSourcesFromManifests()),
      ...(await this.loadExplicitRuntimeWorkflowFiles()),
    ]

    return this.deduplicateSourcesByPath(sources).map((source) =>
      this.applyMetadataOverrides(source),
    )
  }

  private async toWorkflowMetadata(
    source: ThinkTankWorkflowSourceConfig,
  ): Promise<ThinkTankWorkflowMetadata> {
    const descriptor = await this.fileProvider.load(source.sourcePath)
    const parsed = this.workflowParser.parseWorkflow(descriptor)
    const key = this.normalizeKey(
      source.key ?? this.inferKeyFromSourcePath(descriptor.relativePath),
    )
    const displayName = this.brandMapper.mapVisibleText(
      this.asString(source.displayName) ?? parsed.title,
    )
    const description = this.asString(source.description) ?? parsed.description

    if (!displayName) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Runtime workflow is missing a title',
        { sourcePath: descriptor.relativePath },
      )
    }

    return {
      key,
      displayName,
      scenarioLabel: this.brandMapper.mapVisibleText(
        this.asString(source.scenarioLabel) ?? description ?? displayName,
      ),
      sourcePath: descriptor.relativePath,
      supportedFileType: descriptor.extension,
      firstPromptSource: this.asString(source.firstPromptSource) ?? parsed.firstPromptSource,
      methodLibraryPaths:
        source.methodLibraryPaths ?? (await this.inferMethodLibraryPaths(descriptor.relativePath)),
      agentSourcePaths: source.agentSourcePaths ?? [],
      description: description ? this.brandMapper.mapVisibleText(description) : undefined,
    }
  }

  private inferKeyFromSourcePath(sourcePath: string): string {
    const parent = sourcePath.split('/').at(-2) ?? sourcePath
    return this.stripWorkflowKeyPrefixes(parent)
  }

  private async inferMethodLibraryPaths(sourcePath: string): Promise<string[]> {
    const baseDir = sourcePath.replace(/\/[^/]+$/, '')
    return (await this.fileProvider.listCsvFiles(baseDir)).filter(
      (candidate) => candidate !== sourcePath,
    )
  }

  private normalizeKey(key: unknown): string {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.InvalidWorkflowKey,
        'ThinkTank workflow key must be a non-empty string',
      )
    }

    return this.stripWorkflowKeyPrefixes(
      key
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-'),
    )
  }

  private stripWorkflowKeyPrefixes(key: string) {
    return key
      .replace(/^bmad-cis-/, '')
      .replace(/^bmad-create-/, '')
      .replace(/^bmad-/, '')
      .replace(/^bmm-/, '')
  }

  private async loadSourcesFromManifests(): Promise<ThinkTankWorkflowSourceConfig[]> {
    const sources: ThinkTankWorkflowSourceConfig[] = []

    for (const manifestPath of this.options?.manifestPaths ?? DEFAULT_MANIFEST_PATHS) {
      const rows = await this.loadCsvRows(manifestPath)
      for (const row of rows) {
        const source = this.toSourceFromManifestRow(row, manifestPath)
        if (source && (await this.fileProvider.exists(source.sourcePath))) {
          sources.push(source)
        }
      }
    }

    return sources
  }

  private async loadCsvRows(sourcePath: string): Promise<CsvManifestRow[]> {
    try {
      const descriptor = await this.fileProvider.load(sourcePath)
      const parsed = Papa.parse<CsvManifestRow>(descriptor.content, {
        header: true,
        skipEmptyLines: true,
      })

      if (parsed.errors.length > 0) {
        throw new ThinkTankRuntimeError(
          ThinkTankRuntimeErrorCode.WorkflowMalformed,
          'Workflow manifest CSV is malformed',
          { sourcePath, details: { errors: parsed.errors.map((error) => error.message) } },
        )
      }

      if (
        parsed.meta.fields &&
        parsed.meta.fields.length > 0 &&
        !parsed.meta.fields.includes('path')
      ) {
        throw new ThinkTankRuntimeError(
          ThinkTankRuntimeErrorCode.WorkflowMalformed,
          'Workflow manifest CSV is missing required path header',
          { sourcePath, details: { fields: parsed.meta.fields } },
        )
      }

      return parsed.data
    } catch (error) {
      if (
        error instanceof ThinkTankRuntimeError &&
        error.code === ThinkTankRuntimeErrorCode.FileNotFound
      ) {
        return []
      }

      throw error
    }
  }

  private toSourceFromManifestRow(
    row: CsvManifestRow,
    manifestSourcePath: string,
  ): ThinkTankWorkflowSourceConfig | null {
    const manifestPathValue = this.rowString(row, 'path') ?? this.rowString(row, 'sourcePath')
    if (!manifestPathValue) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow manifest row is missing a path value',
        { sourcePath: manifestSourcePath, details: { row } },
      )
    }

    const workflowPath = manifestPathValue
      .replace(/^bmad\//, '_bmad/')
      .replace(/^([^_])/, '_bmad/$1')
      .replace(/\/SKILL\.md$/i, '/workflow.md')

    if (!this.isApprovedWorkflowCandidate(workflowPath)) {
      return null
    }

    const key = this.normalizeKey(
      this.rowString(row, 'key') ??
        this.rowString(row, 'canonicalId') ??
        this.rowString(row, 'name') ??
        this.rowString(row, 'displayName'),
    )
    if (!this.isRuntimeCatalog(manifestSourcePath) && !this.isThinkTankRuntimeWorkflowKey(key)) {
      return null
    }

    return this.applyMetadataOverrides({
      key,
      displayName: this.rowString(row, 'displayName') ?? this.rowString(row, 'title'),
      description: this.rowString(row, 'description'),
      scenarioLabel: this.rowString(row, 'scenarioLabel'),
      sourcePath: workflowPath,
      firstPromptSource:
        this.rowString(row, 'firstPromptSource') ?? this.rowString(row, 'first_prompt_source'),
      methodLibraryPaths: this.splitPathList(this.rowString(row, 'methodLibraryPaths')),
      agentSourcePaths: this.splitPathList(this.rowString(row, 'agentSourcePaths')),
    })
  }

  private isApprovedWorkflowCandidate(sourcePath: string): boolean {
    return (
      /\/workflow\.(md|yaml|yml|csv)$/.test(sourcePath) &&
      (sourcePath.startsWith('_bmad/core/skills/') ||
        sourcePath.startsWith('_bmad/core/tasks/') ||
        sourcePath.startsWith('_bmad/cis/workflows/') ||
        sourcePath.startsWith('_bmad/bmm/workflows/'))
    )
  }

  private applyMetadataOverrides(
    source: ThinkTankWorkflowSourceConfig,
  ): ThinkTankWorkflowSourceConfig {
    const key = this.normalizeKey(source.key ?? this.inferKeyFromSourcePath(source.sourcePath))
    const overrides = WORKFLOW_METADATA_OVERRIDES[key] ?? {}

    return {
      ...source,
      key,
      scenarioLabel: source.scenarioLabel ?? overrides.scenarioLabel,
      methodLibraryPaths:
        source.methodLibraryPaths && source.methodLibraryPaths.length > 0
          ? source.methodLibraryPaths
          : overrides.methodLibraryPaths,
      agentSourcePaths:
        source.agentSourcePaths && source.agentSourcePaths.length > 0
          ? source.agentSourcePaths
          : overrides.agentSourcePaths,
    }
  }

  private deduplicateSourcesByPath(sources: ThinkTankWorkflowSourceConfig[]) {
    const byPath = new Map<string, ThinkTankWorkflowSourceConfig>()

    for (const source of sources) {
      if (!byPath.has(source.sourcePath)) {
        byPath.set(source.sourcePath, source)
      }
    }

    return [...byPath.values()]
  }

  private assertUniqueWorkflowKeys(workflows: ThinkTankWorkflowMetadata[]) {
    const seen = new Map<string, string>()

    for (const workflow of workflows) {
      const existingSource = seen.get(workflow.key)
      if (existingSource) {
        throw new ThinkTankRuntimeError(
          ThinkTankRuntimeErrorCode.WorkflowMalformed,
          `Duplicate ThinkTank workflow key: ${workflow.key}`,
          {
            sourcePath: workflow.sourcePath,
            details: {
              duplicateKey: workflow.key,
              existingSource,
            },
          },
        )
      }

      seen.set(workflow.key, workflow.sourcePath)
    }
  }

  private async loadExplicitRuntimeWorkflowFiles(): Promise<ThinkTankWorkflowSourceConfig[]> {
    return (await this.fileProvider.listWorkflowFiles())
      .map((sourcePath) => ({
        key: this.inferKeyFromSourcePath(sourcePath),
        sourcePath,
      }))
      .filter((source) => this.isThinkTankRuntimeWorkflowKey(source.key))
  }

  private isThinkTankRuntimeWorkflowKey(key: string): boolean {
    return THINKTANK_RUNTIME_WORKFLOW_KEYS.includes(key)
  }

  private isRuntimeCatalog(manifestSourcePath: string) {
    return manifestSourcePath.endsWith('/thinktank-runtime-workflows.csv')
  }

  private splitPathList(value?: string): string[] | undefined {
    const paths = value
      ?.split(/[;|]/)
      .map((path) => path.trim())
      .filter(Boolean)

    return paths && paths.length > 0 ? paths : undefined
  }

  private rowString(row: CsvManifestRow, field: string): string | undefined {
    return this.asString(row[field])
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }
}
