/**
 * English admin dictionary — the reference every other locale implements
 * (`AdminDictionary` in `lib/i18n/admin/index.ts`). Values are plain strings,
 * or functions when a count or a name is interpolated. A string that wraps
 * markup uses `{name}` placeholders, filled in by `rich()` from
 * `app/admin/components/AdminI18n.tsx`, so a translation can move the markup
 * where its grammar needs it.
 */

import { common } from './common';
import { shell } from './shell';
import { settings } from './settings';
import { diagnostics } from './diagnostics';
import { doctor } from './doctor';

export const adminEn = { common, shell, settings, diagnostics, doctor };
