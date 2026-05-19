/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const net = require('net')

const nextDir = path.join(__dirname, '..', '.next')
const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force') || process.env.CSAAS_FORCE_CLEAN_NEXT === '1'
const devPort = Number(process.env.CSAAS_FRONTEND_DEV_PORT || 3001)

function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })
    const finish = (open) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(open)
    }

    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function readProcesses() {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress',
        ],
        { encoding: 'utf8', windowsHide: true }
      )
      if (!output.trim()) return []
      const parsed = JSON.parse(output)
      return Array.isArray(parsed) ? parsed : [parsed]
    }

    const output = execFileSync('ps', ['-eo', 'pid=,command='], { encoding: 'utf8' })
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [pid, ...commandParts] = line.split(/\s+/)
        return { ProcessId: Number(pid), CommandLine: commandParts.join(' ') }
      })
  } catch {
    return []
  }
}

function findRunningNextDevProcesses() {
  const frontendDir = path.resolve(__dirname, '..').toLowerCase()

  return readProcesses().filter((processInfo) => {
    const commandLine = String(processInfo.CommandLine || '')
    const normalized = commandLine.replace(/\\/g, '/').toLowerCase()
    const processId = Number(processInfo.ProcessId)

    if (!commandLine || processId === process.pid) return false
    if (!normalized.includes('next') || !normalized.includes(' dev')) return false
    if (normalized.includes('clean-next-cache')) return false

    return normalized.includes(frontendDir.replace(/\\/g, '/')) || normalized.includes('next dev')
  })
}

async function main() {
  if (!fs.existsSync(nextDir)) {
    console.log('No frontend/.next directory to clean.')
    return
  }

  const runningNextDevProcesses = findRunningNextDevProcesses()
  const devPortIsOpen =
    (await isPortOpen(devPort, '127.0.0.1')) || (await isPortOpen(devPort, '::1'))

  if ((runningNextDevProcesses.length > 0 || devPortIsOpen) && !force) {
    console.error('Refusing to remove frontend/.next while a Next dev server is running.')
    console.error(
      'Cleaning .next during next dev can leave the server serving stale HTML with missing chunks.'
    )
    if (runningNextDevProcesses.length > 0) {
      console.error(
        `Running dev process IDs: ${runningNextDevProcesses
          .map((processInfo) => processInfo.ProcessId)
          .join(', ')}`
      )
    }
    if (devPortIsOpen) {
      console.error(`Detected an active listener on localhost:${devPort}.`)
    }
    console.error(
      'Stop the dev server first, or set CSAAS_FORCE_CLEAN_NEXT=1 when you know it is safe.'
    )
    process.exitCode = 1
    return
  }

  if (dryRun) {
    console.log(`Would remove: ${nextDir}`)
    return
  }

  try {
    fs.rmSync(nextDir, { recursive: true, force: true })
    console.log(`Removed stale Next.js cache: ${nextDir}`)
  } catch (error) {
    console.error('Failed to clean frontend/.next cache.', error)
    process.exitCode = 1
  }
}

main()
