import { test, expect } from '@playwright/test';

/**
 * `#photo-N` named a position in the album, not a photo — reordering the
 * album (or deleting an earlier photo) silently repointed every link already
 * shared. `?photo=<assetId>` addresses the photo itself, and — unlike a hash
 * — reaches the server, so a shared link also gets an OG preview of the
 * actual photo rather than the album's generic card (#588).
 *
 * These do not reorder the album against a live Immich (that would mutate
 * real content this test runs against); instead they pin the property a
 * reorder relies on — the URL identifies the *asset*, so opening it lands on
 * the same photo no matter what position that asset currently occupies.
 */
test.describe('Photo permalinks', () => {
  const GRID_URL = '/deutschland/kloster-chorin';

  test('opening a photo writes a ?photo= URL, not a #photo-N hash', async ({ page }) => {
    await page.goto(GRID_URL);
    const item = page.locator('.photo-grid .photo-grid__item').first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page).toHaveURL(/[?&]photo=/);
    expect(new URL(page.url()).hash).toBe('');
  });

  test('navigating directly to a ?photo= link opens that photo', async ({ page }) => {
    await page.goto(GRID_URL);
    const items = page.locator('.photo-grid .photo-grid__item');
    await items.nth(1).scrollIntoViewIfNeeded();
    await items.nth(1).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const permalink = page.url();
    await page.goto('about:blank');

    // Reopening the exact link — as a recipient would, with no prior
    // navigation history — must land on the same photo the link named.
    await page.goto(permalink);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(permalink);
  });

  test('a legacy #photo-N link still opens the lightbox (backward compatibility)', async ({
    page,
  }) => {
    await page.goto(`${GRID_URL}#photo-1`);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('a ?photo= link renders an OG preview of the photo itself', async ({ page }) => {
    await page.goto(GRID_URL);
    const item = page.locator('.photo-grid .photo-grid__item').first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const permalink = page.url();
    await page.goto(permalink);

    // The image itself, not the generated title/subtitle text card the album
    // page uses — that is the whole point of a photo-specific OG preview.
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/\/api\/image\//);
  });

  test('the copy-link shortcut copies a ?photo= URL', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(GRID_URL);
    const item = page.locator('.photo-grid .photo-grid__item').first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('c');

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/[?&]photo=/);
    expect(copied).not.toMatch(/#photo-\d+/);
  });
});
