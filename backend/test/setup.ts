/**
 * E2E Test Setup
 *
 * Load test environment variables before running E2E tests
 */

// Load test environment variables
const path = require('path')
const dotenv = require('dotenv')

// Load .env.test file
const envPath = path.join(__dirname, '..', '.env.test')
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.warn('Warning: .env.test file not found, using default test config')
  // Set minimal test config
  process.env.DB_DATABASE = 'csaas_test'
  process.env.NODE_ENV = 'test'
}

console.log(`Test Environment: ${process.env.NODE_ENV}`)
console.log(`Test Database: ${process.env.DB_DATABASE}`)
