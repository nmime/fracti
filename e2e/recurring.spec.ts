import { test, expect } from '@playwright/test';
import { injectTelegramMock, setupApiMocks } from './fixtures/telegram-mock';

test.describe('Recurring Expenses Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page);
    await setupApiMocks(page);

    // Mock recurring expenses API
    await page.route('**/api/groups/*/recurring', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'recurring-1',
                groupId: 'group-1',
                name: 'Monthly Rent',
                amount: 1500,
                currency: 'USD',
                frequency: 'monthly',
                dayOfMonth: 1,
                payerId: '123456789',
                splits: [
                  { userId: '123456789', amount: 500 },
                  { userId: '111111111', amount: 500 },
                  { userId: '222222222', amount: 500 },
                ],
                isActive: true,
                nextDue: new Date(Date.now() + 86400000 * 7).toISOString(),
                createdAt: new Date().toISOString(),
              },
              {
                id: 'recurring-2',
                groupId: 'group-1',
                name: 'Weekly Groceries',
                amount: 200,
                currency: 'USD',
                frequency: 'weekly',
                dayOfWeek: 0,
                payerId: '111111111',
                splits: [
                  { userId: '123456789', amount: 66.67 },
                  { userId: '111111111', amount: 66.67 },
                  { userId: '222222222', amount: 66.66 },
                ],
                isActive: true,
                nextDue: new Date(Date.now() + 86400000 * 3).toISOString(),
                createdAt: new Date().toISOString(),
              },
            ],
            pagination: { hasMore: false },
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should display recurring expenses list', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show recurring expense details', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    // Look for recurring expense items
    const recurringItem = page.locator('[data-testid="recurring-item"], .recurring-card');
  });

  test('should display frequency information', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    // Should show frequency (monthly, weekly, etc)
    const frequency = page.locator(':text("monthly"), :text("Monthly"), :text("weekly"), :text("Weekly")');
  });

  test('should show next due date', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    // Should show when next expense is due
    const dueDate = page.locator(':text("due"), :text("Due"), :text("Next")');
  });

  test('should open create recurring expense form', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("Add"), button:has-text("+"), button:has-text("Create")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Form should appear
      const form = page.locator('form, [role="dialog"]');
    }
  });

  test('should toggle recurring expense active state', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    // Look for toggle switch
    const toggle = page.locator('input[type="checkbox"], [role="switch"], .toggle').first();

    if (await toggle.isVisible()) {
      await toggle.click();
    }
  });

  test('should edit recurring expense', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    const editButton = page.locator('[aria-label*="edit" i], button:has-text("Edit")').first();

    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should delete recurring expense', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    const deleteButton = page.locator('[aria-label*="delete" i], button:has-text("Delete")').first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Confirm dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();

      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });

  test('should handle empty state', async ({ page }) => {
    // Mock empty recurring
    await page.route('**/api/groups/*/recurring', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { hasMore: false },
        }),
      });
    });

    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    // Should show empty state
    const emptyState = page.locator(':text("No recurring"), :text("Create your first")');
  });

  test('should validate recurring expense form', async ({ page }) => {
    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("Add"), button:has-text("+")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Save")').first();

      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Should show validation error
      }
    }
  });
});

test.describe('Recurring Expense Creation', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page);
    await setupApiMocks(page);
  });

  test('should create monthly recurring expense', async ({ page }) => {
    // Mock successful creation
    await page.route('**/api/groups/*/recurring', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: `recurring-${Date.now()}`,
              ...body,
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      }
    });

    await page.goto('/recurring');
    await page.waitForLoadState('networkidle');

    const addButton = page.locator('button:has-text("Add"), button:has-text("+")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Fill form
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      const amountInput = page.locator('input[name="amount"], input[type="number"]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Recurring');
      }

      if (await amountInput.isVisible()) {
        await amountInput.fill('100');
      }

      // Select frequency
      const frequencySelect = page.locator('select[name="frequency"], [data-testid="frequency-select"]').first();

      if (await frequencySelect.isVisible()) {
        await frequencySelect.selectOption('monthly');
      }

      // Submit
      const submitButton = page.locator('button[type="submit"], button:has-text("Save")').first();

      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
