/**
 * Italian admin dictionary. Typed as `AdminDictionary` (derived from English),
 * so a key added to English but forgotten here fails the type-check.
 */

import type { AdminDictionary } from '../index';
import { common } from './common';
import { shell } from './shell';
import { settings } from './settings';
import { diagnostics } from './diagnostics';
import { doctor } from './doctor';

export const adminIt: AdminDictionary = { common, shell, settings, diagnostics, doctor };
