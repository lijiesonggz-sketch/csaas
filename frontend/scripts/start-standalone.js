const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const standaloneServer = path.join(__dirname, '..', '.next', 'standalone', 'server.js')
const nextCli = path.join(__dirname, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next')

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

if (!process.env.PORT) {
  process.env.PORT = '3001'
}

function fallbackToNextStart(reason) {
  console.warn(
    `Standalone startup failed (${reason}). Falling back to \`next start\` for local runtime compatibility.`,
  )

  const child = spawn(process.execPath, [nextCli, 'start', '-p', process.env.PORT], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

if (!fs.existsSync(standaloneServer)) {
  fallbackToNextStart('missing standalone server')
} else {
  try {
    require(standaloneServer)
  } catch (error) {
    fallbackToNextStart(error instanceof Error ? error.message : 'unknown error')
  }
}
