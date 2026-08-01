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

test('progress card plots the face angle trend with a readout', async ({ page }) => {
  await expect(page.getByTestId('trend-chart')).toBeVisible()
  await expect(page.getByTestId('trend-chart').locator('canvas')).toBeVisible()
  await expect(page.getByTestId('trend-metric')).toHaveValue('face_angle')
  await expect(page.getByTestId('trend-latest')).toContainText('°')
})

test('progress metric selector switches the trend', async ({ page }) => {
  await page.getByTestId('trend-metric').selectOption('carry')
  await expect(page.getByTestId('trend-hint')).toContainText('Airborne distance')
  await expect(page.getByTestId('trend-latest')).toContainText('m')
})

test('progress card shows a per-club legend for several clubs', async ({ page }) => {
  const chips = page.getByTestId('filter-club')
  test.skip((await chips.count()) < 2, 'needs at least two club chips')
  await expect(page.getByTestId('trend-legend')).toBeVisible()
})

test('session trends card renders all four panels with headline numbers', async ({ page }) => {
  await expect(page.getByTestId('session-trends')).toBeVisible()
  for (const key of ['carry', 'face', 'mishit', 'smash']) {
    await expect(page.getByTestId(`session-trend-${key}`).locator('canvas')).toBeVisible()
    await expect(page.getByTestId(`session-trend-${key}-latest`)).not.toBeEmpty()
  }
})

test('shot shape chart renders', async ({ page }) => {
  await expect(page.getByTestId('shot-shape-chart')).toBeVisible()
  await expect(page.getByTestId('shot-shape-chart').locator('canvas')).toBeVisible()
})

test('excluding a shot drops it from stats and restores on second click', async ({ page }) => {
  const shotsTile = page.getByTestId('stat-shots').getByTestId('stat-value')
  const before = Number(await shotsTile.innerText())
  // The owner may have excluded shots of their own, so count relative
  // and pick a dot that is not already excluded. nth() keeps the same
  // dot across re-renders, unlike a :not([data-excluded]) locator.
  const dots = page.getByTestId('fan-dot')
  const flags = await dots.evaluateAll((els) => els.map((el) => el.hasAttribute('data-excluded')))
  const dot = dots.nth(flags.indexOf(false))
  const hollow = page.locator('[data-testid="fan-dot"][data-excluded]')
  const hollowBefore = await hollow.count()

  // Exclude: the dot stays plotted but hollow, and the count drops.
  await dot.click()
  await expect(hollow).toHaveCount(hollowBefore + 1)
  await expect(page.getByTestId('excluded-note')).toBeVisible()
  await expect(shotsTile).toHaveText(String(before - 1))

  // Restore, so the suite leaves the seeded data untouched.
  await dot.click()
  await expect(hollow).toHaveCount(hollowBefore)
  await expect(shotsTile).toHaveText(String(before))
})

test('session grouping recolours the charts and adds interactive legends', async ({ page }) => {
  await page.getByTestId('group-by-session').click()
  await expect(page.getByTestId('group-by-session')).toHaveAttribute('aria-pressed', 'true')

  // Session legends replace or join the club legend.
  await expect(page.getByTestId('fan-session-legend')).toBeVisible()
  await expect(page.getByTestId('shape-session-legend')).toBeVisible()
  expect(await page.getByTestId('fan-dot').count()).toBeGreaterThan(0)

  // Hovering a session date dims every other session's dots.
  const entries = page.getByTestId('fan-session-legend').locator('.entry')
  if ((await entries.count()) >= 2) {
    await entries.first().hover()
    await expect(page.locator('[data-testid="fan-dot"][opacity="0.12"]').first()).toBeVisible()
  }

  // Back to club colours restores the club legend.
  await page.getByTestId('group-by-club').click()
  await expect(page.getByTestId('fan-legend')).toBeVisible()
  await expect(page.getByTestId('fan-session-legend')).toHaveCount(0)
})

test('theme toggle stamps an explicit theme', async ({ page }) => {
  const toggle = page.getByTestId('theme-toggle')
  await toggle.click() // auto -> light
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await toggle.click() // light -> dark
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
