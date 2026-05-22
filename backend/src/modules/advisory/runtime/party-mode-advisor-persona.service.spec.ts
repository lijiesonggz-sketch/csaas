import { ThinkTankBrandMapperService } from './brand-mapper.service'
import { ThinkTankPartyModeAdvisorPersonaService } from './party-mode-advisor-persona.service'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileDescriptor } from './runtime.types'

const modifiedAt = new Date('2026-05-22T00:00:00.000Z')

function descriptor(relativePath: string, content: string, contentHash = `hash:${relativePath}`) {
  return {
    relativePath,
    absolutePath: `D:/Csaas/${relativePath}`,
    content,
    contentHash,
    extension: relativePath.endsWith('.csv') ? '.csv' : '.md',
    modifiedAt,
  } as ThinkTankRuntimeFileDescriptor
}

const manifestCsv = `name,displayName,title,icon,capabilities,role,identity,communicationStyle,principles,module,path,canonicalId
"pm","John","Product Manager","","PRD creation, stakeholder alignment","BMAD Product Manager","BMM product veteran","Asks why","User value first","bmm","_bmad/bmm/agents/pm.md","bmad-pm"
"architect","Winston","Architect","","distributed systems, API design","BMM Architect","Technical architect","Calm and pragmatic","Design simple solutions","bmm","_bmad/bmm/agents/architect.md","bmad-architect"
"analyst","Mary","Business Analyst","","market research, requirements","BMM Analyst","Business analyst","Evidence-led","Ground findings in evidence","bmm","_bmad/bmm/agents/analyst.md","bmad-analyst"
"creative-problem-solver","Dr. Quinn","Master Problem Solver","","TRIZ, root cause analysis","CIS Problem Solver","Systems problem solver","Deductive","Find root causes","cis","_bmad/cis/agents/creative-problem-solver.md",""
`

const bmmPartyCsv = `name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"pm","John","Product Manager","","Product Manager","Product veteran","Asks why","User value first","bmm","bmad/bmm/agents/pm.md"
"architect","Winston","Architect","","Architect","Technical architect","Calm","Simple systems","bmm","bmad/bmm/agents/architect.md"
"analyst","Mary","Business Analyst","","Analyst","Business analyst","Evidence-led","Ground findings","bmm","bmad/bmm/agents/analyst.md"
`

const cisPartyCsv = `name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"creative-problem-solver","Dr. Quinn","Master Problem Solver","","Problem Solver","Systems problem solver","Deductive","Find root causes","cis","bmad/cis/agents/creative-problem-solver.md"
`

const teaPartyCsv = `name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"tea","Murat","Master Test Architect","","Test Architect","Quality advisor","Risk-based","Prefer lower test levels","tea","_bmad/tea/agents/tea.agent.yaml"
`

const agentFileContent =
  '---\nname: hidden\n---\n<agent><activation>never expose this raw instruction</activation></agent>'

function createFileProvider(
  failingPaths = new Set<string>(),
  fileOverrides = new Map<string, ThinkTankRuntimeFileDescriptor>(),
  failureCode = ThinkTankRuntimeErrorCode.FileNotFound,
) {
  const files = new Map<string, ThinkTankRuntimeFileDescriptor>([
    [
      '_bmad/_config/agent-manifest.csv',
      descriptor('_bmad/_config/agent-manifest.csv', manifestCsv),
    ],
    [
      '_bmad/bmm/teams/default-party.csv',
      descriptor('_bmad/bmm/teams/default-party.csv', bmmPartyCsv),
    ],
    [
      '_bmad/cis/teams/default-party.csv',
      descriptor('_bmad/cis/teams/default-party.csv', cisPartyCsv),
    ],
    [
      '_bmad/tea/teams/default-party.csv',
      descriptor('_bmad/tea/teams/default-party.csv', teaPartyCsv),
    ],
    [
      '_bmad/bmm/agents/pm.md',
      descriptor('_bmad/bmm/agents/pm.md', agentFileContent, 'pm-source-hash'),
    ],
    [
      '_bmad/bmm/agents/architect.md',
      descriptor('_bmad/bmm/agents/architect.md', agentFileContent, 'architect-source-hash'),
    ],
    [
      '_bmad/bmm/agents/analyst.md',
      descriptor('_bmad/bmm/agents/analyst.md', agentFileContent, 'analyst-source-hash'),
    ],
    [
      '_bmad/cis/agents/creative-problem-solver.md',
      descriptor(
        '_bmad/cis/agents/creative-problem-solver.md',
        agentFileContent,
        'problem-solver-source-hash',
      ),
    ],
  ])
  for (const [sourcePath, file] of fileOverrides) {
    files.set(sourcePath, file)
  }

  return {
    load: jest.fn(async (sourcePath: string) => {
      const normalized = sourcePath.replace(/^bmad\//, '_bmad/')
      if (failingPaths.has(normalized)) {
        throw new ThinkTankRuntimeError(failureCode, `failed to load ${normalized}`, {
          sourcePath: normalized,
        })
      }

      const file = files.get(normalized)
      if (!file) {
        throw new ThinkTankRuntimeError(
          ThinkTankRuntimeErrorCode.FileNotFound,
          `missing ${normalized}`,
          { sourcePath: normalized },
        )
      }

      return file
    }),
  }
}

describe('Story 5.2 ATDD - ThinkTankPartyModeAdvisorPersonaService', () => {
  test('[P0][5.2-UNIT-001][AC1,AC2] loads approved personas and selects differentiated ThinkTank advisors', async () => {
    const fileProvider = createFileProvider()
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    const selection = await service.selectAdvisors({
      workflowKey: 'problem-solving',
      currentStepLabel: '根因分解',
      latestUserMessage: 'We need to find the root cause and decide a product direction.',
    })

    expect(selection.advisors.map((advisor) => advisor.id)).toEqual([
      'creative-problem-solver',
      'architect',
      'pm',
    ])
    expect(new Set(selection.advisors.map((advisor) => advisor.roleFamily)).size).toBe(3)
    expect(selection.visibleSummary).toContain('ThinkTank 顾问')
    expect(selection.visibleSummary).toContain('Dr. Quinn')
    expect(selection.visibleSummary).toContain('Winston')
    expect(selection.visibleSummary).toContain('John')
    expect(selection.visibleSummary).not.toContain('BMAD')
    expect(selection.visibleSummary).not.toContain('_bmad')
    expect(selection.visibleSummary).not.toContain('<activation>')
    expect(selection.metadata.party_mode_advisor_count).toBe(3)
    expect(selection.metadata.party_mode_selected_advisor_source_hashes).toContain(
      'problem-solver-source-hash',
    )
    expect(JSON.stringify(selection.metadata)).not.toContain('never expose this raw instruction')
  })

  test('[P0][5.2-UNIT-001B][AC1] treats name-only team rows as an allowlist backed by manifest source paths', async () => {
    const fileProvider = createFileProvider(
      new Set(),
      new Map([
        [
          '_bmad/bmm/teams/default-party.csv',
          descriptor(
            '_bmad/bmm/teams/default-party.csv',
            'name,displayName\n"pm","John"\n"architect","Winston"\n',
          ),
        ],
        [
          '_bmad/cis/teams/default-party.csv',
          descriptor(
            '_bmad/cis/teams/default-party.csv',
            'name,displayName\n"creative-problem-solver","Dr. Quinn"\n',
          ),
        ],
        [
          '_bmad/tea/teams/default-party.csv',
          descriptor('_bmad/tea/teams/default-party.csv', 'name,displayName\n'),
        ],
      ]),
    )
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    const selection = await service.selectAdvisors({ workflowKey: 'problem-solving' })

    expect(selection.advisors.map((advisor) => advisor.id)).toEqual([
      'creative-problem-solver',
      'architect',
      'pm',
    ])
    expect(selection.metadata.party_mode_selected_advisor_source_paths).toContain(
      '_bmad/bmm/agents/pm.md',
    )
  })

  test('[P0][5.2-UNIT-001C][AC1] rejects invalid advisor count inputs before selecting personas', async () => {
    const fileProvider = createFileProvider()
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    await expect(
      service.selectAdvisors({
        workflowKey: 'problem-solving',
        targetCount: 0,
        minimumCount: 0,
      }),
    ).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.PartyModeAdvisorSetUnavailable,
    })
    expect(fileProvider.load).not.toHaveBeenCalled()
  })

  test('[P0][5.2-UNIT-001D][AC2] uses step and message relevance when ordering differentiated advisors', async () => {
    const fileProvider = createFileProvider()
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    const selection = await service.selectAdvisors({
      workflowKey: 'problem-solving',
      currentStepLabel: '市场证据与需求澄清',
      latestUserMessage: 'We need market research and requirements evidence before architecture.',
    })

    expect(selection.advisors.map((advisor) => advisor.id)).toEqual([
      'analyst',
      'creative-problem-solver',
      'architect',
    ])
    expect(selection.advisors[0].selectionReason).toContain('market research')
  })

  test('[P0][5.2-UNIT-002][AC3] continues with visible omission when one selected advisor source fails and the viable set remains', async () => {
    const fileProvider = createFileProvider(new Set(['_bmad/bmm/agents/architect.md']))
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    const selection = await service.selectAdvisors({
      workflowKey: 'problem-solving',
      currentStepLabel: '根因分解',
      latestUserMessage: 'We need product and business diagnosis.',
    })

    expect(selection.advisors).toHaveLength(3)
    expect(selection.advisors.map((advisor) => advisor.id)).not.toContain('architect')
    expect(selection.omittedAdvisors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'architect',
          displayName: 'Winston',
          reason: expect.stringContaining('不可用'),
        }),
      ]),
    )
    expect(selection.visibleSummary).toContain('已略过 Winston')
    expect(selection.visibleSummary).not.toContain('覆盖该视角')
    expect(selection.visibleSummary).not.toContain('_bmad/bmm/agents/architect.md')
    expect(selection.metadata.party_mode_omitted_advisor_count).toBe(1)
  })

  test('[P0][5.2-UNIT-002B][AC1,AC3] propagates non-recoverable source approval errors instead of treating them as omissions', async () => {
    const fileProvider = createFileProvider(
      new Set(['_bmad/bmm/agents/architect.md']),
      new Map(),
      ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
    )
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    await expect(service.selectAdvisors({ workflowKey: 'problem-solving' })).rejects.toMatchObject(
      {
        code: ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
      },
    )
  })

  test('[P0][5.2-UNIT-002C][AC1] rejects approved CSV rows that point outside agent definition roots', async () => {
    const fileProvider = createFileProvider(
      new Set(),
      new Map([
        [
          '_bmad/bmm/teams/default-party.csv',
          descriptor(
            '_bmad/bmm/teams/default-party.csv',
            'name,displayName,path\n"unknown","Unknown","_bmad/bmm/teams/default-party.csv"\n',
          ),
        ],
        [
          '_bmad/cis/teams/default-party.csv',
          descriptor('_bmad/cis/teams/default-party.csv', 'name,displayName\n'),
        ],
        [
          '_bmad/tea/teams/default-party.csv',
          descriptor('_bmad/tea/teams/default-party.csv', 'name,displayName\n'),
        ],
      ]),
    )
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    await expect(
      service.selectAdvisors({
        workflowKey: 'problem-solving',
        targetCount: 1,
        minimumCount: 1,
      }),
    ).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
    })
  })

  test('[P0][5.2-UNIT-003][AC3] fails closed when fewer than three approved advisors can be loaded', async () => {
    const fileProvider = createFileProvider(
      new Set([
        '_bmad/bmm/agents/architect.md',
        '_bmad/bmm/agents/analyst.md',
        '_bmad/cis/agents/creative-problem-solver.md',
      ]),
    )
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    await expect(
      service.selectAdvisors({
        workflowKey: 'problem-solving',
        currentStepLabel: '根因分解',
      }),
    ).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.PartyModeAdvisorSetUnavailable,
    })
  })

  test('[P0][5.2-UNIT-003B][AC1] does not fall back to every manifest advisor when team rosters contain no valid approved candidates', async () => {
    const fileProvider = createFileProvider(
      new Set(),
      new Map([
        [
          '_bmad/bmm/teams/default-party.csv',
          descriptor('_bmad/bmm/teams/default-party.csv', 'name,displayName\n"unknown","Unknown"\n'),
        ],
        [
          '_bmad/cis/teams/default-party.csv',
          descriptor('_bmad/cis/teams/default-party.csv', 'name,displayName\n'),
        ],
        [
          '_bmad/tea/teams/default-party.csv',
          descriptor('_bmad/tea/teams/default-party.csv', 'name,displayName\n'),
        ],
      ]),
    )
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    await expect(service.selectAdvisors({ workflowKey: 'problem-solving' })).rejects.toMatchObject(
      {
        code: ThinkTankRuntimeErrorCode.PartyModeAdvisorSetUnavailable,
      },
    )
  })

  test('[P0][5.2-UNIT-003C][AC3] explains invalid team roster rows when the viable advisor set remains', async () => {
    const fileProvider = createFileProvider(
      new Set(),
      new Map([
        [
          '_bmad/bmm/teams/default-party.csv',
          descriptor(
            '_bmad/bmm/teams/default-party.csv',
            'name,displayName,path\n"unknown","Unknown",""\n"pm","John","bmad/bmm/agents/pm.md"\n"architect","Winston","bmad/bmm/agents/architect.md"\n',
          ),
        ],
      ]),
    )
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    const selection = await service.selectAdvisors({ workflowKey: 'problem-solving' })

    expect(selection.advisors).toHaveLength(3)
    expect(selection.omittedAdvisors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'unknown',
          displayName: 'Unknown',
          reason: expect.stringContaining('缺少批准的 agent 定义'),
        }),
      ]),
    )
    expect(selection.visibleSummary).toContain('已略过 Unknown')
  })

  test('[P1][5.2-UNIT-004][AC1,AC2] returns only scalar-safe metadata pointers and source hashes', async () => {
    const fileProvider = createFileProvider()
    const service = new ThinkTankPartyModeAdvisorPersonaService(
      fileProvider as never,
      new ThinkTankBrandMapperService(),
    )

    const selection = await service.selectAdvisors({ workflowKey: 'problem-solving' })
    const metadataValues = Object.values(selection.metadata)

    expect(
      metadataValues.every(
        (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value),
      ),
    ).toBe(true)
    expect(selection.metadata.party_mode_selected_advisor_source_paths).toContain(
      '_bmad/cis/agents/creative-problem-solver.md',
    )
    expect(selection.metadata.party_mode_selected_advisor_source_hashes).toContain('pm-source-hash')
    expect(JSON.stringify(selection.metadata)).not.toContain('<agent>')
    expect(JSON.stringify(selection.metadata)).not.toContain('activation')
  })
})
