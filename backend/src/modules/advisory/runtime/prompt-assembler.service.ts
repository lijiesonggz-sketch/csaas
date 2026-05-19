import { Injectable } from '@nestjs/common'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import {
  ThinkTankAssembledPrompt,
  ThinkTankPromptAssemblyRequest,
  ThinkTankPromptSourceDescriptor,
  ThinkTankRuntimeFileDescriptor,
} from './runtime.types'
import { ThinkTankWorkflowParserService } from './workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from './workflow-registry.service'

interface PromptSourceRequest {
  sourcePath: string
  validateMethodLibrary?: boolean
}

@Injectable()
export class ThinkTankPromptAssemblerService {
  constructor(
    private readonly fileProvider: ThinkTankRuntimeFileProviderService,
    private readonly brandMapper: ThinkTankBrandMapperService,
    private readonly workflowRegistry: ThinkTankWorkflowRegistryService,
    private readonly workflowParser: ThinkTankWorkflowParserService,
  ) {}

  async assemblePrompt(request: ThinkTankPromptAssemblyRequest): Promise<ThinkTankAssembledPrompt> {
    const workflow = await this.workflowRegistry.findWorkflow(request.workflowKey)

    if (!workflow) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowNotFound,
        'ThinkTank runtime workflow was not found',
        { sourcePath: request.workflowKey },
      )
    }

    const sourceRequests: PromptSourceRequest[] = [
      { sourcePath: workflow.sourcePath },
      { sourcePath: workflow.firstPromptSource },
      ...(request.includeMethodLibraries
        ? workflow.methodLibraryPaths.map((sourcePath) => ({
            sourcePath,
            validateMethodLibrary: true,
          }))
        : []),
      ...(request.includeAgentSources
        ? workflow.agentSourcePaths.map((sourcePath) => ({ sourcePath }))
        : []),
    ]
    const sources = await this.loadUniqueSources(sourceRequests)

    for (const source of sources) {
      if (source.validateMethodLibrary) {
        this.workflowParser.parseMethodLibrary(source.descriptor)
      }
    }

    return {
      workflow,
      visiblePrompt: this.buildVisiblePrompt(
        workflow.displayName,
        sources.map((source) => source.descriptor),
      ),
      sourceRefs: sources.map((source) => source.descriptor.relativePath),
      sources: sources.map((source) => this.toPromptSource(source.descriptor)),
    }
  }

  private buildVisiblePrompt(displayName: string, sources: ThinkTankRuntimeFileDescriptor[]) {
    const sections = [
      `# ThinkTank Runtime Workflow: ${displayName}`,
      '',
      ...sources.flatMap((source) => [
        `## Source: \`${source.relativePath}\``,
        '',
        this.brandMapper.mapVisibleText(source.content),
        '',
      ]),
    ]

    return sections.join('\n').trim()
  }

  private async loadUniqueSources(sourceRequests: PromptSourceRequest[]) {
    const loaded = await Promise.all(
      sourceRequests.map(async (source) => ({
        descriptor: await this.fileProvider.load(source.sourcePath),
        validateMethodLibrary: source.validateMethodLibrary ?? false,
      })),
    )
    const byPath = new Map<
      string,
      { descriptor: ThinkTankRuntimeFileDescriptor; validateMethodLibrary: boolean }
    >()

    for (const source of loaded) {
      const existing = byPath.get(source.descriptor.relativePath)
      if (existing) {
        existing.validateMethodLibrary =
          existing.validateMethodLibrary || source.validateMethodLibrary
      } else {
        byPath.set(source.descriptor.relativePath, source)
      }
    }

    return [...byPath.values()]
  }

  private toPromptSource(source: ThinkTankRuntimeFileDescriptor): ThinkTankPromptSourceDescriptor {
    return {
      relativePath: source.relativePath,
      content: source.content,
      contentHash: source.contentHash,
      extension: source.extension,
      modifiedAt: source.modifiedAt,
    }
  }
}
