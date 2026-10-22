'use client';

import type { ReactNode } from 'react';
import { ALBUM_SORT_MODES, type AlbumSortMode } from '@/lib/albumSort';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconGripVertical,
  IconSortAlpha,
} from '../Icons';
import type { ListboxOption } from '../Listbox';
import { adminEn } from '@/lib/i18n/admin/en';
import type { AdminDictionary } from '@/lib/i18n/admin';

/** Manual reuses the drag glyph so the control matches the card's badge. */
export const SORT_ICONS: Record<AlbumSortMode, ReactNode> = {
  immich: <IconCalendar />,
  newest: <IconArrowDown />,
  oldest: <IconArrowUp />,
  filename: <IconSortAlpha />,
  manual: <IconGripVertical />,
};

/**
 * Options of the per-album sort control. The labels are plain text on their
 * own because they also feed the `title` attribute on the album card's sort
 * badge, where markup is not an option.
 */
export function sortOptions(
  t: AdminDictionary['pages']['sort'] = adminEn.pages.sort,
): ListboxOption<AlbumSortMode>[] {
  return ALBUM_SORT_MODES.map((mode) => ({
    value: mode,
    label: t[mode],
    icon: SORT_ICONS[mode],
  }));
}
