import type { Announcements, UniqueIdentifier } from '@dnd-kit/core';

/**
 * Screen reader announcements for a sortable list, in words (QA A-20).
 *
 * dnd-kit's defaults read out the sortable ids — "Picked up draggable item
 * subpage-3. Draggable item page-pricing was moved over droppable area
 * subpage-1." Those ids are internal. `label` turns one into what the list
 * shows, e.g. `page "Pricing"`.
 */
export function dndAnnouncements(label: (id: UniqueIdentifier) => string): Announcements {
  return {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${capitalise(label(active.id))} is at the position of ${label(over.id)}.`
        : `${capitalise(label(active.id))} is no longer over the list.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${capitalise(label(active.id))} was dropped at the position of ${label(over.id)}.`
        : `${capitalise(label(active.id))} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${label(active.id)} was cancelled.`,
  };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
