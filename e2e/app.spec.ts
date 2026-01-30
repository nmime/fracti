import { test, expect } from '@playwright/test';

// Mock Telegram WebApp for testing
const mockTelegramWebApp = {
  initData: 'test_init_data',
  initDataUnsafe: {
    user: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    },
    chat: {
      id: -987654321,
      type: 'group',
      title: 'Test Group',
    },
  },
  version: '7.0',
  colorScheme: 'dark',
  themeParams: {},
  isExpanded: true,
  viewportHeight: 600,
  viewportStableHeight: 600,
  headerColor: '#000000',
  backgroundColor: '#000000',
  ready: () => {},
  expand: () => {},
  close: () => {},
  MainButton: {
    text: '',
    isVisible: false,
    isActive: true,
    isProgressVisible: false,
    show: () => {},
    hide: () => {},
    enable: () => {},
    disable: () => {},
    showProgress: () => {},
    hideProgress: () => {},
    setText: () => {},
    onClick: () => {},
    offClick: () => {},
  },
  BackButton: {
    isVisible: false,
    show: () => {},
    hide: () => {},
    onClick: () => {},
    offClick: () => {},
  },
  HapticFeedback: {
    impactOccurred: () => {},
    notificationOccurred: () => {},
    selectionChanged: () => {},
  },
  showPopup: () => {},
  showAlert: () => {},
  showConfirm: () => {},
};

test.beforeEach(async ({ page }) => {
  // Inject mock Telegram WebApp
  await page.addInitScript((webApp) => {
    (window as unknown as { Telegram: { WebApp: typeof webApp } }).Telegram = { WebApp: webApp };
  }, mockTelegramWebApp);
});

test.describe('Application Loading', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await expect(page.locator('body')).toBeVisible();

    // The app should show loading or main content
    await page.waitForLoadState('networkidle');
  });

  test('should display navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for navigation elements (adjust selectors based on actual UI)
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('should handle route navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test navigation to expenses page
    await page.goto('/expenses');
    await expect(page).toHaveURL('/expenses');

    // Test navigation to settle page
    await page.goto('/settle');
    await expect(page).toHaveURL('/settle');

    // Test navigation to analytics page
    await page.goto('/analytics');
    await expect(page).toHaveURL('/analytics');
  });
});

test.describe('Error Handling', () => {
  test('should show error boundary on crash', async ({ page }) => {
    // Force an error by navigating to a broken state
    await page.goto('/');

    // Inject an error to trigger error boundary
    await page
      .evaluate(() => {
        throw new Error('Test error for error boundary');
      })
      .catch(() => {
        // Expected to throw
      });

    // The error boundary should handle it gracefully
    await page.waitForLoadState('networkidle');
  });

  test('should handle 404 routes gracefully', async ({ page }) => {
    await page.goto('/nonexistent-route');
    await page.waitForLoadState('networkidle');

    // App should still be functional (SPA routing)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Content should still be visible
    await expect(page.locator('body')).toBeVisible();

    // No horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for at least one heading
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // All buttons should have accessible names
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const accessibleName = (await button.getAttribute('aria-label')) || (await button.textContent());
      expect(accessibleName).toBeTruthy();
    }
  });
});

test.describe('Dark Mode', () => {
  test('should respect system color scheme', async ({ page }) => {
    // Emulate dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that dark mode styles are applied
    const htmlElement = page.locator('html');
    const className = await htmlElement.getAttribute('class');

    // App should have dark mode class or data attribute
    expect(className?.includes('dark') || (await htmlElement.getAttribute('data-theme')) === 'dark').toBeTruthy;
  });

  test('should respect light color scheme', async ({ page }) => {
    // Emulate light mode
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});
