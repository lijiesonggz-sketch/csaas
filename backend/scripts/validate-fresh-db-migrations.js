#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')
const { Client } = require('pg')

const backendDir = path.resolve(__dirname, '..')
const dockerImage = process.env.CSAAS_MIGRATION_CHECK_IMAGE || 'postgres:15-alpine'
const dbNamePrefix = process.env.CSAAS_MIGRATION_CHECK_DB || 'csaas_migration_check'
const dbUser = process.env.CSAAS_MIGRATION_CHECK_USER || 'postgres'
const dbPassword = process.env.CSAAS_MIGRATION_CHECK_PASSWORD || 'postgres'
const dbHost = process.env.CSAAS_MIGRATION_CHECK_HOST || process.env.DB_HOST || '127.0.0.1'
const dbPort = Number(process.env.CSAAS_MIGRATION_CHECK_PORT || process.env.DB_PORT || 5432)
const adminDbName = process.env.CSAAS_MIGRATION_CHECK_ADMIN_DB || 'postgres'
const timeoutMs = Number(process.env.CSAAS_MIGRATION_CHECK_TIMEOUT_MS || 60000)
const shouldBuild = process.argv.includes('--build')
const useExistingDb = process.argv.includes('--existing-db')
const dbName = useExistingDb
  ? `${dbNamePrefix}_${Date.now()}`
  : dbNamePrefix

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
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
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

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

async function waitForExistingPostgres() {
  const deadline = Date.now() + timeoutMs
  let lastError = null

  while (Date.now() < deadline) {
    const client = new Client({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: adminDbName,
    })

    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch (error) {
      lastError = error
      try {
        await client.end()
      } catch {}
      sleep(1000)
    }
  }

  throw new Error(
    `Existing postgres did not become ready within ${timeoutMs}ms (${lastError?.message || 'unknown error'})`,
  )
}

async function withFreshExistingDatabase(callback) {
  const adminClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: adminDbName,
  })

  await adminClient.connect()

  try {
    await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbName)}`)
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`)

    try {
      return await callback()
    } finally {
      await adminClient.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      )
      await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbName)}`)
    }
  } finally {
    await adminClient.end()
  }
}

function runDockerMigrationCheck() {
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
  const dockerDbPort = parseHostPort(portResult.stdout)

  console.log(`Temporary postgres container: ${containerId}`)
  console.log(`Temporary postgres port: ${dockerDbPort}`)

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
    DB_PORT: String(dockerDbPort),
    DB_USERNAME: dbUser,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_DATABASE: dbName,
    DB_NAME: dbName,
    DATABASE_URL: `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${dockerDbPort}/${dbName}`,
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

async function runExistingDbMigrationCheck() {
  console.log('Starting fresh database migration validation against existing PostgreSQL')
  console.log(`Existing postgres target: ${dbHost}:${dbPort}/${adminDbName}`)
  console.log(`Temporary database name: ${dbName}`)

  await waitForExistingPostgres()

  await withFreshExistingDatabase(async () => {
    const migrationEnv = {
      DB_HOST: dbHost,
      DB_PORT: String(dbPort),
      DB_USERNAME: dbUser,
      DB_USER: dbUser,
      DB_PASSWORD: dbPassword,
      DB_DATABASE: dbName,
      DB_NAME: dbName,
      DATABASE_URL: `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
    }

    if (shouldBuild) {
      run(npmCommand(), ['run', 'build'], { env: migrationEnv })
    }

    run(npmCommand(), ['run', 'migration:run'], { env: migrationEnv })

    const client = new Client({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    })

    await client.connect()
    try {
      const result = await client.query('SELECT COUNT(*)::int AS count FROM migrations')
      console.log(`Applied migrations on fresh DB: ${result.rows[0].count}`)
      console.log('Fresh database migration validation passed')
    } finally {
      await client.end()
    }
  })
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
  npm run migration:check:fresh -- --existing-db
  npm run migration:check:fresh -- --existing-db --build

Environment overrides:
  CSAAS_MIGRATION_CHECK_IMAGE
  CSAAS_MIGRATION_CHECK_DB
  CSAAS_MIGRATION_CHECK_USER
  CSAAS_MIGRATION_CHECK_PASSWORD
  CSAAS_MIGRATION_CHECK_HOST
  CSAAS_MIGRATION_CHECK_PORT
  CSAAS_MIGRATION_CHECK_ADMIN_DB
  CSAAS_MIGRATION_CHECK_TIMEOUT_MS
`)
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp()
    return
  }

  registerCleanup()

  if (useExistingDb) {
    await runExistingDbMigrationCheck()
    return
  }

  runDockerMigrationCheck()
}

main().catch((error) => {
  console.error(error.message || error)
  cleanup()
  process.exit(1)
})
