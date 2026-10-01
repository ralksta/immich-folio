// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { SortablePageRow, SortableHeroTile } from '../components/page-builder/SortableTiles';
import { dndAnnouncements } from '../components/dndAnnouncements';

afterEach(cleanup);

/**
 * QA A-20: the sortable attributes (role="button", tabindex) sat on the whole
 * row, which also holds the row's own button — nested interactive content. They
 * belong on the drag handle. And the drag announcements read out internal ids.
 */
describe('sortable rows', () => {
  it('put the sortable role on the handle, not around the row button', () => {
    render(
      <DndContext>
        <SortableContext items={['page-pricing']}>
          <SortablePageRow id="page-pricing" title="Pricing" isActive={false} onClick={() => {}} />
        </SortableContext>
      </DndContext>,
    );
    const handle = screen.getByLabelText('Reorder Pricing');
    expect(handle.getAttribute('role')).toBe('button');
    for (const button of screen.getAllByRole('button')) {
      expect(button.parentElement?.closest('[role="button"]')).toBeNull();
    }
  });

  it('keeps the hero tile remove button out of the handle', () => {
    render(
      <DndContext>
        <SortableContext items={['hero-0']}>
          <SortableHeroTile id="abc" index={0} onRemove={() => {}} />
        </SortableContext>
      </DndContext>,
    );
    const remove = screen.getByTitle('Remove');
    expect(remove.parentElement?.closest('[role="button"]')).toBeNull();
    expect(screen.getByLabelText('Reorder hero photo 1').getAttribute('role')).toBe('button');
  });
});

describe('dndAnnouncements', () => {
  const label = (id: string | number) => (id === 'page-pricing' ? 'page "Pricing"' : 'page "FAQ"');
  const a = dndAnnouncements(label);
  const active = { id: 'page-pricing' } as never;
  const over = { id: 'subpage-3' } as never;

  it('speaks the names the list shows, not the ids', () => {
    expect(a.onDragStart({ active })).toBe('Picked up page "Pricing".');
    expect(a.onDragEnd({ active, over } as never)).toBe(
      'Page "Pricing" was dropped at the position of page "FAQ".',
    );
    expect(a.onDragCancel({ active, over: null } as never)).toBe(
      'Moving page "Pricing" was cancelled.',
    );
  });
});
