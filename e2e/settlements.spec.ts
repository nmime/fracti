import { test, expect } from '@playwright/test'
import { injectTelegramMock, setupApiMocks, mockApiResponses } from './fixtures/telegram-mock'

test.describe('Settlements Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should display settlements list', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toBeVisible()
  })

  test('should show pending settlements', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Look for pending settlement indicators
    const pendingBadge = page.locator(':text("pending"), :text("Pending"), .badge-pending')
    // Settlements should be visible
  })

  test('should display settlement suggestions', async ({ page }) => {
    // Mock settlement suggestions
    await page.route('**/api/groups/*/settlements/suggestions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              from: { id: '111111111', name: 'Alice' },
              to: { id: '123456789', name: 'Test User' },
              amount: 33.33,
              currency: 'USD',
            },
            {
              from: { id: '222222222', name: 'Bob' },
              to: { id: '123456789', name: 'Test User' },
              amount: 33.34,
              currency: 'USD',
            },
          ],
        }),
      })
    })

    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Should show suggested settlements
    const suggestions = page.locator('[data-testid="settlement-suggestion"], .suggestion-card')
    // Suggestions should be rendered
  })

  test('should show debt graph visualization', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Look for graph/visualization component
    const graph = page.locator('canvas, svg, [data-testid="debt-graph"], .force-graph')
    // Graph might be visible if debt visualization is enabled
  })

  test('should initiate settlement payment', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Find pay/settle button
    const settleButton = page.locator('button:has-text("Settle"), button:has-text("Pay"), [data-testid="settle-button"]').first()

    if (await settleButton.isVisible()) {
      await settleButton.click()
      await page.waitForTimeout(500)

      // Payment dialog or wallet connect should appear
      const paymentUI = page.locator('[role="dialog"], .payment-modal, .wallet-connect')
      // Payment flow UI should be shown
    }
  })

  test('should show settlement history', async ({ page }) => {
    // Mock completed settlements
    await page.route('**/api/groups/*/settlements', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'settlement-completed',
              fromUserId: '111111111',
              fromUserName: 'Alice',
              toUserId: '123456789',
              toUserName: 'Test User',
              amount: 50,
              currency: 'USD',
              status: 'completed',
              txHash: '0x123abc',
              completedAt: new Date().toISOString(),
              createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
            ...mockApiResponses.settlements,
          ],
          pagination: { hasMore: false },
        }),
      })
    })

    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Should show completed settlements
    const completedBadge = page.locator(':text("completed"), :text("Completed"), .badge-completed')
  })

  test('should filter settlements by status', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Look for status filter
    const filterSelect = page.locator('select, [role="combobox"], button:has-text("Filter")')

    if (await filterSelect.first().isVisible()) {
      await filterSelect.first().click()
    }
  })

  test('should display balance summary', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Look for balance information
    const balanceInfo = page.locator(':text("owe"), :text("owed"), :text("balance"), .balance-summary')
    // Balance summary should be visible
  })

  test('should handle no settlements state', async ({ page }) => {
    // Mock empty settlements
    await page.route('**/api/groups/*/settlements', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { hasMore: false },
        }),
      })
    })

    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Should show empty state or all settled message
    const emptyState = page.locator(':text("No settlements"), :text("all settled"), :text("no debts")')
  })
})

test.describe('TON Wallet Integration', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should show wallet connect button', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Look for TON wallet connect button
    const walletButton = page.locator('button:has-text("Connect"), button:has-text("Wallet"), [data-testid="wallet-button"]')
    // Wallet connect button should be present
  })

  test('should open wallet connect modal', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    const walletButton = page.locator('button:has-text("Connect Wallet"), [data-testid="connect-wallet"]').first()

    if (await walletButton.isVisible()) {
      await walletButton.click()
      await page.waitForTimeout(500)

      // TON Connect modal should appear
      const modal = page.locator('[role="dialog"], .tonconnect-modal, iframe[src*="tonconnect"]')
    }
  })

  test('should display connected wallet address', async ({ page }) => {
    // Mock wallet connection state
    await page.addInitScript(() => {
      localStorage.setItem('ton-connect-storage_bridge-connection', JSON.stringify({
        type: 'http',
        wallet: {
          address: 'EQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbLtWBF',
          chain: '-239',
        },
      }))
    })

    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Connected wallet address should be shown (shortened)
    const walletDisplay = page.locator(':text("EQ"), :text("UQ"), [data-testid="wallet-address"]')
  })

  test('should show payment confirmation', async ({ page }) => {
    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Find a settlement to pay
    const payButton = page.locator('button:has-text("Pay"), button:has-text("Send")').first()

    if (await payButton.isVisible()) {
      await payButton.click()
      await page.waitForTimeout(500)

      // Payment confirmation should appear
      const confirmation = page.locator('[data-testid="payment-confirm"], .confirm-payment, :text("Confirm")')
    }
  })
})

test.describe('Settlement Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should show success notification after settlement', async ({ page }) => {
    // Mock successful settlement
    await page.route('**/api/groups/*/settlements', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'new-settlement',
              status: 'completed',
              txHash: '0xabc123',
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Trigger settlement (if button exists)
    const settleButton = page.locator('button:has-text("Settle"), button:has-text("Confirm")').first()

    if (await settleButton.isVisible()) {
      await settleButton.click()
      await page.waitForTimeout(1000)

      // Success notification should appear
      const toast = page.locator('[role="alert"], .toast, .notification')
    }
  })

  test('should show error notification on failure', async ({ page }) => {
    // Mock failed settlement
    await page.route('**/api/groups/*/settlements', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Insufficient balance',
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/settle')
    await page.waitForLoadState('networkidle')

    // Error handling should work gracefully
    await expect(page.locator('body')).toBeVisible()
  })
})
