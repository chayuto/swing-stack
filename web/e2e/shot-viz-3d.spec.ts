import { test, expect } from '@playwright/test'

// The 3D view (golf-shot-viz) opens on the current filter selection,
// renders a WebGL canvas, and plays a replay. Structural checks only.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stat-tiles')).toBeVisible({ timeout: 15_000 })
})

test('opens from the filter bar, replays, and closes', async ({ page }) => {
  await page.getByTestId('open-3d').click()

  const overlay = page.getByTestId('shot-viz-3d')
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(overlay).toContainText(/\d+ shots/)

  await page.getByTestId('play-volley').click()
  await expect(page.getByRole('button', { name: 'Studio' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByTestId('close-3d').click()
  await expect(overlay).not.toBeVisible()
})

test('closes on Escape', async ({ page }) => {
  await page.getByTestId('open-3d').click()
  await expect(page.getByTestId('shot-viz-3d')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shot-viz-3d')).not.toBeVisible()
})
