/**
 * German admin dictionary. Typed as `AdminDictionary` (derived from the English
 * reference), so a key added to English but missing here fails the type-check.
 */

import type { AdminDictionary } from '../index';
import { common } from './common';
import { shell } from './shell';
import { settings } from './settings';
import { diagnostics } from './diagnostics';
import { doctor } from './doctor';
import { visitors } from './visitors';
import { system } from './system';

export const adminDe: AdminDictionary = {
  common,
  shell,
  settings,
  diagnostics,
  doctor,
  visitors,
  system,
};
