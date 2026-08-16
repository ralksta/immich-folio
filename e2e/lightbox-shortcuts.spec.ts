import { test, expect } from '@playwright/test';

/**
 * The shortcut panel is deliberately unadvertised: no button, no first-run
 * nudge. These pin both halves of that — the keys work, and nothing is on
 * screen until one of them is pressed.
 */
test.describe('Lightbox shortcuts', () => {
  const GRID_URL = '/deutschland/kloster-chorin';

  async function openLightbox(page: import('@playwright/test').Page) {
    await page.goto(GRID_URL);
    const item = page.locator('.photo-grid .photo-grid__item').first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }

  const panel = (page: import('@playwright/test').Page) => page.locator('#lightbox-shortcuts');

  test('nothing advertises the panel', async ({ page }) => {
    await openLightbox(page);
    await expect(panel(page)).toHaveCount(0);
    // The old trigger and its one-time nudge are gone for good.
    await expect(page.getByRole('button', { name: /keyboard shortcuts/i })).toHaveCount(0);
    await expect(page.getByText(/press \? for keyboard shortcuts/i)).toHaveCount(0);
  });

  test('? opens it and closes it again', async ({ page }) => {
    await openLightbox(page);
    await page.keyboard.press('?');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('?');
    await expect(panel(page)).toHaveCount(0);
  });

  test('h opens it too', async ({ page }) => {
    await openLightbox(page);
    await page.keyboard.press('h');
    await expect(panel(page)).toBeVisible();
  });

  test('Esc closes the panel before the viewer', async ({ page }) => {
    await openLightbox(page);
    await page.keyboard.press('h');
    await expect(panel(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
