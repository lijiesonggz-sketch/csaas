import { resolve } from 'node:path'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import { ThinkTankWorkflowParserService } from './workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from './workflow-registry.service'
import { ThinkTankWorkflowStepResolverService } from './workflow-step-resolver.service'

const repoRoot = resolve(__dirname, '../../../../..')
const expectedWorkflowKeys = [
  'brainstorming',
  'domain-research',
  'market-research',
  'product-brief',
  'prd',
  'problem-solving',
  'design-thinking',
  'storytelling',
]

describe('ThinkTankWorkflowStepResolverService', () => {
  let registry: ThinkTankWorkflowRegistryService
  let resolver: ThinkTankWorkflowStepResolverService

  beforeEach(() => {
    const fileProvider = new ThinkTankRuntimeFileProviderService({ repoRoot })
    const brandMapper = new ThinkTankBrandMapperService()
    registry = new ThinkTankWorkflowRegistryService(
      fileProvider,
      brandMapper,
      new ThinkTankWorkflowParserService(),
    )
    resolver = new ThinkTankWorkflowStepResolverService(fileProvider, brandMapper)
  })

  it('resolves executable runtime step plans for all eight ThinkTank workflows', async () => {
    const workflows = await registry.discoverWorkflows()
    const byKey = new Map(workflows.map((workflow) => [workflow.key, workflow]))

    for (const key of expectedWorkflowKeys) {
      const workflow = byKey.get(key)
      expect(workflow).toBeDefined()

      const plan = await resolver.resolveWorkflowStepPlan(workflow!)

      expect(plan.workflowKey).toBe(key)
      expect(plan.steps.length).toBeGreaterThanOrEqual(1)
      expect(plan.firstStep.sourcePath).toBeTruthy()
      expect(plan.firstStep.sourceRef).toMatch(/^current-step:\d+[a-z]?$/)
      expect(plan.firstStep.label).toBeTruthy()
      expect(plan.firstStep.label).not.toMatch(/_bmad|[\\/]/)
      expect(plan.sourceRefs.every((sourceRef) => sourceRef.startsWith('_bmad/'))).toBe(true)
    }

    expect((await resolver.resolveWorkflowStepPlan(byKey.get('brainstorming')!)).steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index: 1,
          sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
        }),
        expect.objectContaining({
          index: 2,
          routeKey: '2b',
          sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-02b-ai-recommended.md',
        }),
        expect.objectContaining({
          index: 3,
          sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-03-technique-execution.md',
        }),
        expect.objectContaining({
          index: 4,
          sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-04-idea-organization.md',
        }),
      ]),
    )
    expect(
      (await resolver.resolveWorkflowStepPlan(byKey.get('domain-research')!)).steps,
    ).toHaveLength(6)
    expect(
      (await resolver.resolveWorkflowStepPlan(byKey.get('market-research')!)).steps,
    ).toHaveLength(6)
    expect(
      (await resolver.resolveWorkflowStepPlan(byKey.get('prd')!)).steps.length,
    ).toBeGreaterThan(10)
    expect(
      (await resolver.resolveWorkflowStepPlan(byKey.get('problem-solving')!)).steps,
    ).toHaveLength(9)
    expect(
      (await resolver.resolveWorkflowStepPlan(byKey.get('design-thinking')!)).steps,
    ).toHaveLength(7)
    expect((await resolver.resolveWorkflowStepPlan(byKey.get('storytelling')!)).steps).toHaveLength(
      10,
    )
  })

  it('marks final runtime steps so clients can finalize workflow outputs', async () => {
    const workflow = await registry.findWorkflow('storytelling')
    expect(workflow).toBeDefined()
    const plan = await resolver.resolveWorkflowStepPlan(workflow!)
    const finalStep = plan.steps.find((step) => step.index === 10)
    expect(finalStep).toBeDefined()

    const state = await resolver.resolveCurrentStep({
      workflow: workflow!,
      currentStep: finalStep!,
      metadata: {
        runtime_current_step_source:
          '_bmad/cis/workflows/bmad-cis-storytelling/workflow.md#step-10',
        runtime_current_step_index: 10,
      },
    })

    expect(state.currentStep).toEqual(
      expect.objectContaining({
        index: 10,
        totalSteps: 10,
        isFinal: true,
        isFinalStep: true,
      }),
    )
  })

  it('routes brainstorming approach selection 2 to the AI-recommended Step 2b source', async () => {
    const workflow = await registry.findWorkflow('brainstorming')
    expect(workflow).toBeDefined()
    const launchState = await resolver.resolveLaunchState(workflow!)

    const route = await resolver.resolveRouteForUserInput({
      workflow: workflow!,
      currentStep: launchState.currentStep,
      metadata: launchState.metadata,
      userInput: '2',
    })

    expect(route).toEqual(
      expect.objectContaining({
        routeSource: 'explicit',
        previousStep: expect.objectContaining({ index: 1 }),
        currentStep: expect.objectContaining({
          index: 2,
          sourceRef: 'current-step:2b',
        }),
        step: expect.objectContaining({
          routeKey: '2b',
          sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-02b-ai-recommended.md',
        }),
      }),
    )
    expect(route?.metadata).toEqual(
      expect.objectContaining({
        runtime_current_step_source:
          '_bmad/core/skills/bmad-brainstorming/steps/step-02b-ai-recommended.md',
        runtime_current_step_index: 2,
      }),
    )
  })

  it('recovers the current step from legacy currentStep snapshots when runtime metadata is missing', async () => {
    const workflow = await registry.findWorkflow('brainstorming')
    expect(workflow).toBeDefined()

    const state = await resolver.resolveCurrentStep({
      workflow: workflow!,
      currentStep: {
        index: 2,
        label: 'Step 2b: AI-Recommended Techniques',
        sourceRef: 'current-step:2b',
      },
      metadata: {},
    })

    expect(state.step).toEqual(
      expect.objectContaining({
        routeKey: '2b',
        sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-02b-ai-recommended.md',
      }),
    )
    expect(state.currentStep).toEqual(
      expect.objectContaining({
        index: 2,
        sourceRef: 'current-step:2b',
      }),
    )
  })

  it('does not confuse brainstorming setup confirmation with the existing-session continuation branch', async () => {
    const workflow = await registry.findWorkflow('brainstorming')
    expect(workflow).toBeDefined()
    const launchState = await resolver.resolveLaunchState(workflow!)

    await expect(
      resolver.resolveRouteForUserInput({
        workflow: workflow!,
        currentStep: launchState.currentStep,
        metadata: launchState.metadata,
        userInput: '是',
      }),
    ).resolves.toBeNull()
  })

  it('routes continue choices through explicit step load instructions before using sequential fallback', async () => {
    const workflow = await registry.findWorkflow('domain-research')
    expect(workflow).toBeDefined()
    const launchState = await resolver.resolveLaunchState(workflow!)

    const route = await resolver.resolveRouteForUserInput({
      workflow: workflow!,
      currentStep: launchState.currentStep,
      metadata: launchState.metadata,
      userInput: 'C',
    })

    expect(route).toEqual(
      expect.objectContaining({
        routeSource: 'explicit',
        currentStep: expect.objectContaining({
          index: 2,
          sourceRef: 'current-step:2',
        }),
        step: expect.objectContaining({
          sourcePath:
            '_bmad/bmm/workflows/1-analysis/research/bmad-domain-research/domain-steps/step-02-domain-analysis.md',
        }),
      }),
    )
  })

  it('routes PRD initialization continue choice to project discovery', async () => {
    const workflow = await registry.findWorkflow('prd')
    expect(workflow).toBeDefined()
    const launchState = await resolver.resolveLaunchState(workflow!)

    const route = await resolver.resolveRouteForUserInput({
      workflow: workflow!,
      currentStep: launchState.currentStep,
      metadata: launchState.metadata,
      userInput: 'c',
    })

    expect(route).toEqual(
      expect.objectContaining({
        routeSource: 'explicit',
        previousStep: expect.objectContaining({ index: 1 }),
        currentStep: expect.objectContaining({ index: 2 }),
        step: expect.objectContaining({
          sourcePath: '_bmad/core/tasks/bmad-create-prd/steps-c/step-02-discovery.md',
        }),
      }),
    )
  })

  it('keeps brainstorming technique execution in Step 3 on generic continue', async () => {
    const workflow = await registry.findWorkflow('brainstorming')
    expect(workflow).toBeDefined()
    const plan = await resolver.resolveWorkflowStepPlan(workflow!)
    const step3 = plan.steps.find((step) => step.routeKey === '3')
    expect(step3).toBeDefined()

    await expect(
      resolver.resolveRouteForUserInput({
        workflow: workflow!,
        currentStep: step3!,
        metadata: {
          runtime_current_step_source:
            '_bmad/core/skills/bmad-brainstorming/steps/step-03-technique-execution.md',
          runtime_current_step_index: 3,
        },
        userInput: 'c',
      }),
    ).resolves.toBeNull()
  })

  it('routes brainstorming technique execution to organization only on explicit organization request', async () => {
    const workflow = await registry.findWorkflow('brainstorming')
    expect(workflow).toBeDefined()
    const plan = await resolver.resolveWorkflowStepPlan(workflow!)
    const step3 = plan.steps.find((step) => step.routeKey === '3')
    expect(step3).toBeDefined()

    const route = await resolver.resolveRouteForUserInput({
      workflow: workflow!,
      currentStep: step3!,
      metadata: {
        runtime_current_step_source:
          '_bmad/core/skills/bmad-brainstorming/steps/step-03-technique-execution.md',
        runtime_current_step_index: 3,
      },
      userInput: 'move to organization',
    })

    expect(route).toEqual(
      expect.objectContaining({
        routeSource: 'explicit',
        previousStep: expect.objectContaining({ index: 3 }),
        currentStep: expect.objectContaining({ index: 4 }),
        step: expect.objectContaining({
          sourcePath: '_bmad/core/skills/bmad-brainstorming/steps/step-04-idea-organization.md',
        }),
      }),
    )
  })

  it('extracts XML-style workflow steps and advances them sequentially', async () => {
    const workflow = await registry.findWorkflow('design-thinking')
    expect(workflow).toBeDefined()
    const plan = await resolver.resolveWorkflowStepPlan(workflow!)

    expect(plan.firstStep).toEqual(
      expect.objectContaining({
        index: 1,
        label: 'Step 1: Gather context and define design challenge',
        sourcePath: '_bmad/cis/workflows/bmad-cis-design-thinking/workflow.md#step-1',
      }),
    )
    expect(plan.steps[1]).toEqual(
      expect.objectContaining({
        index: 2,
        label: 'Step 2: EMPATHIZE - Build understanding of users',
        sourcePath: '_bmad/cis/workflows/bmad-cis-design-thinking/workflow.md#step-2',
      }),
    )

    const route = await resolver.resolveRouteForUserInput({
      workflow: workflow!,
      currentStep: plan.firstStep,
      metadata: {
        runtime_current_step_source:
          '_bmad/cis/workflows/bmad-cis-design-thinking/workflow.md#step-1',
        runtime_current_step_index: 1,
      },
      userInput: 'c',
    })

    expect(route).toEqual(
      expect.objectContaining({
        routeSource: 'sequential',
        currentStep: expect.objectContaining({ index: 2 }),
        step: expect.objectContaining({
          sourcePath: '_bmad/cis/workflows/bmad-cis-design-thinking/workflow.md#step-2',
        }),
      }),
    )
  })
})
