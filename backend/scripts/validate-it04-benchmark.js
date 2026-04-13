#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')

const backendDir = path.resolve(__dirname, '..')
const dockerImage = process.env.CSAAS_IT04_BENCHMARK_IMAGE || 'postgres:15-alpine'
const dbName = process.env.CSAAS_IT04_BENCHMARK_DB || 'csaas_it04_benchmark'
const dbUser = process.env.CSAAS_IT04_BENCHMARK_USER || 'postgres'
const dbPassword = process.env.CSAAS_IT04_BENCHMARK_PASSWORD || 'postgres'
const timeoutMs = Number(process.env.CSAAS_IT04_BENCHMARK_TIMEOUT_MS || 60000)
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
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  })

  if (result.error) {
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

async function main() {
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
  const portResult = run('docker', ['port', containerId, '5432/tcp'], { capture: true })
  const dbPort = parseHostPort(portResult.stdout)
  const env = {
    DB_HOST: '127.0.0.1',
    DB_PORT: String(dbPort),
    DB_USERNAME: dbUser,
    DB_USER: dbUser,
    DB_PASSWORD: dbPassword,
    DB_DATABASE: dbName,
    DB_NAME: dbName,
    DATABASE_URL: `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${dbPort}/${dbName}`,
  }

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

  if (shouldBuild) {
    run(npmCommand(), ['run', 'build'], { env })
  }

  run(npmCommand(), ['run', 'migration:run'], { env })
  run(npmCommand(), ['run', 'seed:kg'], { env })
  run(npmCommand(), ['run', 'benchmark:it04'], { env })

  cleanup()
}

main().catch((error) => {
  console.error(error.message || error)
  cleanup()
  process.exit(1)
})
