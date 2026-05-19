import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { Inject, Injectable, Optional } from '@nestjs/common'
import { THINKTANK_RUNTIME_FILE_PROVIDER_OPTIONS } from './runtime.constants'
import { ThinkTankRuntimeError, ThinkTankRuntimeErrorCode } from './runtime.errors'
import {
  ThinkTankRuntimeFileDescriptor,
  ThinkTankRuntimeFileExtension,
  ThinkTankRuntimeFileProviderOptions,
} from './runtime.types'

const DEFAULT_APPROVED_ROOTS = [
  '_bmad/core/skills',
  '_bmad/core/tasks',
  '_bmad/cis/workflows',
  '_bmad/bmm/workflows',
  '_bmad/cis/agents',
  '_bmad/bmm/agents',
  '_bmad/_config',
]

const DEFAULT_SUPPORTED_EXTENSIONS: ThinkTankRuntimeFileExtension[] = [
  '.md',
  '.yaml',
  '.yml',
  '.csv',
]

const toPosixPath = (value: string) => value.replace(/\\/g, '/')

const resolveDefaultRepoRoot = () => {
  let current = resolve(process.cwd())

  while (true) {
    if (existsSync(resolve(current, '_bmad'))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return resolve(process.cwd())
    }

    current = parent
  }
}

@Injectable()
export class ThinkTankRuntimeFileProviderService {
  private readonly repoRoot: string
  private readonly approvedRoots: string[]
  private readonly supportedExtensions: Set<ThinkTankRuntimeFileExtension>

  constructor(
    @Optional()
    @Inject(THINKTANK_RUNTIME_FILE_PROVIDER_OPTIONS)
    options?: ThinkTankRuntimeFileProviderOptions,
  ) {
    this.repoRoot = resolve(options?.repoRoot ?? resolveDefaultRepoRoot())
    this.approvedRoots = (options?.approvedRoots ?? DEFAULT_APPROVED_ROOTS).map((root) =>
      toPosixPath(root).replace(/\/+$/, ''),
    )
    this.supportedExtensions = new Set(options?.supportedExtensions ?? DEFAULT_SUPPORTED_EXTENSIONS)
  }

  async load(sourcePath: string): Promise<ThinkTankRuntimeFileDescriptor> {
    const { absolutePath, repoRelative } = this.resolveRepositoryRelativePath(sourcePath)

    if (!this.isWithinApprovedRoot(repoRelative)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime file path is outside approved ThinkTank source roots',
        { sourcePath: repoRelative },
      )
    }

    const extension = extname(repoRelative).toLowerCase() as ThinkTankRuntimeFileExtension
    if (!this.supportedExtensions.has(extension)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.UnsupportedExtension,
        `Runtime file extension is not supported: ${extension || '(none)'}`,
        { sourcePath: repoRelative, details: { extension } },
      )
    }

    let linkStats
    let fileStats
    try {
      linkStats = await lstat(absolutePath)
      fileStats = await stat(absolutePath)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      throw new ThinkTankRuntimeError(
        code === 'ENOENT'
          ? ThinkTankRuntimeErrorCode.FileNotFound
          : ThinkTankRuntimeErrorCode.FileUnreadable,
        code === 'ENOENT'
          ? 'Runtime source file was not found'
          : 'Runtime source file is unreadable',
        { sourcePath: repoRelative, cause: error },
      )
    }

    if (linkStats.isSymbolicLink()) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime source file may not be a symbolic link',
        { sourcePath: repoRelative },
      )
    }

    if (!fileStats.isFile()) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileUnreadable,
        'Runtime source path must point to a file',
        { sourcePath: repoRelative },
      )
    }

    const realRepoRoot = await realpath(this.repoRoot)
    const realAbsolutePath = await realpath(absolutePath)
    const realApprovedRoots = await this.resolveExistingApprovedRoots()

    if (!this.isWithinRealApprovedRoot(realAbsolutePath, realApprovedRoots, realRepoRoot)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime source file resolves outside approved ThinkTank source roots',
        { sourcePath: repoRelative },
      )
    }

    let content: string
    try {
      content = await readFile(absolutePath, 'utf8')
    } catch (error) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileUnreadable,
        'Runtime source file could not be read',
        { sourcePath: repoRelative, cause: error },
      )
    }

    if (content.trim().length === 0) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.EmptyFile,
        'Runtime source file is empty',
        { sourcePath: repoRelative },
      )
    }

    return {
      relativePath: repoRelative,
      absolutePath,
      content,
      contentHash: createHash('sha256').update(content).digest('hex'),
      extension,
      modifiedAt: new Date(fileStats.mtime.getTime()),
    }
  }

  async exists(sourcePath: string): Promise<boolean> {
    try {
      await this.load(sourcePath)
      return true
    } catch (error) {
      if (
        error instanceof ThinkTankRuntimeError &&
        error.code === ThinkTankRuntimeErrorCode.FileNotFound
      ) {
        return false
      }

      throw error
    }
  }

  async listWorkflowFiles(): Promise<string[]> {
    const roots = this.approvedRoots.filter((root) => root.endsWith('/workflows'))
    const files: string[] = []

    for (const root of roots) {
      const absoluteRoot = resolve(this.repoRoot, root)
      if (!existsSync(absoluteRoot)) continue

      for (const file of await this.listFilesUnderRoot(absoluteRoot)) {
        if (
          file.endsWith('/workflow.md') ||
          file.endsWith('/workflow.yaml') ||
          file.endsWith('/workflow.yml') ||
          file.endsWith('/workflow.csv')
        ) {
          files.push(file)
        }
      }
    }

    return files.sort()
  }

  async listCsvFiles(relativeRoot: string): Promise<string[]> {
    const { absolutePath: absoluteRoot, repoRelative } =
      this.resolveRepositoryRelativePath(relativeRoot)
    const normalizedRoot = repoRelative.replace(/\/+$/, '')

    if (!this.isWithinApprovedRoot(normalizedRoot)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime CSV listing root is outside approved ThinkTank source roots',
        { sourcePath: relativeRoot },
      )
    }

    if (!existsSync(absoluteRoot)) return []

    const realRepoRoot = await realpath(this.repoRoot)
    const realAbsoluteRoot = await realpath(absoluteRoot)
    const realApprovedRoots = await this.resolveExistingApprovedRoots()

    if (!this.isWithinRealApprovedRoot(realAbsoluteRoot, realApprovedRoots, realRepoRoot)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime CSV listing root resolves outside approved ThinkTank source roots',
        { sourcePath: normalizedRoot },
      )
    }

    return (await this.listFilesUnderRoot(absoluteRoot))
      .filter((file) => file.endsWith('.csv'))
      .sort()
  }

  private resolveRepositoryRelativePath(sourcePath: string) {
    const normalizedInput = toPosixPath((sourcePath ?? '').trim())

    if (!normalizedInput || normalizedInput.includes('\0')) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime file path must be a non-empty repository-relative path',
        { sourcePath },
      )
    }

    if (isAbsolute(sourcePath)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime file path must be repository-relative',
        { sourcePath },
      )
    }

    const absolutePath = resolve(this.repoRoot, normalizedInput)
    const repoRelative = toPosixPath(relative(this.repoRoot, absolutePath))

    if (repoRelative.startsWith('../') || repoRelative === '..' || isAbsolute(repoRelative)) {
      throw new ThinkTankRuntimeError(
        ThinkTankRuntimeErrorCode.FileOutsideApprovedRoot,
        'Runtime file path escapes the repository root',
        { sourcePath },
      )
    }

    return { absolutePath, repoRelative }
  }

  private isWithinApprovedRoot(relativePath: string) {
    return this.approvedRoots.some(
      (root) => relativePath === root || relativePath.startsWith(`${root}/`),
    )
  }

  private async resolveExistingApprovedRoots() {
    const roots: string[] = []

    for (const root of this.approvedRoots) {
      const absoluteRoot = resolve(this.repoRoot, root)
      if (existsSync(absoluteRoot)) {
        roots.push(await realpath(absoluteRoot))
      }
    }

    return roots
  }

  private isWithinRealApprovedRoot(
    realAbsolutePath: string,
    realApprovedRoots: string[],
    realRepoRoot: string,
  ) {
    const repoRelative = toPosixPath(relative(realRepoRoot, realAbsolutePath))
    if (repoRelative.startsWith('../') || repoRelative === '..' || isAbsolute(repoRelative)) {
      return false
    }

    return realApprovedRoots.some((root) => {
      const rootRelative = toPosixPath(relative(root, realAbsolutePath))
      return rootRelative === '' || (!rootRelative.startsWith('../') && !isAbsolute(rootRelative))
    })
  }

  private async listFilesUnderRoot(absoluteRoot: string): Promise<string[]> {
    const entries = await readdir(absoluteRoot, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const absoluteEntry = resolve(absoluteRoot, entry.name)
      if (entry.isSymbolicLink()) continue

      if (entry.isDirectory()) {
        files.push(...(await this.listFilesUnderRoot(absoluteEntry)))
      } else if (entry.isFile()) {
        files.push(toPosixPath(relative(this.repoRoot, absoluteEntry)))
      }
    }

    return files
  }
}
