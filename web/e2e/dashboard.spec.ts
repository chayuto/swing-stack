import { test, expect } from '@playwright/test'

// Structural assertions only: the suite runs against whatever exports
// are seeded in data/, so it checks shape and behavior, not exact
// telemetry values.

async function statValue(page: import('@playwright/test').Page, key: string): Promise<number> {
  const text = await page.getByTestId(`stat-${key}`).getByTestId('stat-value').innerText()
  return Number(text)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('stat-tiles')).toBeVisible({ timeout: 15_000 })
})

test('auto-login lands on a populated dashboard', async ({ page }) => {
  expect(await statValue(page, 'shots')).toBeGreaterThan(0)
  expect(await statValue(page, 'sessions')).toBeGreaterThan(0)
  await expect(page.getByTestId('session-user')).toContainText('@')
})

test('dispersion fan plots shot dots with a legend', async ({ page }) => {
  const dots = page.getByTestId('fan-dot')
  expect(await dots.count()).toBeGreaterThan(0)
  await expect(page.getByTestId('fan-legend')).toBeVisible()

  await dots.first().hover()
  await expect(page.getByTestId('fan-tooltip')).toBeVisible()
  await expect(page.getByTestId('fan-tooltip')).toContainText('m')
})

test('charts and club table render', async ({ page }) => {
  await expect(page.getByTestId('trajectory-chart')).toBeVisible()
  await expect(page.getByTestId('gapping-chart')).toBeVisible()
  const rows = page.getByTestId('club-row')
  expect(await rows.count()).toBeGreaterThan(0)
})

test('toggling a club chip removes its shots from the stat tiles', async ({ page }) => {
  const chips = page.getByTestId('filter-club')
  const chipCount = await chips.count()
  test.skip(chipCount < 2, 'needs at least two club chips')

  const total = await statValue(page, 'shots')
  const firstChip = chips.first()
  const chipShots = Number(await firstChip.locator('.count').innerText())

  await firstChip.click()
  await expect(firstChip).toHaveAttribute('aria-pressed', 'false')
  expect(await statValue(page, 'shots')).toBe(total - chipShots)

  await firstChip.click()
  expect(await statValue(page, 'shots')).toBe(total)
})

test('session filter narrows to one session', async ({ page }) => {
  const select = page.getByTestId('filter-session')
  const optionCount = await select.locator('option').count()
  test.skip(optionCount < 2, 'needs at least one session')

  await select.selectOption({ index: 1 })
  expect(await statValue(page, 'sessions')).toBe(1)
})

test('metric toggle switches the fan to total distance', async ({ page }) => {
  await page.getByTestId('metric-total').click()
  await expect(page.getByTestId('metric-total')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('metric-carry')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('range-fan')).toContainText('total')
  expect(await page.getByTestId('fan-dot').count()).toBeGreaterThan(0)
})

test('theme toggle stamps an explicit theme', async ({ page }) => {
  const toggle = page.getByTestId('theme-toggle')
  await toggle.click() // auto -> light
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await toggle.click() // light -> dark
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
