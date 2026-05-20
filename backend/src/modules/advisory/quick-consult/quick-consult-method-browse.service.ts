import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import { AdvisoryAccessService, AdvisoryAccessUser } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { ThinkTankRuntimeFileProviderService } from '../runtime/runtime-file-provider.service'
import { ThinkTankWorkflowMetadata } from '../runtime/runtime.types'
import { ThinkTankWorkflowParserService } from '../runtime/workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { QuickConsultContextRepository } from './quick-consult.repository'

export type QuickConsultMethodCatalogStatus = 'available' | 'degraded'
export type QuickConsultManualChoiceKind = 'workflow' | 'method'

export interface QuickConsultManualBrowseWorkflow {
  workflowKey: string
  displayName: string
  scenarioLabel: string
  description?: string
  expectedDuration?: string
  sourceRefs: string[]
}

export interface QuickConsultManualMethodChoice {
  id: string
  workflowKey: string
  methodName: string
  category?: string
  phase?: string
  description?: string
}

export interface QuickConsultManualBrowseCatalog {
  workflows: QuickConsultManualBrowseWorkflow[]
  methodChoices: QuickConsultManualMethodChoice[]
  methodCatalogStatus: QuickConsultMethodCatalogStatus
  recoverableMessage?: string
}

export interface QuickConsultManualBrowseRequest {
  user: AdvisoryAccessUser
  tenantId: string
  quickConsultContextId?: string
  correlationId?: string
}

const EXPECTED_THINKTANK_WORKFLOW_KEYS = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
] as const

const METHOD_LIBRARY_RECOVERABLE_MESSAGE = '方法库暂时不可用，仍可直接启动工作流。'
const THINKTANK_WORKFLOW_CATALOG_UNAVAILABLE_MESSAGE =
  '暂时无法加载 ThinkTank 工作流目录，请稍后重试。'

@Injectable()
export class QuickConsultMethodBrowseService {
  constructor(
    private readonly accessService: AdvisoryAccessService,
    private readonly workflowRegistry: ThinkTankWorkflowRegistryService,
    private readonly fileProvider: ThinkTankRuntimeFileProviderService,
    private readonly workflowParser: ThinkTankWorkflowParserService,
    private readonly eventService: AdvisoryEventService,
    @Optional()
    private readonly quickConsultContextRepository?: QuickConsultContextRepository,
  ) {}

  async listManualBrowseCatalog(
    request: QuickConsultManualBrowseRequest,
  ): Promise<QuickConsultManualBrowseCatalog> {
    await this.accessService.assertThinkTankModuleAvailable(request.user, request.tenantId)

    const workflows = await this.workflowRegistry.discoverWorkflows()
    this.assertCompleteWorkflowCatalog(workflows)
    const browseWorkflows = workflows.map((workflow) => this.toBrowseWorkflow(workflow))
    const ownedQuickConsultContextId = await this.resolveOwnedQuickConsultContextId(request)

    try {
      const methodChoices = await this.loadMethodChoices(workflows)

      return {
        workflows: browseWorkflows,
        methodChoices,
        methodCatalogStatus: 'available',
      }
    } catch {
      await this.emitMethodBrowseFailed({
        request,
        workflowCount: browseWorkflows.length,
        ownedQuickConsultContextId,
      })

      return {
        workflows: browseWorkflows,
        methodChoices: [],
        methodCatalogStatus: 'degraded',
        recoverableMessage: METHOD_LIBRARY_RECOVERABLE_MESSAGE,
      }
    }
  }

  private async loadMethodChoices(
    workflows: ThinkTankWorkflowMetadata[],
  ): Promise<QuickConsultManualMethodChoice[]> {
    const choices: QuickConsultManualMethodChoice[] = []

    for (const workflow of workflows) {
      let workflowMethodIndex = 0

      for (const methodLibraryPath of workflow.methodLibraryPaths) {
        const descriptor = await this.fileProvider.load(methodLibraryPath)
        const methodLibrary = this.workflowParser.parseMethodLibrary(descriptor)

        for (const row of methodLibrary.rows) {
          const methodName = this.readMethodName(row)
          if (!methodName) continue
          workflowMethodIndex += 1

          choices.push({
            id: `method:${workflow.key}:${slugifyMethodName(methodName)}-${workflowMethodIndex}`,
            workflowKey: workflow.key,
            methodName,
            ...this.optionalField('category', this.readText(row.category)),
            ...this.optionalField('phase', this.readText(row.phase)),
            ...this.optionalField('description', this.readText(row.description)),
          })
        }
      }
    }

    return choices
  }

  private toBrowseWorkflow(workflow: ThinkTankWorkflowMetadata): QuickConsultManualBrowseWorkflow {
    return {
      workflowKey: workflow.key,
      displayName: workflow.displayName,
      scenarioLabel: workflow.scenarioLabel,
      description: workflow.description,
      sourceRefs: [`workflow:${workflow.key}`],
    }
  }

  private assertCompleteWorkflowCatalog(workflows: ThinkTankWorkflowMetadata[]): void {
    const keys = new Set(workflows.map((workflow) => workflow.key))

    if (
      workflows.length !== EXPECTED_THINKTANK_WORKFLOW_KEYS.length ||
      !EXPECTED_THINKTANK_WORKFLOW_KEYS.every((key) => keys.has(key))
    ) {
      throw new ServiceUnavailableException(THINKTANK_WORKFLOW_CATALOG_UNAVAILABLE_MESSAGE)
    }
  }

  private readMethodName(row: Record<string, string>): string | undefined {
    return (
      this.readText(row.technique_name) ?? this.readText(row.method_name) ?? this.readText(row.name)
    )
  }

  private readText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  private optionalField<T extends string>(
    key: T,
    value: string | undefined,
  ): Partial<Record<T, string>> {
    return value ? ({ [key]: value } as Partial<Record<T, string>>) : {}
  }

  private async emitMethodBrowseFailed(context: {
    request: QuickConsultManualBrowseRequest
    workflowCount: number
    ownedQuickConsultContextId?: string
  }): Promise<void> {
    const subjectId = context.ownedQuickConsultContextId ?? 'quick-consult-manual-browse'

    await this.eventService
      .emitAudit({
        eventName: ThinkTankEventName.MethodBrowseFailed,
        tenantId: context.request.tenantId,
        actorId: context.request.user.id,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId,
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        correlationId: this.readText(context.request.correlationId) ?? undefined,
        audit: {
          action: AuditAction.READ,
          entityType: 'ThinkTankQuickConsultMethodBrowse',
          entityId: subjectId,
          organizationId: context.request.user.organizationId ?? null,
        },
        metadata: {
          workflow_key_count: context.workflowCount,
          expected_workflow_key_count: EXPECTED_THINKTANK_WORKFLOW_KEYS.length,
          method_count: 0,
          failure_category: 'method_library_parse_failed',
          runtime_status: 'degraded',
        },
      })
      .catch(() => undefined)
  }

  private async resolveOwnedQuickConsultContextId(
    request: QuickConsultManualBrowseRequest,
  ): Promise<string | undefined> {
    const contextId = this.readText(request.quickConsultContextId)
    if (!contextId || !this.quickConsultContextRepository) return undefined

    const quickConsultContext = await this.quickConsultContextRepository
      .findContextForActor(request.tenantId, contextId, request.user.id)
      .catch(() => null)

    return quickConsultContext?.id
  }
}

function slugifyMethodName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'method'
}
