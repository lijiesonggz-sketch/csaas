const http = require('http')

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOWM2MmI5Mi05NWU3LTQ1ZDQtOTdmMS1mMDYwM2ViMjQyZGMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiY29uc3VsdGFudCIsImlhdCI6MTc2OTYwMzY4NywiZXhwIjoxNzcwMjA4NDg3fQ.JIKD0Prbl9wJmM8yJ0TlUvMpmdONaVP9zo6bFj0rYMo'

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

console.log('Testing:', `http://${options.hostname}:${options.port}${options.path}`)

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('Status:', res.statusCode)
    console.log('Headers:', res.headers)
    console.log('Response:')

    try {
      const json = JSON.parse(data)
      console.log(JSON.stringify(json, null, 2))
    } catch (error) {
      console.log('Raw response:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('Request failed:', error.message)
})

req.end()
