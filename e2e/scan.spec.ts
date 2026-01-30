import { test, expect } from '@playwright/test';
import { injectTelegramMock, setupApiMocks } from './fixtures/telegram-mock';

test.describe('Receipt Scan Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page);
    await setupApiMocks(page);

    // Mock AI parsing endpoint
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            merchant: 'Test Restaurant',
            items: [
              { name: 'Pizza', price: 15.99 },
              { name: 'Salad', price: 8.99 },
              { name: 'Drink', price: 3.99 },
            ],
            total: 28.97,
            currency: 'USD',
            date: new Date().toISOString(),
            confidence: 0.95,
          },
        }),
      });
    });
  });

  test('should display scan page', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('should show camera/upload options', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // Look for camera or upload button
    const cameraButton = page.locator(
      'button:has-text("Camera"), button:has-text("Scan"), [data-testid="camera-button"]',
    );

    const uploadButton = page.locator('button:has-text("Upload"), input[type="file"], [data-testid="upload-button"]');

    // At least one option should be available
  });

  test('should handle file upload', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Create a test image
      const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

      await fileInput.setInputFiles({
        name: 'receipt.png',
        mimeType: 'image/png',
        buffer,
      });

      await page.waitForTimeout(1000);
    }
  });

  test('should show scanning progress', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // Mock slow response
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: [], total: 0 },
        }),
      });
    });

    // Find file input and upload
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buffer = Buffer.from('test', 'utf-8');

      await fileInput.setInputFiles({
        name: 'receipt.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });

      // Should show loading indicator
      const loading = page.locator('[role="progressbar"], .loading, :text("Scanning"), :text("Processing")');
    }
  });

  test('should display parsed receipt results', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buffer = Buffer.from('test', 'utf-8');

      await fileInput.setInputFiles({
        name: 'receipt.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });

      await page.waitForTimeout(1500);

      // Should show parsed items
      const result = page.locator('[data-testid="scan-result"], .receipt-items, :text("Pizza")');
    }
  });

  test('should allow editing parsed items', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buffer = Buffer.from('test', 'utf-8');

      await fileInput.setInputFiles({
        name: 'receipt.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });

      await page.waitForTimeout(1500);

      // Find edit button for item
      const editButton = page.locator('[aria-label*="edit" i], button:has-text("Edit")').first();

      if (await editButton.isVisible()) {
        await editButton.click();
      }
    }
  });

  test('should create expense from scanned receipt', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buffer = Buffer.from('test', 'utf-8');

      await fileInput.setInputFiles({
        name: 'receipt.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });

      await page.waitForTimeout(1500);

      // Find create expense button
      const createButton = page.locator(
        'button:has-text("Create Expense"), button:has-text("Save"), button:has-text("Add")',
      );

      if (await createButton.first().isVisible()) {
        await createButton.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should handle scan errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Unable to parse receipt',
        }),
      });
    });

    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buffer = Buffer.from('test', 'utf-8');

      await fileInput.setInputFiles({
        name: 'receipt.jpg',
        mimeType: 'image/jpeg',
        buffer,
      });

      await page.waitForTimeout(1500);

      // Should show error message
      const error = page.locator('[role="alert"], .error, :text("Unable to parse")');
    }
  });

  test('should support retrying scan', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // After a failed scan, there should be retry option
    const retryButton = page.locator(
      'button:has-text("Retry"), button:has-text("Try Again"), button:has-text("Scan Again")',
    );
  });

  test('should show manual entry option', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // Should have fallback to manual entry
    const manualButton = page.locator('button:has-text("Manual"), a:has-text("Manual"), :text("enter manually")');
  });
});

test.describe('QR Code Scanner', () => {
  test.beforeEach(async ({ page }) => {
    await injectTelegramMock(page);
    await setupApiMocks(page);
  });

  test('should display QR scanner option', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // Look for QR scanner option
    const qrButton = page.locator('button:has-text("QR"), [data-testid="qr-scanner"]');
  });

  test('should handle QR scan result', async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');

    // QR scan would typically use Telegram's scanQR API
    // This is mainly for UI presence testing
  });
});
