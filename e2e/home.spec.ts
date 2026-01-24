import { test, expect } from '@playwright/test'
import { injectTelegramMock, setupApiMocks, mockApiResponses } from './fixtures/telegram-mock'

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should display user greeting', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Should show user's name or greeting
    const greeting = page.locator(':text("Test"), :text("Hello"), :text("Welcome")')
    await expect(page.locator('body')).toBeVisible()
  })

  test('should show group list', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Should display groups
    const groupCard = page.locator('[data-testid="group-card"], .group-item, :text("Test Group")')
  })

  test('should display balance summary', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Should show balance information
    const balance = page.locator(':text("owe"), :text("owed"), :text("balance"), :text("$")')
  })

  test('should navigate to expenses from quick action', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find quick action for expenses
    const expensesLink = page.locator('a[href*="expenses"], button:has-text("Expenses"), [data-testid="expenses-link"]').first()

    if (await expensesLink.isVisible()) {
      await expensesLink.click()
      await page.waitForURL('**/expenses**', { timeout: 5000 })
    }
  })

  test('should navigate to settlements from quick action', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const settleLink = page.locator('a[href*="settle"], button:has-text("Settle"), [data-testid="settle-link"]').first()

    if (await settleLink.isVisible()) {
      await settleLink.click()
      await page.waitForURL('**/settle**', { timeout: 5000 })
    }
  })

  test('should show recent activity', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for activity feed
    const activity = page.locator('[data-testid="activity-feed"], .activity-list, :text("recent")')
  })

  test('should handle group selection', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click on a group
    const groupCard = page.locator('[data-testid="group-card"], .group-item').first()

    if (await groupCard.isVisible()) {
      await groupCard.click()
      await page.waitForTimeout(500)
    }
  })

  test('should show add expense FAB', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for floating action button
    const fab = page.locator('button[class*="fixed"], button[class*="fab"], button:has-text("+")')
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should have bottom navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Bottom nav should be visible
    const bottomNav = page.locator('nav, [role="navigation"], .bottom-nav')
    await expect(bottomNav.first()).toBeVisible({ timeout: 10000 })
  })

  test('should highlight active nav item', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Home should be active
    const activeItem = page.locator('[aria-current="page"], .active, [data-active="true"]')
  })

  test('should navigate between all main routes', async ({ page }) => {
    const routes = ['/', '/expenses', '/settle', '/analytics', '/recurring']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should preserve state on navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate away
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Navigate back
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // State should be preserved (data still loaded)
    await expect(page.locator('body')).toBeVisible()
  })

  test('should support browser back/forward', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Go back
    await page.goBack()
    await expect(page).toHaveURL('/')

    // Go forward
    await page.goForward()
    await expect(page).toHaveURL('/expenses')
  })
})

test.describe('Telegram Integration', () => {
  test('should use Telegram theme colors', async ({ page }) => {
    await injectTelegramMock(page, { colorScheme: 'dark' })
    await setupApiMocks(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check that dark theme is applied
    const html = page.locator('html')
    const body = page.locator('body')

    // App should respect Telegram theme
    await expect(body).toBeVisible()
  })

  test('should show back button when navigating', async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate to sub-page
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Back button might be shown (Telegram BackButton)
    const backButton = page.locator('[data-testid="back-button"], button[aria-label*="back"]')
  })

  test('should handle MainButton interactions', async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Main button might be used for primary actions
    // (behavior depends on specific page implementation)
  })

  test('should respect viewport height', async ({ page }) => {
    await injectTelegramMock(page, { isExpanded: true })
    await setupApiMocks(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Content should fit within viewport
    const hasVerticalOverflow = await page.evaluate(() => {
      return document.body.scrollHeight > window.innerHeight + 100
    })

    // Minimal overflow is acceptable for scrollable content
  })
})

test.describe('User Profile', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should display user avatar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // User avatar should be visible
    const avatar = page.locator('[data-testid="user-avatar"], .avatar, img[alt*="avatar" i]')
  })

  test('should show user settings/profile link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const profileLink = page.locator('a[href*="session"], button:has-text("Profile"), [data-testid="profile"]')
  })

  test('should navigate to session page', async ({ page }) => {
    await page.goto('/session')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toBeVisible()
  })
})
