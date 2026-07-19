import { defineConfig, devices } from '@playwright/test'

// Agent-first E2E setup: `npx playwright test` boots the full stack
// (Rails API with seeded dev DB + Vite) and runs headless. Failures
// leave a trace and screenshot in test-results/ for non-interactive
// debugging (`npx playwright trace <trace.zip>` or show-report).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'bash -c "bin/rails db:prepare db:seed > /dev/null && bin/rails server -p 3000"',
      cwd: '..',
      url: 'http://localhost:3000/up',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
