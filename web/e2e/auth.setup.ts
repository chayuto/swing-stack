import { test as setup, expect } from '@playwright/test'

// Logs in once and saves the token pair (localStorage) as storageState
// for every other test. Keeps the suite to a single POST /auth/login,
// well inside the backend's 10/min credential throttle.

setup('authenticate as demo user', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stat-tiles')).toBeVisible({ timeout: 20_000 })
  await page.context().storageState({ path: 'playwright/.auth/user.json' })
})
