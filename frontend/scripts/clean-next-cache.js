const fs = require('fs')
const path = require('path')

const nextDir = path.join(__dirname, '..', '.next')
const dryRun = process.argv.includes('--dry-run')

if (!fs.existsSync(nextDir)) {
  console.log('No frontend/.next directory to clean.')
  process.exit(0)
}

if (dryRun) {
  console.log(`Would remove: ${nextDir}`)
  process.exit(0)
}

try {
  fs.rmSync(nextDir, { recursive: true, force: true })
  console.log(`Removed stale Next.js cache: ${nextDir}`)
} catch (error) {
  console.error('Failed to clean frontend/.next cache.', error)
  process.exit(1)
}
