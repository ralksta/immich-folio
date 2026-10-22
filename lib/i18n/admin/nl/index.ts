/**
 * Dutch admin dictionary. Typed as `AdminDictionary` (derived from English),
 * so a key added to English but missing here fails the type-check.
 */

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

export const adminNl: AdminDictionary = {
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
