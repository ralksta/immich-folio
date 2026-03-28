import { test, expect } from '@playwright/test';
import { resolve } from 'path';

test('Verify Lightbox Focus Management', async ({ page }) => {
  // Use a known public subpage that has photos
  const GRID_URL = '/deutschland/kloster-chorin-2024';

  // Start coverage/tracing if needed, or just go to the page
  await page.goto(`http://localhost:3000${GRID_URL}`);

  // Wait for the grid to load
  const grid = page.locator('.photo-grid');
  await expect(grid).toBeVisible();

  // Open the first image in the lightbox
  const firstItem = grid.locator('.photo-grid__item').first();
  await firstItem.click();

  // Wait for the lightbox to appear
  const lightbox = page.locator('div[role="dialog"]');
  await expect(lightbox).toBeVisible();

  // The close button should be focused
  const closeButton = lightbox.locator('button[aria-label="Close"]');
  await expect(closeButton).toBeFocused();

  // Take a screenshot of the lightbox
  await page.screenshot({ path: '/home/jules/verification/lightbox-focus.png' });
});
