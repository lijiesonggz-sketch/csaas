import { QuickConsultMethodBrowseService } from './quick-consult-method-browse.service'
import {
  ThinkTankEventName,
  ThinkTankEventOutcome,
  ThinkTankPrivacyClassification,
  ThinkTankSubjectType,
} from '../events/thinktank-event-contract'
import { ThinkTankWorkflowParserService } from '../runtime/workflow-parser.service'

const tenantId = '660e8400-e29b-41d4-a716-446655440000'
const actorId = '770e8400-e29b-41d4-a716-446655440000'
const user = {
  id: actorId,
  organizationId: '880e8400-e29b-41d4-a716-446655440000',
  role: 'consultant',
}

const createWorkflow = (key: string, methodLibraryPaths: string[] = []) => ({
  key,
  displayName: `${key} workflow`,
  scenarioLabel: `${key} scenario label`,
  sourcePath: `_bmad/runtime/${key}/workflow.md`,
  supportedFileType: '.md' as const,
  firstPromptSource: `_bmad/runtime/${key}/steps/step-01.md`,
  methodLibraryPaths,
  agentSourcePaths: [],
  description: `${key} description`,
})

const workflows = [
  createWorkflow('brainstorming', ['_bmad/core/skills/bmad-brainstorming/brain-methods.csv']),
  createWorkflow('domain-research'),
  createWorkflow('market-research'),
  createWorkflow('product-brief'),
  createWorkflow('prd'),
  createWorkflow('problem-solving', [
    '_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv',
  ]),
  createWorkflow('design-thinking', [
    '_bmad/cis/workflows/bmad-cis-design-thinking/design-methods.csv',
  ]),
  createWorkflow('storytelling', ['_bmad/cis/workflows/bmad-cis-storytelling/story-types.csv']),
]

const methodLibraries: Record<string, string> = {
  '_bmad/core/skills/bmad-brainstorming/brain-methods.csv': [
    'category,technique_name,description',
    'ideation,Constraint Busting,Challenge assumed limits safely.',
  ].join('\n'),
  '_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv': [
    'category,method_name,description',
    'diagnosis,Root Cause Tree,Trace causal branches before choosing a fix.',
  ].join('\n'),
  '_bmad/cis/workflows/bmad-cis-design-thinking/design-methods.csv': [
    'phase,method_name,description',
    'empathize,Empathy Map,Capture user pains and jobs.',
  ].join('\n'),
  '_bmad/cis/workflows/bmad-cis-storytelling/story-types.csv': [
    'category,name,description',
    'alignment,Stakeholder Narrative,Frame a message for sponsor alignment.',
  ].join('\n'),
}

type TestDependencies = {
  accessService: {
    assertThinkTankModuleAvailable: jest.Mock
  }
  workflowRegistry: {
    discoverWorkflows: jest.Mock
  }
  fileProvider: {
    load: jest.Mock
  }
  workflowParser: ThinkTankWorkflowParserService
  eventService: {
    emitAudit: jest.Mock
  }
  quickConsultContextRepository: {
    findContextForActor: jest.Mock
  }
}

function createDependencies(overrides: Partial<TestDependencies> = {}): TestDependencies {
  const dependencies = {
    accessService: {
      assertThinkTankModuleAvailable: jest.fn().mockResolvedValue(undefined),
    },
    workflowRegistry: {
      discoverWorkflows: jest.fn().mockResolvedValue(workflows),
    },
    fileProvider: {
      load: jest.fn(async (sourcePath: string) => ({
        relativePath: sourcePath,
        absolutePath: `D:/Csaas/${sourcePath}`,
        content: methodLibraries[sourcePath],
        contentHash: `${sourcePath}-hash`,
        extension: '.csv' as const,
        modifiedAt: new Date('2026-05-20T00:00:00.000Z'),
      })),
    },
    workflowParser: new ThinkTankWorkflowParserService(),
    eventService: {
      emitAudit: jest.fn().mockResolvedValue(undefined),
    },
    quickConsultContextRepository: {
      findContextForActor: jest.fn().mockResolvedValue({
        id: 'quick-consult-context-34',
        tenantId,
        actorId,
      }),
    },
  }

  return { ...dependencies, ...overrides }
}

describe('QuickConsultMethodBrowseService', () => {
  it('returns a safe manual browse catalog with eight MVP workflows and file-driven method choices', async () => {
    const dependencies = createDependencies()
    const service = new QuickConsultMethodBrowseService(
      dependencies.accessService as never,
      dependencies.workflowRegistry as never,
      dependencies.fileProvider as never,
      dependencies.workflowParser,
      dependencies.eventService as never,
      dependencies.quickConsultContextRepository as never,
    )

    const result = await service.listManualBrowseCatalog({
      user,
      tenantId,
      quickConsultContextId: 'quick-consult-context-34',
      correlationId: 'manual-browse-correlation',
    })

    expect(dependencies.accessService.assertThinkTankModuleAvailable).toHaveBeenCalledWith(
      user,
      tenantId,
    )
    expect(result.methodCatalogStatus).toBe('available')
    expect(result.workflows.map((workflow) => workflow.workflowKey).sort()).toEqual(
      workflows.map((workflow) => workflow.key).sort(),
    )
    expect(result.workflows[0]).toEqual(
      expect.objectContaining({
        workflowKey: expect.any(String),
        displayName: expect.any(String),
        scenarioLabel: expect.any(String),
        sourceRefs: expect.arrayContaining([expect.stringMatching(/^workflow:/)]),
      }),
    )
    expect(result.methodChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'method:brainstorming:constraint-busting-1',
          workflowKey: 'brainstorming',
          methodName: 'Constraint Busting',
          category: 'ideation',
        }),
        expect.objectContaining({
          id: 'method:problem-solving:root-cause-tree-1',
          workflowKey: 'problem-solving',
          methodName: 'Root Cause Tree',
          category: 'diagnosis',
        }),
        expect.objectContaining({
          id: 'method:design-thinking:empathy-map-1',
          workflowKey: 'design-thinking',
          methodName: 'Empathy Map',
          phase: 'empathize',
        }),
        expect.objectContaining({
          id: 'method:storytelling:stakeholder-narrative-1',
          workflowKey: 'storytelling',
          methodName: 'Stakeholder Narrative',
          category: 'alignment',
        }),
      ]),
    )
    expect(JSON.stringify(result)).not.toMatch(/_bmad|\.csv|workflow\.md|prompt|content/i)
  })

  it('degrades method-library failures while preserving direct workflow selection and safe audit metadata', async () => {
    const dependencies = createDependencies({
      fileProvider: {
        load: jest.fn(async (sourcePath: string) => {
          throw new Error(`Cannot read ${sourcePath}; raw prompt ACME secret`)
        }),
      },
    })
    const service = new QuickConsultMethodBrowseService(
      dependencies.accessService as never,
      dependencies.workflowRegistry as never,
      dependencies.fileProvider as never,
      dependencies.workflowParser,
      dependencies.eventService as never,
      dependencies.quickConsultContextRepository as never,
    )

    const result = await service.listManualBrowseCatalog({
      user,
      tenantId,
      quickConsultContextId: 'quick-consult-context-34',
      correlationId: 'manual-browse-correlation',
    })

    expect(result).toEqual(
      expect.objectContaining({
        methodCatalogStatus: 'degraded',
        recoverableMessage: expect.stringContaining('工作流'),
        workflows: expect.any(Array),
        methodChoices: [],
      }),
    )
    expect(result.workflows).toHaveLength(8)
    expect(dependencies.eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: ThinkTankEventName.MethodBrowseFailed,
        tenantId,
        actorId,
        subjectType: ThinkTankSubjectType.QuickConsult,
        subjectId: 'quick-consult-context-34',
        outcome: ThinkTankEventOutcome.Failure,
        privacyClassification: ThinkTankPrivacyClassification.Operational,
        correlationId: 'manual-browse-correlation',
        metadata: expect.objectContaining({
          workflow_key_count: 8,
          method_count: 0,
          failure_category: 'method_library_parse_failed',
          runtime_status: 'degraded',
        }),
      }),
    )
    expect(JSON.stringify(dependencies.eventService.emitAudit.mock.calls)).not.toMatch(
      /_bmad|\.csv|raw prompt|ACME secret|prompt|content|message|path/i,
    )
  })

  it('does not use unowned quick consult context ids as audit subjects', async () => {
    const dependencies = createDependencies({
      fileProvider: {
        load: jest.fn(async () => {
          throw new Error('method library unavailable')
        }),
      },
      quickConsultContextRepository: {
        findContextForActor: jest.fn().mockResolvedValue(null),
      },
    })
    const service = new QuickConsultMethodBrowseService(
      dependencies.accessService as never,
      dependencies.workflowRegistry as never,
      dependencies.fileProvider as never,
      dependencies.workflowParser,
      dependencies.eventService as never,
      dependencies.quickConsultContextRepository as never,
    )

    await service.listManualBrowseCatalog({
      user,
      tenantId,
      quickConsultContextId: 'ACME secret raw context',
    })

    expect(dependencies.quickConsultContextRepository.findContextForActor).toHaveBeenCalledWith(
      tenantId,
      'ACME secret raw context',
      actorId,
    )
    expect(dependencies.eventService.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: 'quick-consult-manual-browse',
        audit: expect.objectContaining({
          entityId: 'quick-consult-manual-browse',
        }),
      }),
    )
    expect(JSON.stringify(dependencies.eventService.emitAudit.mock.calls)).not.toContain(
      'ACME secret raw context',
    )
  })

  it('rejects incomplete manual browse workflow catalogs instead of returning partial choices', async () => {
    const dependencies = createDependencies({
      workflowRegistry: {
        discoverWorkflows: jest.fn().mockResolvedValue(workflows.slice(0, 7)),
      },
    })
    const service = new QuickConsultMethodBrowseService(
      dependencies.accessService as never,
      dependencies.workflowRegistry as never,
      dependencies.fileProvider as never,
      dependencies.workflowParser,
      dependencies.eventService as never,
      dependencies.quickConsultContextRepository as never,
    )

    await expect(
      service.listManualBrowseCatalog({
        user,
        tenantId,
      }),
    ).rejects.toThrow('暂时无法加载 ThinkTank 工作流目录')
  })
})
