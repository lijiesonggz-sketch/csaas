import baseConfig from './playwright.config'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  ...baseConfig,
  testDir: './e2e',
  projects: [
    {
      name: 'chrome-stable',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'edge-stable',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
})
