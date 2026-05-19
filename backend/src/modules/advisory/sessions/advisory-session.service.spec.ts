import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common'
import { AuditAction } from '../../../database/entities/audit-log.entity'
import {
  AdvisoryWorkflowSession,
  AdvisoryWorkflowSessionStatus,
} from '../../../database/entities/advisory-workflow-session.entity'
import { UserRole } from '../../../database/entities/user.entity'
import { AdvisoryAccessService } from '../access/advisory-access.service'
import { AdvisoryEventService } from '../events/advisory-event.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from '../runtime/runtime.errors'
import { ThinkTankPromptAssemblerService } from '../runtime/prompt-assembler.service'
import { ThinkTankWorkflowRegistryService } from '../runtime/workflow-registry.service'
import { AdvisorySessionRepository } from './advisory-session.repository'
import {
  AdvisorySessionService,
  THINKTANK_WORKFLOW_START_FAILED_MESSAGE,
} from './advisory-session.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const organizationId = '880e8400-e29b-41d4-a716-446655440000'

const workflowKeys = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
]

const user = {
  id: actorId,
  role: UserRole.CONSULTANT,
  organizationId,
}

const createWorkflow = (key: string) => ({
  key,
  displayName: `${key} workflow`,
  scenarioLabel: `${key} scenario`,
  sourcePath: `_bmad/runtime/${key}/workflow.md`,
  supportedFileType: '.md' as const,
  firstPromptSource: `_bmad/runtime/${key}/steps/step-01.md`,
  methodLibraryPaths: [],
  agentSourcePaths: [],
  description: `${key} description`,
})

const createAssembledPrompt = (key: string) => {
  const workflow = createWorkflow(key)

  return {
    workflow,
    visiblePrompt: [
      `# ThinkTank Runtime Workflow: ${workflow.displayName}`,
      '',
      `## Source: \`${workflow.sourcePath}\``,
      '',
      '# workflow',
      '',
      `## Source: \`${workflow.firstPromptSource}\``,
      '',
      `Start ${key} safely.`,
      '',
      '## Source: `_bmad/internal/agent.md`',
      '',
      'Internal agent instructions.',
    ].join('\n'),
    sourceRefs: [workflow.sourcePath, workflow.firstPromptSource],
    sources: [
      {
        relativePath: workflow.sourcePath,
        content: '# workflow',
        contentHash: `${key}-workflow-hash`,
        extension: '.md' as const,
        modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
      {
        relativePath: workflow.firstPromptSource,
        content: `Start ${key} safely.`,
        contentHash: `${key}-step-hash`,
        extension: '.md' as const,
        modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
    ],
  }
}

describe('AdvisorySessionService', () => {
  let accessService: jest.Mocked<Pick<AdvisoryAccessService, 'assertThinkTankModuleAvailable'>>
  let registry: jest.Mocked<
    Pick<ThinkTankWorkflowRegistryService, 'discoverWorkflows' | 'findWorkflow'>
  >
  let assembler: jest.Mocked<Pick<ThinkTankPromptAssemblerService, 'assemblePrompt'>>
  let repository: jest.Mocked<
    Pick<AdvisorySessionRepository, 'createLaunchSession' | 'findActiveSessionForActor'>
  >
  let eventService: jest.Mocked<Pick<AdvisoryEventService, 'emitAudit'>>
  let service: AdvisorySessionService

  beforeEach(() => {
    accessService = {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    }
    registry = {
      discoverWorkflows: jest.fn().mockResolvedValue(workflowKeys.map(createWorkflow)),
      findWorkflow: jest.fn(async (key: string) => createWorkflow(key)),
    }
    assembler = {
      assemblePrompt: jest.fn(async ({ workflowKey }) => createAssembledPrompt(workflowKey)),
    }
    repository = {
      findActiveSessionForActor: jest.fn().mockResolvedValue(null),
      createLaunchSession: jest.fn(
        async (_tenant, input) =>
          ({
            id: `session-${input.workflowKey}`,
            tenantId,
            actorId,
            workflowKey: input.workflowKey,
            workflowDisplayName: input.workflowDisplayName,
            scenarioLabel: input.scenarioLabel,
            status: input.status ?? AdvisoryWorkflowSessionStatus.Active,
            currentStep: input.currentStep,
            sourceRefs: input.sourceRefs,
            metadata: input.metadata,
            failureCode: null,
            failureMessage: null,
            createdAt: new Date('2026-05-20T00:00:00.000Z'),
            updatedAt: new Date('2026-05-20T00:00:00.000Z'),
          }) as AdvisoryWorkflowSession,
      ),
    }
    eventService = {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    }

    service = new AdvisorySessionService(
      accessService as never,
      registry as never,
      assembler as never,
      repository as never,
      eventService as never,
    )
  })

  it('lists the eight MVP workflows from the runtime registry after access is checked', async () => {
    const result = await service.listWorkflows({ user, tenantId })

    expect(accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(user, tenantId)
    expect(result.workflows.map((workflow) => workflow.key)).toEqual(workflowKeys)
    expect(result.workflows).toHaveLength(8)
    expect(result.workflows[0]).toEqual(
      expect.objectContaining({
        key: 'brainstorming',
        displayName: 'brainstorming workflow',
        scenarioLabel: 'brainstorming scenario',
        canonicalName: 'brainstorming workflow',
      }),
    )
  })

  it('rejects an incomplete runtime workflow catalog instead of returning a partial list', async () => {
    registry.discoverWorkflows.mockResolvedValueOnce(workflowKeys.slice(0, 7).map(createWorkflow))

    await expect(service.listWorkflows({ user, tenantId })).rejects.toThrow(
      ServiceUnavailableException,
    )
  })

  it.each(workflowKeys)(
    'launches %s through the shared runtime assembler, session repository, and started audit path',
    async (workflowKey) => {
      const result = await service.launchWorkflow({ user, tenantId, workflowKey })

      expect(registry.findWorkflow).toHaveBeenCalledWith(workflowKey)
      expect(repository.findActiveSessionForActor).toHaveBeenCalledWith(tenantId, actorId)
      expect(assembler.assemblePrompt).toHaveBeenCalledWith({
        workflowKey,
        includeMethodLibraries: true,
        includeAgentSources: true,
      })
      expect(repository.createLaunchSession).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          actorId,
          workflowKey,
          workflowDisplayName: `${workflowKey} workflow`,
          scenarioLabel: `${workflowKey} scenario`,
          status: 'active',
          currentStep: {
            index: 1,
            label: '当前步骤',
            sourceRef: 'current-step:1',
          },
          sourceRefs: [
            `_bmad/runtime/${workflowKey}/workflow.md`,
            `_bmad/runtime/${workflowKey}/steps/step-01.md`,
          ],
        }),
      )
      expect(eventService.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: ThinkTankEventName.WorkflowStarted,
          tenantId,
          actorId,
          subjectType: ThinkTankSubjectType.Session,
          subjectId: `session-${workflowKey}`,
          outcome: ThinkTankEventOutcome.Success,
          privacyClassification: ThinkTankPrivacyClassification.Operational,
          optional: {
            sessionId: `session-${workflowKey}`,
            workflowType: workflowKey,
          },
          audit: expect.objectContaining({
            action: AuditAction.CREATE,
            entityType: 'ThinkTankWorkflowSession',
            entityId: `session-${workflowKey}`,
            organizationId,
          }),
          metadata: expect.objectContaining({
            workflow_key: workflowKey,
            source_ref_count: 2,
          }),
        }),
      )
      expect(JSON.stringify(eventService.emitAudit.mock.calls.at(-1))).not.toMatch(
        /visiblePrompt|prompt|content|messages|conversation|report|document/i,
      )
      expect(result).toEqual(
        expect.objectContaining({
          sessionId: `session-${workflowKey}`,
          status: 'active',
          firstPrompt: `Start ${workflowKey} safely.`,
          sourceRefs: [`workflow:${workflowKey}`, 'current-step:1'],
          currentStep: {
            index: 1,
            label: '当前步骤',
            sourceRef: 'current-step:1',
          },
        }),
      )
      expect(result.firstPrompt).not.toMatch(/## Source|_bmad|Internal agent instructions/i)
      expect(result.sourceRefs.join(' ')).not.toMatch(/_bmad|\//)
    },
  )

  it('does not convert successful launches into failures when started audit emission fails', async () => {
    eventService.emitAudit.mockRejectedValueOnce(new Error('audit store unavailable'))

    const result = await service.launchWorkflow({ user, tenantId, workflowKey: 'brainstorming' })

    expect(result.sessionId).toBe('session-brainstorming')
    expect(repository.createLaunchSession).toHaveBeenCalledTimes(1)
    expect(eventService.emitAudit).toHaveBeenCalledTimes(1)
    expect(eventService.emitAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.WorkflowStartFailed,
      }),
    )
  })

  it('rejects duplicate launches while the actor already has an active workflow session', async () => {
    repository.findActiveSessionForActor.mockResolvedValueOnce({
      id: 'session-existing',
      tenantId,
      actorId,
      workflowKey: 'brainstorming',
      workflowDisplayName: 'Brainstorming',
      scenarioLabel: 'Creative ideation',
      status: AdvisoryWorkflowSessionStatus.Active,
      currentStep: { index: 1, label: '当前步骤', sourceRef: 'current-step:1' },
      sourceRefs: [],
      metadata: {},
      failureCode: null,
      failureMessage: null,
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
      updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    })

    await expect(
      service.launchWorkflow({ user, tenantId, workflowKey: 'market-research' }),
    ).rejects.toThrow(ConflictException)

    expect(assembler.assemblePrompt).not.toHaveBeenCalled()
    expect(repository.createLaunchSession).not.toHaveBeenCalled()
  })

  it('emits start_failed and does not create a session when runtime assembly fails', async () => {
    registry.findWorkflow.mockResolvedValueOnce(createWorkflow('brainstorming'))
    assembler.assemblePrompt.mockRejectedValueOnce(
      new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.WorkflowMalformed,
        'Workflow manifest CSV is malformed',
        { sourcePath: '_bmad/_config/thinktank-runtime-workflows.csv' },
      ),
    )

    const launch = service.launchWorkflow({ user, tenantId, workflowKey: 'brainstorming' })

    await expect(launch).rejects.toThrow(ServiceUnavailableException)
    await expect(launch).rejects.toThrow(THINKTANK_WORKFLOW_START_FAILED_MESSAGE)

    expect(repository.createLaunchSession).not.toHaveBeenCalled()
    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.WorkflowStartFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.Workflow,
        subjectId: 'brainstorming',
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        optional: {
          workflowType: 'brainstorming',
        },
        metadata: expect.objectContaining({
          workflow_key: 'brainstorming',
          runtime_error_code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
        }),
      }),
    )
    expect(JSON.stringify(eventService.emitAudit.mock.calls.at(-1))).not.toMatch(
      /visiblePrompt|prompt|content|messages|conversation|report|document/i,
    )
  })

  it('emits start_failed and returns a bad request for blank workflow keys', async () => {
    await expect(service.launchWorkflow({ user, tenantId, workflowKey: '   ' })).rejects.toThrow(
      BadRequestException,
    )

    expect(eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.WorkflowStartFailed,
        subjectId: 'invalid-workflow',
        metadata: expect.objectContaining({
          workflow_key: 'invalid-workflow',
          runtime_error_code: ThinkTankRuntimeErrorCode.InvalidWorkflowKey,
        }),
      }),
    )
    expect(repository.createLaunchSession).not.toHaveBeenCalled()
  })
})
