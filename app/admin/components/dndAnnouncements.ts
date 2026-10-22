import type { Announcements, UniqueIdentifier } from '@dnd-kit/core';
import type { AdminDictionary } from '@/lib/i18n/admin';
import { adminEn } from '@/lib/i18n/admin/en';

/**
 * Screen reader announcements for a sortable list, in words (QA A-20).
 *
 * dnd-kit's defaults read out the sortable ids — "Picked up draggable item
 * subpage-3. Draggable item page-pricing was moved over droppable area
 * subpage-1." Those ids are internal. `label` turns one into what the list
 * shows, e.g. `page "Pricing"`. `t` words the sentences, English unless a
 * caller passes the panel's.
 */
export function dndAnnouncements(
  label: (id: UniqueIdentifier) => string,
  t: AdminDictionary['pickers']['dnd'] = adminEn.pickers.dnd,
): Announcements {
  return {
    onDragStart: ({ active }) => t.pickedUp(label(active.id)),
    onDragOver: ({ active, over }) =>
      over ? t.over(label(active.id), label(over.id)) : t.notOver(label(active.id)),
    onDragEnd: ({ active, over }) =>
      over ? t.dropped(label(active.id), label(over.id)) : t.droppedOutside(label(active.id)),
    onDragCancel: ({ active }) => t.cancelled(label(active.id)),
  };
}
