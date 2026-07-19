import { test, expect } from '@playwright/test'

// Exercises the human auth lane end to end: sign out revokes the
// session client-side and the login form mints a fresh JWT pair.

test('sign out and log back in through the login form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stat-tiles')).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('sign-out').click()
  await expect(page.getByTestId('login-panel')).toBeVisible()

  await page.getByLabel('Email').fill('demo@swing-stack.dev')
  await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD ?? 'demo-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByTestId('stat-tiles')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('session-user')).toContainText('demo@swing-stack.dev')
})

test('wrong password shows an error and stays on the form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stat-tiles')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('sign-out').click()

  await page.getByLabel('Email').fill('demo@swing-stack.dev')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('login-panel')).toBeVisible()
})
