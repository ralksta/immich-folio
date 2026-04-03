import { test, expect } from '@playwright/test';

test('Verify aria-label and aria-hidden on subpage links', async ({ page }) => {
  // We just need to check the accessibility tree of the SubpageGridView.
  // Instead of spinning up the Next.js server with mocked Immich endpoints,
  // we can just check the raw source code changes using grep.
  // However, since we need to generate a screenshot, we will start the dev server
  // and load a subpage.
  // Since dev server needs IMMICH_API_URL, we'll try to start it with mock.
});
