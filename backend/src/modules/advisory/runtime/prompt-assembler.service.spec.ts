import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankPromptAssemblerService } from './prompt-assembler.service'
import { ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import { ThinkTankWorkflowParserService } from './workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from './workflow-registry.service'

const repoRoot = resolve(__dirname, '../../../../..')

describe('ThinkTankPromptAssemblerService', () => {
  let tempRoot: string | null = null

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = null
    }
  })

  const createAssembler = () => {
    const fileProvider = new ThinkTankRuntimeFileProviderService({ repoRoot })
    const brandMapper = new ThinkTankBrandMapperService()
    const workflowParser = new ThinkTankWorkflowParserService()
    const registry = new ThinkTankWorkflowRegistryService(fileProvider, brandMapper, workflowParser)

    return new ThinkTankPromptAssemblerService(fileProvider, brandMapper, registry, workflowParser)
  }

  it('assembles workflow and method-library content while preserving technical source refs', async () => {
    const assembler = createAssembler()

    const assembled = await assembler.assemblePrompt({
      workflowKey: 'brainstorming',
      includeMethodLibraries: true,
    })

    expect(assembled.workflow.key).toBe('brainstorming')
    expect(assembled.visiblePrompt).toContain('ThinkTank Runtime Workflow: Brainstorming')
    expect(assembled.visiblePrompt).toContain('Brainstorming Session Workflow')
    expect(assembled.sourceRefs).toEqual(
      expect.arrayContaining([
        '_bmad/core/skills/bmad-brainstorming/workflow.md',
        '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
        '_bmad/core/skills/bmad-brainstorming/brain-methods.csv',
      ]),
    )
    expect(assembled.sources.map((source) => source.relativePath)).toEqual(
      expect.arrayContaining(assembled.sourceRefs),
    )
    expect(assembled.sources).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ absolutePath: expect.any(String) })]),
    )
  })

  it('rejects unknown workflow keys without falling back to hardcoded prompts', async () => {
    const assembler = createAssembler()

    await expect(assembler.assemblePrompt({ workflowKey: 'unknown-flow' })).rejects.toMatchObject({
      code: 'THINKTANK_RUNTIME_WORKFLOW_NOT_FOUND',
      sourcePath: 'unknown-flow',
    })
  })

  it('returns stable validation errors for invalid workflow keys', async () => {
    const assembler = createAssembler()

    await expect(
      assembler.assemblePrompt({ workflowKey: undefined as unknown as string }),
    ).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.InvalidWorkflowKey,
    })
  })

  it('deduplicates equivalent source paths after file-provider canonicalization', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-assembler-dedupe-'))
    const workflowPath = '_bmad/cis/workflows/dedupe-flow/workflow.md'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/dedupe-flow'), { recursive: true })
    await writeFile(join(tempRoot, workflowPath), '# Dedupe Flow', 'utf8')

    const fileProvider = new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot })
    const brandMapper = new ThinkTankBrandMapperService()
    const workflowParser = new ThinkTankWorkflowParserService()
    const registry = new ThinkTankWorkflowRegistryService(
      fileProvider,
      brandMapper,
      workflowParser,
      {
        workflowSources: [
          {
            key: 'dedupe-flow',
            sourcePath: workflowPath,
            firstPromptSource: '_bmad/cis/workflows/dedupe-flow/./workflow.md',
          },
        ],
      },
    )
    const assembler = new ThinkTankPromptAssemblerService(
      fileProvider,
      brandMapper,
      registry,
      workflowParser,
    )

    const assembled = await assembler.assemblePrompt({ workflowKey: 'dedupe-flow' })

    expect(assembled.sourceRefs).toEqual([workflowPath])
    expect(assembled.visiblePrompt.match(/## Source:/g)).toHaveLength(1)
  })

  it('rejects malformed method-library CSV files before assembling partial guidance', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-assembler-methods-'))
    const workflowPath = '_bmad/cis/workflows/method-flow/workflow.md'
    const methodPath = '_bmad/cis/workflows/method-flow/broken-methods.csv'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/method-flow'), { recursive: true })
    await writeFile(join(tempRoot, workflowPath), '# Method Flow', 'utf8')
    await writeFile(join(tempRoot, methodPath), 'category,method\none,"unterminated\n', 'utf8')

    const fileProvider = new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot })
    const brandMapper = new ThinkTankBrandMapperService()
    const workflowParser = new ThinkTankWorkflowParserService()
    const registry = new ThinkTankWorkflowRegistryService(
      fileProvider,
      brandMapper,
      workflowParser,
      {
        workflowSources: [
          {
            key: 'method-flow',
            sourcePath: workflowPath,
            methodLibraryPaths: [methodPath],
          },
        ],
      },
    )
    const assembler = new ThinkTankPromptAssemblerService(
      fileProvider,
      brandMapper,
      registry,
      workflowParser,
    )

    await expect(
      assembler.assemblePrompt({ workflowKey: 'method-flow', includeMethodLibraries: true }),
    ).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
      sourcePath: methodPath,
    })
  })
})
