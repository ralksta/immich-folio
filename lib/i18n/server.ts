/**
 * Server-side entry point for i18n. Separate from `lib/i18n/index.ts` because
 * it reaches into `lib/config`, which pulls in `fs` — importing this from a
 * client component breaks the build (same split as `lib/journal.ts` vs
 * `lib/admin/journal-service.ts`).
 */

import { getConfigOrNull } from '@/lib/config';
import { resolveLocale, getDictionary, type Dictionary, type Locale } from './index';

/** Locale of the current deployment, resolved from `settings.yaml: lang`. */
export function getLocale(): Locale {
  return resolveLocale(getConfigOrNull()?.lang);
}

/** Dictionary for the current deployment. */
export function getServerDictionary(): Dictionary {
  return getDictionary(getLocale());
}
