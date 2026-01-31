/**
 * Test radar sources API with detailed error logging
 */

const http = require('http')

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOWM2MmI5Mi05NWU3LTQ1ZDQtOTdmMS1mMDYwM2ViMjQyZGMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiY29uc3VsdGFudCIsImlhdCI6MTc2OTYwMzY4NywiZXhwIjoxNzcwMjA4NDg3fQ.JIKD0Prbl9wJmM8yJ0TlUvMpmdONaVP9zo6bFj0rYMo'

console.log('Testing GET /api/admin/radar-sources')
console.log('Token:', token.substring(0, 50) + '...')

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/radar-sources',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

const req = http.request(options, (res) => {
  let data = ''

  console.log('\n=== Response ===')
  console.log('Status:', res.statusCode, res.statusMessage)
  console.log('Headers:', JSON.stringify(res.headers, null, 2))

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('\n=== Body ===')
    try {
      const json = JSON.parse(data)
      console.log(JSON.stringify(json, null, 2))

      if (json.message) {
        console.log('\n❌ Error:', json.message)
      }
      if (json.error) {
        console.log('Error details:', json.error)
      }
      if (json.stack) {
        console.log('Stack trace:', json.stack)
      }
    } catch (error) {
      console.log('Raw response:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message)
  console.error(error.stack)
})

req.end()
