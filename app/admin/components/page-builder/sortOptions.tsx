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

/**
 * Labels for the per-album sort control.
 *
 * Kept as plain text on their own because they also feed the `title` attribute
 * on the album card's sort badge, where markup is not an option.
 */
export const SORT_LABELS: Record<AlbumSortMode, string> = {
  immich: 'Immich order (default)',
  newest: 'Newest first',
  oldest: 'Oldest first',
  filename: 'Filename',
  manual: 'Manual',
};

/** Manual reuses the drag glyph so the control matches the card's badge. */
export const SORT_ICONS: Record<AlbumSortMode, ReactNode> = {
  immich: <IconCalendar />,
  newest: <IconArrowDown />,
  oldest: <IconArrowUp />,
  filename: <IconSortAlpha />,
  manual: <IconGripVertical />,
};

export const SORT_OPTIONS: readonly ListboxOption<AlbumSortMode>[] = ALBUM_SORT_MODES.map(
  (mode) => ({
    value: mode,
    label: SORT_LABELS[mode],
    icon: SORT_ICONS[mode],
  }),
);
