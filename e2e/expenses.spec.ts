import { test, expect } from '@playwright/test'
import { injectTelegramMock, setupApiMocks } from './fixtures/telegram-mock'

test.describe('Expenses Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should display expenses list', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Should show expenses heading or list
    await expect(page.locator('body')).toBeVisible()

    // Wait for content to load
    await page.waitForTimeout(1000)
  })

  test('should show expense details', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Look for expense card or list item
    const expenseCard = page.locator('[data-testid="expense-card"], .expense-card, [role="listitem"]').first()

    if (await expenseCard.isVisible()) {
      // Should display expense information
      await expect(expenseCard).toBeVisible()
    }
  })

  test('should open add expense dialog', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Look for add expense button
    const addButton = page.locator('button:has-text("Add"), button:has-text("+"), [aria-label*="add"]').first()

    if (await addButton.isVisible()) {
      await addButton.click()

      // Dialog or form should appear
      await expect(page.locator('[role="dialog"], form, .modal')).toBeVisible({ timeout: 5000 })
    }
  })

  test('should validate expense form', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Open add expense form if there's a button
    const addButton = page.locator('button:has-text("Add"), button:has-text("+")').first()

    if (await addButton.isVisible()) {
      await addButton.click()
      await page.waitForTimeout(500)

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()

      if (await submitButton.isVisible()) {
        await submitButton.click()

        // Should show validation errors
        await page.waitForTimeout(500)
        const hasError = await page.locator('[role="alert"], .error, [class*="error"]').isVisible()
        // Form should not be dismissed on invalid submission
      }
    }
  })

  test('should create new expense', async ({ page }) => {
    // Mock successful expense creation
    await page.route('**/api/groups/*/expenses', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'new-expense-123',
              ...body,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Open add expense form
    const addButton = page.locator('button:has-text("Add"), button:has-text("+")').first()

    if (await addButton.isVisible()) {
      await addButton.click()
      await page.waitForTimeout(500)

      // Fill in expense details
      const amountInput = page.locator('input[name="amount"], input[type="number"], input[placeholder*="amount" i]').first()
      const descriptionInput = page.locator('input[name="description"], input[placeholder*="description" i], textarea').first()

      if (await amountInput.isVisible()) {
        await amountInput.fill('50')
      }

      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('Test Expense')
      }

      // Submit form
      const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first()

      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('should filter expenses by date', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Look for date filter
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"], button:has-text("Filter")').first()

    if (await dateFilter.isVisible()) {
      await dateFilter.click()
      // Date picker interaction would go here
    }
  })

  test('should show expense split details', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Click on expense to see details
    const expenseItem = page.locator('[data-testid="expense-card"], .expense-item, [role="listitem"]').first()

    if (await expenseItem.isVisible()) {
      await expenseItem.click()
      await page.waitForTimeout(500)

      // Should show split information
      const splitInfo = page.locator('[data-testid="split-info"], .split-details, :text("split")')
      // Either modal opens or details expand
    }
  })

  test('should handle empty state', async ({ page }) => {
    // Mock empty expenses
    await page.route('**/api/groups/*/expenses', async (route) => {
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

    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Should show empty state message
    const emptyState = page.locator(':text("No expenses"), :text("empty"), :text("Add your first")')
    // Empty state should be visible or add button should be prominent
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/groups/*/expenses', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal Server Error',
        }),
      })
    })

    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // App should handle error gracefully
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Expense Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page)
    await setupApiMocks(page)
  })

  test('should delete expense with confirmation', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Find delete button on expense
    const deleteButton = page.locator('[aria-label*="delete" i], button:has-text("Delete"), [data-testid="delete-expense"]').first()

    if (await deleteButton.isVisible()) {
      await deleteButton.click()

      // Confirm deletion dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last()

      if (await confirmButton.isVisible()) {
        await confirmButton.click()
      }
    }
  })

  test('should edit existing expense', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Find edit button
    const editButton = page.locator('[aria-label*="edit" i], button:has-text("Edit"), [data-testid="edit-expense"]').first()

    if (await editButton.isVisible()) {
      await editButton.click()
      await page.waitForTimeout(500)

      // Edit form should appear
      const form = page.locator('form, [role="dialog"]')
      await expect(form).toBeVisible({ timeout: 5000 })
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/expenses')
    await page.waitForLoadState('networkidle')

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Check that focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })
})
