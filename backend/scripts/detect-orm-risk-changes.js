#!/usr/bin/env node

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')
const EMPTY_SHA = '0000000000000000000000000000000000000000'
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const ORM_RISK_EXIT_CODE = 10
const gitExecutable = resolveGitExecutable()

function resolveGitExecutable() {
  if (process.env.GIT_BINARY) {
    return process.env.GIT_BINARY
  }

  if (process.platform !== 'win32') {
    return 'git'
  }

  const windowsCandidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe'),
    process.env['ProgramFiles(x86)'] &&
      path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe'),
    'git.exe',
  ].filter(Boolean)

  const existingCandidate = windowsCandidates.find((candidate) => candidate.endsWith('.exe') && fs.existsSync(candidate))

  return existingCandidate || 'git.exe'
}

function runGit(args) {
  return execFileSync(gitExecutable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function parseArgs(argv) {
  const args = {
    mode: null,
    base: null,
    head: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--staged') {
      args.mode = 'staged'
      continue
    }

    if (token === '--pre-push') {
      args.mode = 'pre-push'
      continue
    }

    if (token === '--base') {
      args.base = argv[index + 1]
      index += 1
      continue
    }

    if (token === '--head') {
      args.head = argv[index + 1]
      index += 1
      continue
    }
  }

  if (!args.mode && args.base && args.head) {
    args.mode = 'range'
  }

  return args
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('')
      return
    }

    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data)
    })
  })
}

function normalizeLines(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function getDefaultRemoteBaseRef() {
  try {
    return runGit(['symbolic-ref', 'refs/remotes/origin/HEAD'])
  } catch {
    return null
  }
}

function resolveNewBranchBase(localSha) {
  const defaultRemoteBaseRef = getDefaultRemoteBaseRef()

  if (defaultRemoteBaseRef) {
    try {
      return runGit(['merge-base', localSha, defaultRemoteBaseRef])
    } catch {
      // Fall through to the empty tree when the default branch is unavailable.
    }
  }

  return EMPTY_TREE_SHA
}

function getDiffPayloadForStagedChanges() {
  return collectDiffPayload([
    {
      label: 'staged',
      diffArgs: ['diff', '--cached'],
    },
  ])
}

function getDiffPayloadForRange(base, head, label = `${base}..${head}`) {
  return collectDiffPayload([
    {
      label,
      diffArgs: ['diff', base, head],
    },
  ])
}

function getDiffPayloadForPrePushRefs(refPayload) {
  const ranges = []

  for (const line of normalizeLines(refPayload)) {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/)

    if (!localSha || localSha === EMPTY_SHA) {
      continue
    }

    const base = !remoteSha || remoteSha === EMPTY_SHA ? resolveNewBranchBase(localSha) : remoteSha
    const label =
      !remoteSha || remoteSha === EMPTY_SHA
        ? `${localRef} (new branch)`
        : `${remoteRef || 'remote'}..${localRef || 'local'}`

    ranges.push({
      label,
      diffArgs: ['diff', base, localSha],
    })
  }

  if (ranges.length === 0) {
    return {
      files: [],
      diffText: '',
      labels: ['pre-push'],
    }
  }

  return collectDiffPayload(ranges)
}

function collectDiffPayload(ranges) {
  const fileSet = new Set()
  const diffChunks = []
  const labels = []

  for (const range of ranges) {
    labels.push(range.label)

    const nameOnlyOutput = runGit([
      ...range.diffArgs,
      '--name-only',
      '--diff-filter=ACMR',
      '--',
      'backend',
    ])

    for (const filePath of normalizeLines(nameOnlyOutput)) {
      fileSet.add(filePath)
    }

    const diffOutput = runGit([...range.diffArgs, '--unified=0', '--no-color', '--', 'backend'])
    if (diffOutput) {
      diffChunks.push(diffOutput)
    }
  }

  return {
    files: Array.from(fileSet).sort((left, right) => left.localeCompare(right)),
    diffText: diffChunks.join('\n'),
    labels,
  }
}

function analyzeRisk(files, diffText) {
  const reasons = []

  const pathRules = [
    {
      regex: /^backend\/src\/database\/entities\//,
      message: '实体目录发生改动',
    },
    {
      regex: /^backend\/src\/database\/migrations\//,
      message: '数据库 migration 发生改动',
    },
    {
      regex: /^backend\/src\/config\/database\.config\.ts$/,
      message: 'runtime TypeORM 配置发生改动',
    },
    {
      regex: /^backend\/src\/config\/typeorm\.config\.ts$/,
      message: 'script TypeORM 配置发生改动',
    },
    {
      regex: /^backend\/src\/config\/typeorm\.entities\.ts$/,
      message: '唯一实体清单发生改动',
    },
    {
      regex: /^backend\/src\/app\.module\.ts$/,
      message: 'AppModule 启动 wiring 发生改动',
    },
  ]

  for (const rule of pathRules) {
    const matchedFiles = files.filter((filePath) => rule.regex.test(filePath))
    if (matchedFiles.length > 0) {
      reasons.push(`${rule.message}: ${formatMatchedFiles(matchedFiles)}`)
    }
  }

  const changedLines = diffText
    .split(/\r?\n/)
    .filter((line) => /^(?:\+|-)(?!\+\+\+|---)/.test(line))
    .map((line) => line.slice(1))
    .join('\n')

  if (/@(?:OneToOne|OneToMany|ManyToOne|ManyToMany)\b/.test(changedLines)) {
    reasons.push('diff 中出现 relation decorator 变更')
  }

  if (/TypeOrmModule\.forFeature\s*\(/.test(changedLines)) {
    reasons.push('diff 中出现 TypeOrmModule.forFeature(...) 变更')
  }

  return reasons
}

function formatMatchedFiles(filePaths) {
  const previewLimit = 5
  if (filePaths.length <= previewLimit) {
    return filePaths.join(', ')
  }

  const preview = filePaths.slice(0, previewLimit).join(', ')
  return `${preview} ... (+${filePaths.length - previewLimit} more)`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.mode) {
    console.error(
      'Usage: node backend/scripts/detect-orm-risk-changes.js --staged | --pre-push | --base <sha> --head <sha>',
    )
    process.exit(1)
  }

  let payload
  if (args.mode === 'staged') {
    payload = getDiffPayloadForStagedChanges()
  } else if (args.mode === 'pre-push') {
    payload = getDiffPayloadForPrePushRefs(await readStdin())
  } else {
    payload = getDiffPayloadForRange(args.base, args.head)
  }

  const reasons = analyzeRisk(payload.files, payload.diffText)
  const contextLabel = payload.labels.join(', ')

  if (reasons.length === 0) {
    console.log(`[orm:risk] no high-risk ORM changes detected (${contextLabel})`)
    console.log(`[orm:risk] inspected backend files: ${payload.files.length}`)
    process.exit(0)
  }

  console.log(`[orm:risk] high-risk ORM changes detected (${contextLabel})`)
  console.log(`[orm:risk] inspected backend files: ${payload.files.length}`)
  for (const reason of reasons) {
    console.log(`- ${reason}`)
  }
  process.exit(ORM_RISK_EXIT_CODE)
}

main().catch((error) => {
  console.error('[orm:risk] detection failed')
  console.error(error)
  process.exit(1)
})
