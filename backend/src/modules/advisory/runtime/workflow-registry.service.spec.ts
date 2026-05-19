import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'
import { ThinkTankWorkflowParserService } from './workflow-parser.service'
import { ThinkTankWorkflowRegistryService } from './workflow-registry.service'

const repoRoot = resolve(__dirname, '../../../../..')

describe('ThinkTankWorkflowRegistryService', () => {
  let tempRoot: string | null = null

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = null
    }
  })

  it('discovers the eight MVP ThinkTank workflows from runtime source assets', async () => {
    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
    )

    const workflows = await registry.discoverWorkflows()
    const byKey = new Map(workflows.map((workflow) => [workflow.key, workflow]))
    const expectedKeys = [
      'brainstorming',
      'domain-research',
      'market-research',
      'product-brief',
      'prd',
      'problem-solving',
      'design-thinking',
      'storytelling',
    ]

    for (const key of expectedKeys) {
      const workflow = byKey.get(key)
      expect(workflow).toBeDefined()
      expect(workflow?.displayName).toBeTruthy()
      expect(workflow?.displayName).not.toMatch(/\b(BMAD|BMad|BMM|CIS)\b/)
      expect(workflow?.sourcePath).toMatch(/^_bmad\//)
      expect(workflow?.supportedFileType).toBe('.md')
      expect(workflow?.firstPromptSource).toMatch(/^_bmad\//)
    }

    expect(byKey.get('brainstorming')?.firstPromptSource).toBe(
      '_bmad/core/skills/bmad-brainstorming/steps/step-01-session-setup.md',
    )
    expect(byKey.get('brainstorming')?.methodLibraryPaths).toContain(
      '_bmad/core/skills/bmad-brainstorming/brain-methods.csv',
    )
    expect(byKey.get('problem-solving')?.methodLibraryPaths).toContain(
      '_bmad/cis/workflows/bmad-cis-problem-solving/solving-methods.csv',
    )
    expect(byKey.get('design-thinking')?.methodLibraryPaths).toContain(
      '_bmad/cis/workflows/bmad-cis-design-thinking/design-methods.csv',
    )
    expect(byKey.get('storytelling')?.methodLibraryPaths).toContain(
      '_bmad/cis/workflows/bmad-cis-storytelling/story-types.csv',
    )
  })

  it('discovers a configured workflow fixture without workflow-specific branching', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-'))
    const workflowPath = '_bmad/cis/workflows/bmad-cis-fixture-sprint/workflow.md'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/bmad-cis-fixture-sprint'), {
      recursive: true,
    })
    await writeFile(
      join(tempRoot, workflowPath),
      [
        '---',
        'name: bmad-cis-fixture-sprint',
        'description: Fixture workflow for registry discovery.',
        '---',
        '',
        '# BMAD Fixture Sprint Workflow',
        '',
        '**Goal:** Exercise parser extension behavior.',
      ].join('\n'),
      'utf8',
    )

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { workflowSourcePaths: [workflowPath] },
    )

    await expect(registry.discoverWorkflows()).resolves.toEqual([
      expect.objectContaining({
        key: 'fixture-sprint',
        displayName: 'ThinkTank Fixture Sprint Workflow',
        sourcePath: workflowPath,
      }),
    ])
  })

  it('infers adjacent method libraries for configured workflows', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-methods-'))
    const workflowPath = '_bmad/cis/workflows/bmad-cis-method-fixture/workflow.md'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/bmad-cis-method-fixture'), {
      recursive: true,
    })
    await writeFile(join(tempRoot, workflowPath), '# Method Fixture Workflow', 'utf8')
    const methodPath = '_bmad/cis/workflows/bmad-cis-method-fixture/custom-methods.csv'
    await writeFile(join(tempRoot, methodPath), 'id,name\none,One Method\n', 'utf8')

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { workflowSourcePaths: [workflowPath] },
    )

    await expect(registry.discoverWorkflows()).resolves.toEqual([
      expect.objectContaining({
        key: 'method-fixture',
        methodLibraryPaths: [methodPath],
      }),
    ])
  })

  it('rejects duplicate normalized workflow keys instead of silently hiding a workflow', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-duplicates-'))
    const first = '_bmad/cis/workflows/bmad-cis-duplicate-key/workflow.md'
    const second = '_bmad/cis/workflows/duplicate_key/workflow.md'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/bmad-cis-duplicate-key'), {
      recursive: true,
    })
    await mkdir(join(tempRoot, '_bmad/cis/workflows/duplicate_key'), { recursive: true })
    await writeFile(join(tempRoot, first), '# First Duplicate Workflow', 'utf8')
    await writeFile(join(tempRoot, second), '# Second Duplicate Workflow', 'utf8')

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { workflowSourcePaths: [first, second] },
    )

    await expect(registry.discoverWorkflows()).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
    })
  })

  it('parses YAML workflow definitions through the parser boundary', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-yaml-'))
    const workflowPath = '_bmad/cis/workflows/yaml-fixture/workflow.yaml'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/yaml-fixture'), { recursive: true })
    await writeFile(
      join(tempRoot, workflowPath),
      [
        'name: YAML BMAD Fixture',
        'description: YAML workflow source',
        'firstPromptSource: ./step-01.md',
      ].join('\n'),
      'utf8',
    )
    await writeFile(
      join(tempRoot, '_bmad/cis/workflows/yaml-fixture/step-01.md'),
      '# Step 1',
      'utf8',
    )

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { workflowSourcePaths: [workflowPath] },
    )

    await expect(registry.discoverWorkflows()).resolves.toEqual([
      expect.objectContaining({
        key: 'yaml-fixture',
        displayName: 'YAML ThinkTank Fixture',
        firstPromptSource: '_bmad/cis/workflows/yaml-fixture/step-01.md',
      }),
    ])
  })

  it('parses CSV workflow definitions through the parser boundary', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-csv-'))
    const workflowPath = '_bmad/cis/workflows/csv-fixture/workflow.csv'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/csv-fixture'), { recursive: true })
    await writeFile(
      join(tempRoot, workflowPath),
      'title,description,firstPromptSource\nCSV BMAD Fixture,CSV workflow source,./step-01.md\n',
      'utf8',
    )
    await writeFile(
      join(tempRoot, '_bmad/cis/workflows/csv-fixture/step-01.md'),
      '# Step 1',
      'utf8',
    )

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { workflowSourcePaths: [workflowPath] },
    )

    await expect(registry.discoverWorkflows()).resolves.toEqual([
      expect.objectContaining({
        key: 'csv-fixture',
        displayName: 'CSV ThinkTank Fixture',
        firstPromptSource: '_bmad/cis/workflows/csv-fixture/step-01.md',
      }),
    ])
  })

  it('rejects CSV workflow definitions with blank titles', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-csv-blank-'))
    const workflowPath = '_bmad/cis/workflows/csv-blank-fixture/workflow.csv'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/csv-blank-fixture'), { recursive: true })
    await writeFile(
      join(tempRoot, workflowPath),
      'title,description\n   ,CSV workflow source\n',
      'utf8',
    )

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { workflowSourcePaths: [workflowPath] },
    )

    await expect(registry.discoverWorkflows()).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
    })
  })

  it('discovers runtime catalog rows without code-level workflow overrides', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-runtime-catalog-'))
    const catalogPath = '_bmad/_config/thinktank-runtime-workflows.csv'
    const workflowPath = '_bmad/cis/workflows/new-runtime-flow/workflow.md'
    const csvWorkflowPath = '_bmad/cis/workflows/new-runtime-csv-flow/workflow.csv'
    const fallbackWorkflowPath = '_bmad/cis/workflows/catalog-fallback-flow/workflow.md'
    const methodPath = '_bmad/cis/workflows/new-runtime-flow/new-methods.csv'
    const agentPath = '_bmad/cis/agents/new-runtime-agent.md'
    await mkdir(join(tempRoot, '_bmad/_config'), { recursive: true })
    await mkdir(join(tempRoot, '_bmad/cis/workflows/new-runtime-flow'), { recursive: true })
    await mkdir(join(tempRoot, '_bmad/cis/workflows/new-runtime-csv-flow'), { recursive: true })
    await mkdir(join(tempRoot, '_bmad/cis/workflows/catalog-fallback-flow'), { recursive: true })
    await mkdir(join(tempRoot, '_bmad/cis/agents'), { recursive: true })
    await writeFile(
      join(tempRoot, workflowPath),
      '# New Runtime Flow\n\n**Goal:** Extend runtime.',
      'utf8',
    )
    await writeFile(
      join(tempRoot, csvWorkflowPath),
      'title,description,firstPromptSource\nNew Runtime CSV Flow,Runtime catalog CSV extension,./step-01.md\n',
      'utf8',
    )
    await writeFile(
      join(tempRoot, '_bmad/cis/workflows/new-runtime-csv-flow/step-01.md'),
      '# CSV Runtime Step',
      'utf8',
    )
    await writeFile(
      join(tempRoot, fallbackWorkflowPath),
      '# Catalog Fallback Flow\n\n**Goal:** Use parsed title.',
      'utf8',
    )
    await writeFile(join(tempRoot, methodPath), 'id,name\none,One Method\n', 'utf8')
    await writeFile(join(tempRoot, agentPath), '# New Runtime Agent', 'utf8')
    await writeFile(
      join(tempRoot, catalogPath),
      [
        'key,displayName,description,scenarioLabel,path,firstPromptSource,methodLibraryPaths,agentSourcePaths',
        `new-runtime-flow,New Runtime Flow,Runtime catalog extension,Runtime extension,${workflowPath},${workflowPath},${methodPath},${agentPath}`,
        `new-runtime-csv-flow,New Runtime CSV Flow,Runtime catalog CSV extension,Runtime CSV extension,${csvWorkflowPath},,,`,
        `catalog-fallback-flow,   ,Runtime catalog fallback,Runtime fallback,${fallbackWorkflowPath},,,`,
      ].join('\n'),
      'utf8',
    )

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { manifestPaths: [catalogPath] },
    )

    await expect(registry.discoverWorkflows()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'new-runtime-flow',
          sourcePath: workflowPath,
          methodLibraryPaths: [methodPath],
          agentSourcePaths: [agentPath],
        }),
        expect.objectContaining({
          key: 'new-runtime-csv-flow',
          sourcePath: csvWorkflowPath,
          supportedFileType: '.csv',
          firstPromptSource: '_bmad/cis/workflows/new-runtime-csv-flow/step-01.md',
        }),
        expect.objectContaining({
          key: 'catalog-fallback-flow',
          displayName: 'Catalog Fallback Flow',
          sourcePath: fallbackWorkflowPath,
        }),
      ]),
    )
  })

  it('rejects malformed runtime manifest headers and rows', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-manifest-'))
    const catalogPath = '_bmad/_config/thinktank-runtime-workflows.csv'
    await mkdir(join(tempRoot, '_bmad/_config'), { recursive: true })
    await writeFile(join(tempRoot, catalogPath), 'key,displayName\nbroken,Broken\n', 'utf8')

    const registry = new ThinkTankWorkflowRegistryService(
      new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
      new ThinkTankBrandMapperService(),
      new ThinkTankWorkflowParserService(),
      { manifestPaths: [catalogPath] },
    )

    await expect(registry.discoverWorkflows()).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
    })
  })

  it('rejects malformed workflow frontmatter and YAML definitions', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-registry-malformed-'))
    const markdownPath = '_bmad/cis/workflows/malformed-markdown/workflow.md'
    const yamlPath = '_bmad/cis/workflows/malformed-yaml/workflow.yaml'
    await mkdir(join(tempRoot, '_bmad/cis/workflows/malformed-markdown'), { recursive: true })
    await mkdir(join(tempRoot, '_bmad/cis/workflows/malformed-yaml'), { recursive: true })
    await writeFile(
      join(tempRoot, markdownPath),
      ['---', 'title: [unterminated', '---', '# Hidden'].join('\n'),
      'utf8',
    )
    await writeFile(join(tempRoot, yamlPath), 'name: [unterminated', 'utf8')

    const createRegistry = (workflowPath: string) =>
      new ThinkTankWorkflowRegistryService(
        new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot }),
        new ThinkTankBrandMapperService(),
        new ThinkTankWorkflowParserService(),
        { workflowSourcePaths: [workflowPath] },
      )

    await expect(createRegistry(markdownPath).discoverWorkflows()).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
    })
    await expect(createRegistry(yamlPath).discoverWorkflows()).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.WorkflowMalformed,
    })
  })
})
