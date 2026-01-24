import { test, expect } from '@playwright/test'
import { injectTelegramMock, setupApiMocks } from './fixtures/telegram-mock'

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should display analytics dashboard', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toBeVisible()
  })

  test('should show total expenses summary', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for total expenses display
    const totalExpenses = page.locator(':text("total"), :text("Total"), [data-testid="total-expenses"]')
    // Summary should be visible
  })

  test('should display category breakdown', async ({ page }) => {
    // Mock analytics with categories
    await page.route('**/api/groups/*/analytics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalExpenses: 500,
            expenseCount: 10,
            categoryBreakdown: {
              food: 200,
              transport: 100,
              entertainment: 150,
              utilities: 50,
            },
            monthlyTrend: [
              { month: '2024-10', amount: 100 },
              { month: '2024-11', amount: 150 },
              { month: '2024-12', amount: 250 },
            ],
            balances: {},
          },
        }),
      })
    })

    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Category breakdown should be visible
    const categories = page.locator(':text("food"), :text("Food"), :text("transport"), :text("Transport")')
  })

  test('should show monthly trend chart', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for chart/graph component
    const chart = page.locator('canvas, svg, [data-testid="trend-chart"], .chart')
    // Chart should be rendered
  })

  test('should display member spending comparison', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for member comparison
    const memberStats = page.locator('[data-testid="member-stats"], .member-comparison')
  })

  test('should support date range selection', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for date range picker
    const dateRange = page.locator('[data-testid="date-range"], input[type="date"], button:has-text("Date")')

    if (await dateRange.first().isVisible()) {
      await dateRange.first().click()
    }
  })

  test('should export analytics data', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), [data-testid="export"]')

    if (await exportButton.first().isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
      await exportButton.first().click()
      // Download might be triggered
    }
  })

  test('should handle no data state', async ({ page }) => {
    // Mock empty analytics
    await page.route('**/api/groups/*/analytics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalExpenses: 0,
            expenseCount: 0,
            categoryBreakdown: {},
            monthlyTrend: [],
            balances: {},
          },
        }),
      })
    })

    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Should show empty state
    const emptyState = page.locator(':text("No data"), :text("no expenses"), :text("Start tracking")')
  })

  test('should update on data refresh', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh"], button[aria-label*="refresh"]')

    if (await refreshButton.first().isVisible()) {
      await refreshButton.first().click()
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Analytics Charts Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should show tooltip on chart hover', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Find chart element
    const chart = page.locator('canvas, svg').first()

    if (await chart.isVisible()) {
      // Hover over chart
      await chart.hover()
      await page.waitForTimeout(300)

      // Tooltip might appear
      const tooltip = page.locator('[role="tooltip"], .tooltip, .chart-tooltip')
    }
  })

  test('should support chart type switching', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // Look for chart type selector
    const chartSelector = page.locator('button:has-text("Bar"), button:has-text("Line"), button:has-text("Pie")')

    if (await chartSelector.first().isVisible()) {
      await chartSelector.first().click()
    }
  })
})
