import { test, expect, type Page } from '@playwright/test';

/**
 * Client proofing + download e2e.
 *
 * Two independent capabilities, two albums:
 *
 *   - Proofing (hearts, the selection bar, the send-off modal) is on by default
 *     for every album, so it is tested against any published album.
 *   - Downloading (the "Download album" header link and the "Download selected"
 *     modal action) only exists on an album that opted in with `download: true`
 *     in gallery.yaml, so those tests run against a separate album and skip
 *     cleanly when it is not configured.
 *
 * Override the URLs to match a real deployment:
 *   E2E_ALBUM_URL           an album with photos (proofing tests)
 *   E2E_DOWNLOAD_ALBUM_URL  an album with `download: true`
 */
const ALBUM_URL = process.env.E2E_ALBUM_URL || '/deutschland/kloster-chorin';
const DOWNLOAD_ALBUM_URL = process.env.E2E_DOWNLOAD_ALBUM_URL || ALBUM_URL;

const stickyBar = (page: Page) => page.locator('.proofing-sticky-bar');
const modalCard = (page: Page) => page.locator('.proofing-modal-card');

/** Favourite the first photo and open the send-off modal via the sticky bar. */
async function favouriteAndOpenModal(page: Page) {
  const fav = page.locator('.photo-grid__fav-btn').first();
  await fav.scrollIntoViewIfNeeded();
  await fav.click();

  await expect(stickyBar(page)).toBeVisible();
  // Second button in the bar is "Share & Export"; the first is the filter.
  await stickyBar(page).locator('button').nth(1).click();
  await expect(modalCard(page)).toBeVisible();
}

test.describe('Proofing', () => {
  test('favouriting a photo surfaces the selection bar', async ({ page }) => {
    await page.goto(ALBUM_URL);

    const fav = page.locator('.photo-grid__fav-btn').first();
    test.skip((await fav.count()) === 0, 'proofing disabled for this album');

    await fav.click();
    await expect(stickyBar(page)).toBeVisible();
  });

  test('the send-off modal opens with a selection and clears again', async ({ page }) => {
    await page.goto(ALBUM_URL);

    const fav = page.locator('.photo-grid__fav-btn').first();
    test.skip((await fav.count()) === 0, 'proofing disabled for this album');

    await favouriteAndOpenModal(page);
    await expect(modalCard(page).locator('h3')).toBeVisible();

    // Clear is guarded by a native confirm(); accept it.
    page.once('dialog', (dialog) => dialog.accept());
    await modalCard(page)
      .getByRole('button', { name: /clear selection|auswahl löschen/i })
      .click();

    await expect(modalCard(page)).toHaveCount(0);
    await expect(stickyBar(page)).toHaveCount(0);
  });
});

test.describe('Downloads', () => {
  test('the header offers a whole-album download', async ({ page }) => {
    await page.goto(DOWNLOAD_ALBUM_URL);

    const link = page.locator('.album-header__download');
    test.skip((await link.count()) === 0, 'album does not opt into downloads');

    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });

  test('the modal downloads just the selected photos', async ({ page }) => {
    await page.goto(DOWNLOAD_ALBUM_URL);

    const fav = page.locator('.photo-grid__fav-btn').first();
    test.skip((await fav.count()) === 0, 'proofing disabled for this album');

    await favouriteAndOpenModal(page);

    const downloadButton = modalCard(page).getByRole('button', {
      name: /download selected|auswahl herunterladen/i,
    });
    test.skip((await downloadButton.count()) === 0, 'album does not opt into downloads');

    const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });
});
