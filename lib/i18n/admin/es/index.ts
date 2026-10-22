/** Spanish admin dictionary — see `lib/i18n/admin/en/index.ts` for the conventions. */

import type { AdminDictionary } from '../index';
import { common } from './common';
import { shell } from './shell';
import { settings } from './settings';
import { diagnostics } from './diagnostics';
import { doctor } from './doctor';
import { visitors } from './visitors';
import { system } from './system';
import { pages } from './pages';
import { journal } from './journal';
import { pickers } from './pickers';

export const adminEs: AdminDictionary = {
  common,
  shell,
  settings,
  diagnostics,
  doctor,
  visitors,
  system,
  pages,
  journal,
  pickers,
};
