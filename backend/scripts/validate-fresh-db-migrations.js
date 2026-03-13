#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')

const backendDir = path.resolve(__dirname, '..')
const dockerImage = process.env.CSAAS_MIGRATION_CHECK_IMAGE || 'postgres:15-alpine'
const dbName = process.env.CSAAS_MIGRATION_CHECK_DB || 'csaas_migration_check'
const dbUser = process.env.CSAAS_MIGRATION_CHECK_USER || 'postgres'
const dbPassword = process.env.CSAAS_MIGRATION_CHECK_PASSWORD || 'postgres'
const timeoutMs = Number(process.env.CSAAS_MIGRATION_CHECK_TIMEOUT_MS || 60000)
const shouldBuild = process.argv.includes('--build')

let containerId = null

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function run(command, args, options = {}) {
  const {
    cwd = backendDir,
    env = {},
    capture = false,
    allowFailure = false,
  } = options

  console.log(`$ ${command} ${args.join(' ')}`)

  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.error) {
    if (command === 'docker') {
      const errorCode = result.error.code ? ` (${result.error.code})` : ''
      throw new Error(
        `Docker is unavailable or permission denied${errorCode}. Start Docker or run this script on a host with Docker access.`,
      )
    }

    throw result.error
  }

  if (!allowFailure && result.status !== 0) {
    if (capture) {
      if (result.stdout) {
        process.stdout.write(result.stdout)
      }
      if (result.stderr) {
        process.stderr.write(result.stderr)
      }
    }

    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }

  return result
}

function parseHostPort(output) {
  const match = output.trim().match(/:(\d+)\s*$/)
  if (!match) {
    throw new Error(`Unable to parse Docker port mapping: ${output}`)
  }

  return Number(match[1])
}

function cleanup() {
  if (!containerId) {
    return
  }

  run('docker', ['rm', '-f', containerId], { capture: true, allowFailure: true })
  containerId = null
}

function registerCleanup() {
  const handleExit = (code) => {
    cleanup()
    process.exit(code)
  }

  process.on('SIGINT', () => handleExit(130))
  process.on('SIGTERM', () => handleExit(143))
  process.on('uncaughtException', (error) => {
    console.error(error)
    handleExit(1)
  })
}

function printHelp() {
  console.log(`
Usage:
  npm run migration:check:fresh
  npm run migration:check:fresh -- --build

Environment overrides:
  CSAAS_MIGRATION_CHECK_IMAGE
  CSAAS_MIGRATION_CHECK_DB
  CSAAS_MIGRATION_CHECK_USER
  CSAAS_MIGRATION_CHECK_PASSWORD
  CSAAS_MIGRATION_CHECK_TIMEOUT_MS
`)
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp()
    return
  }

  registerCleanup()

  console.log('Starting fresh database migration validation')
  run('docker', ['version'], { capture: true })

  const createResult = run(
    'docker',
    [
      'run',
      '-d',
      '--rm',
      '-e',
      `POSTGRES_USER=${dbUser}`,
      '-e',
      `POSTGRES_PASSWORD=${dbPassword}`,
      '-e',
      `POSTGRES_DB=${dbName}`,
      '-p',
      '127.0.0.1::5432',
      dockerImage,
    ],
    { capture: true, cwd: path.resolve(backendDir, '..') },
  )

  containerId = createResult.stdout.trim()
  if (!containerId) {
    throw new Error('Failed to start temporary postgres container')
  }

  const portResult = run('docker', ['port', containerId, '5432/tcp'], { capture: true })
  const dbPort = parseHostPort(portResult.stdout)

  console.log(`Temporary postgres container: ${containerId}`)
  console.log(`Temporary postgres port: ${dbPort}`)

  const readyDeadline = Date.now() + timeoutMs
  while (Date.now() < readyDeadline) {
    const ready = run(
      'docker',
      ['exec', containerId, 'pg_isready', '-U', dbUser, '-d', dbName],
      { capture: true, allowFailure: true },
    )

    if (ready.status === 0) {
      break
    }

    sleep(1000)
  }

  const finalReadyCheck = run(
    'docker',
    ['exec', containerId, 'pg_isready', '-U', dbUser, '-d', dbName],
    { capture: true, allowFailure: true },
  )

  if (finalReadyCheck.status !== 0) {
    throw new Error(`Temporary postgres did not become ready within ${timeoutMs}ms`)
  }

  const migrationEnv = {
    DB_HOST: '127.0.0.1',
    DB_PORT: String(dbPort),
    DB_USERNAME: dbUser,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_DATABASE: dbName,
    DB_NAME: dbName,
    DATABASE_URL: `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${dbPort}/${dbName}`,
  }

  if (shouldBuild) {
    run(npmCommand(), ['run', 'build'], { env: migrationEnv })
  }

  run(npmCommand(), ['run', 'migration:run'], { env: migrationEnv })

  const migrationCount = run(
    'docker',
    ['exec', containerId, 'psql', '-U', dbUser, '-d', dbName, '-tAc', 'SELECT COUNT(*) FROM migrations'],
    { capture: true },
  ).stdout.trim()

  console.log(`Applied migrations on fresh DB: ${migrationCount}`)
  console.log('Fresh database migration validation passed')

  cleanup()
}

main().catch((error) => {
  console.error(error.message || error)
  cleanup()
  process.exit(1)
})
