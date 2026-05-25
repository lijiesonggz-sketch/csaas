/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')

const appRoot = path.join(__dirname, '..')
const nextRoot = path.join(appRoot, '.next')
const standaloneRoot = path.join(nextRoot, 'standalone')
const standaloneServer = path.join(standaloneRoot, 'server.js')

if (!fs.existsSync(standaloneServer)) {
  console.error(
    'Missing frontend/.next/standalone/server.js. Run `npm run build` before `npm start`.'
  )
  process.exit(1)
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

if (!process.env.PORT) {
  process.env.PORT = '3001'
}

function copyDirectoryIfNeeded(source, destination) {
  if (!fs.existsSync(source)) return

  fs.rmSync(destination, { force: true, recursive: true })
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(source, destination, { recursive: true })
}

copyDirectoryIfNeeded(path.join(nextRoot, 'static'), path.join(standaloneRoot, '.next', 'static'))
copyDirectoryIfNeeded(path.join(appRoot, 'public'), path.join(standaloneRoot, 'public'))

require(standaloneServer)
