import { test, expect } from '@playwright/test';

/**
 * `f` is only worth having if it reaches the real Fullscreen API — a CSS
 * overlay already covered the viewport before this, and the whole point is the
 * browser chrome that CSS cannot touch. So these assert on
 * `document.fullscreenElement`, not on a class name.
 */
test.describe('Lightbox fullscreen', () => {
  const GRID_URL = '/deutschland/kloster-chorin';

  /** Open the first photo and wait for the viewer. */
  async function openLightbox(page: import('@playwright/test').Page) {
    await page.goto(GRID_URL);
    const item = page.locator('.photo-grid .photo-grid__item').first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }

  const fullscreenTag = (page: import('@playwright/test').Page) =>
    page.evaluate(() => document.fullscreenElement?.tagName ?? null);

  test('f enters fullscreen and f leaves it again', async ({ page }) => {
    await openLightbox(page);
    expect(await fullscreenTag(page)).toBeNull();

    await page.keyboard.press('f');
    await expect.poll(() => fullscreenTag(page)).toBe('DIV');

    await page.keyboard.press('f');
    await expect.poll(() => fullscreenTag(page)).toBeNull();
  });

  test('Esc leaves fullscreen before it closes the viewer', async ({ page }) => {
    await openLightbox(page);
    await page.keyboard.press('f');
    await expect.poll(() => fullscreenTag(page)).toBe('DIV');

    await page.keyboard.press('Escape');
    await expect.poll(() => fullscreenTag(page)).toBeNull();
    // One layer at a time: the viewer is still open.
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('closing the viewer does not strand the page in fullscreen', async ({ page }) => {
    await openLightbox(page);
    await page.keyboard.press('f');
    await expect.poll(() => fullscreenTag(page)).toBe('DIV');

    await page.getByRole('button', { name: /close/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => fullscreenTag(page)).toBeNull();
  });

  test('the shortcut panel advertises the key', async ({ page }) => {
    await openLightbox(page);
    await page.keyboard.press('?');
    await expect(page.getByText(/fullscreen|vollbild/i).first()).toBeVisible();
  });
});
