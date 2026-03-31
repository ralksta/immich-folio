import { test, expect } from '@playwright/test';

test('Verify aria-hidden attributes', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for the page to load
  await page.waitForSelector('body');

  // Check Footer svgs
  const footerLinks = page.locator('footer a svg');
  const count = await footerLinks.count();
  console.log(`Found ${count} SVGs in footer`);
  for (let i = 0; i < count; i++) {
    const isHidden = await footerLinks.nth(i).getAttribute('aria-hidden');
    console.log(`Footer SVG ${i} aria-hidden: ${isHidden}`);
    expect(isHidden).toBe('true');
  }

  // Check ThemeToggle svg
  const themeToggleSvg = page.locator('button.theme-toggle svg');
  const toggleCount = await themeToggleSvg.count();
  console.log(`Found ${toggleCount} SVGs in theme toggle`);
  for (let i = 0; i < toggleCount; i++) {
    const isHidden = await themeToggleSvg.nth(i).getAttribute('aria-hidden');
    console.log(`Theme Toggle SVG ${i} aria-hidden: ${isHidden}`);
    expect(isHidden).toBe('true');
  }

  // Open an album to check BackLink and Lightbox
  const albumLink = page.locator('.album-link').first();
  if (await albumLink.isVisible()) {
      await albumLink.click();
      await page.waitForSelector('.album-header__back svg');

      // Check BackLink svg
      const backLinkSvg = page.locator('.album-header__back svg');
      const isBackLinkHidden = await backLinkSvg.getAttribute('aria-hidden');
      console.log(`BackLink SVG aria-hidden: ${isBackLinkHidden}`);
      expect(isBackLinkHidden).toBe('true');

      // Open Lightbox
      const photo = page.locator('.photo-grid img').first();
      await photo.click();
      await page.waitForSelector('[role="dialog"]');

      // Check Lightbox svgs
      const lightboxSvgs = page.locator('[role="dialog"] button svg');
      const lightboxCount = await lightboxSvgs.count();
      console.log(`Found ${lightboxCount} SVGs in lightbox`);
      for (let i = 0; i < lightboxCount; i++) {
        const isHidden = await lightboxSvgs.nth(i).getAttribute('aria-hidden');
        console.log(`Lightbox SVG ${i} aria-hidden: ${isHidden}`);
        expect(isHidden).toBe('true');
      }
  } else {
      console.log('No albums found to check BackLink and Lightbox');
  }

  // Take screenshot for visual verification of MapView loading
  await page.goto('http://localhost:3000/map');
  const mapLoading = page.locator('.map-container__loading');
  if (await mapLoading.isVisible()) {
      const mapLoadingRole = await mapLoading.getAttribute('role');
      const mapLoadingLive = await mapLoading.getAttribute('aria-live');
      const mapLoadingSvgHidden = await mapLoading.locator('svg').getAttribute('aria-hidden');

      console.log(`Map loading role: ${mapLoadingRole}`);
      console.log(`Map loading aria-live: ${mapLoadingLive}`);
      console.log(`Map loading SVG aria-hidden: ${mapLoadingSvgHidden}`);

      expect(mapLoadingRole).toBe('alert');
      expect(mapLoadingLive).toBe('polite');
      expect(mapLoadingSvgHidden).toBe('true');
  }

  await page.screenshot({ path: '/home/jules/verification/verification.png' });
});
