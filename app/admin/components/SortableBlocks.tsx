'use client';

/**
 * Drag-and-drop ordering for the block editors (Journal Studio and the
 * PageBuilder's essay editor), on the same dnd-kit setup as the photo order
 * editor. Blocks have no identity of their own and both editors key them by
 * position, so the sortable ids are positions too; the editors apply the
 * move to their block array and re-render.
 *
 * The grip is the only activator: the cards are full of inputs, and a
 * pointer that starts on a text field must keep selecting text. The up/down
 * buttons stay as the keyboard alternative; the grip also takes Space and
 * the arrow keys through dnd-kit's keyboard sensor.
 */

import { useMemo, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical } from './Icons';

const idAt = (index: number) => `block-${index}`;

interface SortableBlockListProps {
  count: number;
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
}

export function SortableBlockList({ count, onReorder, children }: SortableBlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => idAt(i)), [count]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface SortableBlockCardProps {
  index: number;
  badge: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}

export function SortableBlockCard({ index, badge, actions, children }: SortableBlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idAt(index) });

  return (
    <div
      ref={setNodeRef}
      className={`essay-block-card${isDragging ? ' is-dragging' : ''}`}
      style={{
        // Translate, not Transform: cards differ in height, and a scale would
        // distort the one being carried past taller neighbours.
        transform: CSS.Translate.toString(transform),
        transition,
      }}
    >
      <div className="essay-block-card-header">
        <div className="essay-block-card-title">
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="essay-block-grip"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={14} />
          </button>
          {badge}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
