import { test, expect } from '@playwright/test'

test.describe('Enterprise End-to-End User Journeys', () => {
  test.describe('1. Onboarding Journey', () => {
    test('unauthenticated users are redirected from onboarding to login', async ({
      page,
    }) => {
      await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login.*next=%2Fdashboard%2Fonboarding/)
    })

    test('onboarding setup page enforces authentication gate', async ({
      page,
    }) => {
      await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded' })
      await expect(page.url()).toContain('login')
    })
  })

  test.describe('2. Discovery Journey', () => {
    test('unauthenticated users are redirected from discover deck to login', async ({
      page,
    }) => {
      await page.goto('/dashboard/discover', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login.*next=%2Fdashboard%2Fdiscover/)
    })

    test('public discovery browse page loads correctly', async ({ page }) => {
      await page.goto('/browse', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveTitle(/Connect/)
    })
  })

  test.describe('3. Matching Journey', () => {
    test('unauthenticated users are redirected from matches to login', async ({
      page,
    }) => {
      await page.goto('/dashboard/matches', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login.*next=%2Fdashboard%2Fmatches/)
    })

    test('connections page is protected behind authentication gate', async ({
      page,
    }) => {
      await page.goto('/dashboard/connections', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login.*next=%2Fdashboard%2Fconnections/)
    })
  })

  test.describe('4. Messaging Journey', () => {
    test('unauthenticated users are redirected from chat inbox to login', async ({
      page,
    }) => {
      await page.goto('/dashboard/chat', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login.*next=%2Fdashboard%2Fchat/)
    })

    test('direct thread access redirects unauthenticated users to login', async ({
      page,
    }) => {
      await page.goto('/dashboard/chat/00000000-0000-4000-8000-000000000001', {
        waitUntil: 'domcontentloaded',
      })
      await expect(page).toHaveURL(
        /login.*next=%2Fdashboard%2Fchat%2F00000000-0000-4000-8000-000000000001/,
      )
    })
  })

  test.describe('5. Event RSVP Journey', () => {
    test('public events directory page loads upcoming events heading', async ({
      page,
    }) => {
      await page.goto('/events', { waitUntil: 'domcontentloaded' })
      await expect(
        page.getByRole('heading', { name: 'Upcoming events' }),
      ).toBeVisible()
    })

    test('public event search page loads search heading and controls', async ({
      page,
    }) => {
      await page.goto('/events/search', { waitUntil: 'domcontentloaded' })
      await expect(
        page.getByRole('heading', { name: 'Search events' }),
      ).toBeVisible()
    })

    test('event detail page renders navigation and detail container', async ({
      page,
    }) => {
      await page.goto('/events/00000000-0000-4000-8000-000000000001', {
        waitUntil: 'domcontentloaded',
      })
      const backLink = page.getByRole('link', { name: /back to events/i })
      await expect(backLink).toBeVisible()
    })
  })

  test.describe('Full Sequential User Journey', () => {
    test('executes multi-stage user journey across onboarding, discovery, matching, messaging, and event RSVP', async ({
      page,
    }) => {
      // Step 1: Onboarding Gate
      await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login/)

      // Step 2: Discovery Gate
      await page.goto('/dashboard/discover', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login/)

      // Step 3: Matching Gate
      await page.goto('/dashboard/matches', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login/)

      // Step 4: Messaging Gate
      await page.goto('/dashboard/chat', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/login/)

      // Step 5: Event RSVP Journey
      await page.goto('/events', { waitUntil: 'domcontentloaded' })
      await expect(
        page.getByRole('heading', { name: 'Upcoming events' }),
      ).toBeVisible()

      await page.goto('/events/search', { waitUntil: 'domcontentloaded' })
      await expect(
        page.getByRole('heading', { name: 'Search events' }),
      ).toBeVisible()
    })
  })
})
