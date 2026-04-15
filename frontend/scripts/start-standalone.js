const fs = require('fs')
const path = require('path')

const standaloneServer = path.join(__dirname, '..', '.next', 'standalone', 'server.js')

if (!fs.existsSync(standaloneServer)) {
  console.error(
    'Missing frontend/.next/standalone/server.js. Run `npm run build` before `npm start`.',
  )
  process.exit(1)
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production'
}

if (!process.env.PORT) {
  process.env.PORT = '3001'
}

require(standaloneServer)
