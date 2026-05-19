import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import { ThinkTankRuntimeFileProviderService } from './runtime-file-provider.service'

const repoRoot = resolve(__dirname, '../../../../..')

describe('ThinkTankRuntimeFileProviderService', () => {
  let tempRoot: string | null = null

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = null
    }
  })

  it('loads approved BMAD runtime files as typed descriptors with stable hashes', async () => {
    const service = new ThinkTankRuntimeFileProviderService({ repoRoot })

    const descriptor = await service.load('_bmad/core/skills/bmad-brainstorming/workflow.md')

    expect(descriptor).toMatchObject({
      relativePath: '_bmad/core/skills/bmad-brainstorming/workflow.md',
      extension: '.md',
    })
    expect(descriptor.absolutePath.replace(/\\/g, '/')).toContain(
      '/_bmad/core/skills/bmad-brainstorming/workflow.md',
    )
    expect(descriptor.content).toContain('Brainstorming Session Workflow')
    expect(descriptor.contentHash).toBe(
      createHash('sha256').update(descriptor.content).digest('hex'),
    )
    expect(descriptor.modifiedAt).toBeInstanceOf(Date)
  })

  it('fails closed when a relative path escapes approved roots', async () => {
    const service = new ThinkTankRuntimeFileProviderService({ repoRoot })

    await expect(service.load('../package.json')).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
    })
    await expect(
      service.load(join(repoRoot, '_bmad/core/skills/bmad-brainstorming/workflow.md')),
    ).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
    })
    await expect(service.load('backend/package.json')).rejects.toBeInstanceOf(ThinkTankRuntimeError)
  })

  it('fails closed when CSV listing roots normalize outside approved roots', async () => {
    const service = new ThinkTankRuntimeFileProviderService({ repoRoot })

    await expect(service.listCsvFiles('_bmad/core/skills/../../../backend')).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
    })
  })

  it('fails closed when an approved path resolves through a symlink outside approved roots', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-runtime-symlink-'))
    const outsideRoot = await mkdtemp(join(tmpdir(), 'thinktank-runtime-outside-'))
    const approvedParent = join(tempRoot, '_bmad/core')
    const outsideSkills = join(outsideRoot, 'skills')
    await mkdir(approvedParent, { recursive: true })
    await mkdir(join(outsideSkills, 'demo'), { recursive: true })
    await writeFile(join(outsideSkills, 'demo/workflow.md'), '# External BMAD Workflow', 'utf8')

    try {
      await symlink(outsideSkills, join(approvedParent, 'skills'), 'junction')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        await rm(outsideRoot, { recursive: true, force: true })
        throw new Error('Symlink capability is required to verify runtime root containment')
      }
      throw error
    }

    const service = new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot })
    await expect(service.load('_bmad/core/skills/demo/workflow.md')).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
    })
    await rm(outsideRoot, { recursive: true, force: true })
  })

  it('returns stable operational errors for missing, unsupported, and empty files', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'thinktank-runtime-'))
    const approvedRoot = join(tempRoot, '_bmad/core/skills/demo')
    await mkdir(approvedRoot, { recursive: true })
    await writeFile(join(approvedRoot, 'unsupported.exe'), 'not a runtime asset', 'utf8')
    await writeFile(join(approvedRoot, 'empty.md'), '   \n\t', 'utf8')

    const service = new ThinkTankRuntimeFileProviderService({ repoRoot: tempRoot })

    await expect(service.load('_bmad/core/skills/demo/missing.md')).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.FileNotFound,
    })
    await expect(service.load('_bmad/core/skills/demo/unsupported.exe')).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.UnsupportedExtension,
    })
    await expect(service.load('_bmad/core/skills/demo/empty.md')).rejects.toMatchObject({
      code: ThinkTankRuntimeErrorCode.EmptyFile,
    })
  })

  it('does not expose raw filesystem causes on operational errors', async () => {
    const service = new ThinkTankRuntimeFileProviderService({ repoRoot })

    await expect(service.load('_bmad/core/skills/bmad-brainstorming/missing.md')).rejects.toEqual(
      expect.not.objectContaining({
        cause: expect.anything(),
      }),
    )
  })
})
