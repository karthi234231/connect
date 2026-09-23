import { test, expect } from '@playwright/test'

test.describe('Core user flows', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Connect/)
  })

  test('login page accessible', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Welcome to Connect' }),
    ).toBeVisible()
  })

  test('public event search works', async ({ page }) => {
    await page.goto('/events/search', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Search events' }),
    ).toBeVisible()
  })

  test('dashboard redirects unauthenticated to login', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/login/)
  })

  test('discover redirects unauthenticated to login with next', async ({
    page,
  }) => {
    await page.goto('/dashboard/discover', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/login.*next=%2Fdashboard%2Fdiscover/)
  })

  test('login page carries the OAuth entry point', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('button', { name: /linkedin/i }),
    ).toBeVisible()
  })
})