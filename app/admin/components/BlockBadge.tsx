'use client';

import type { JournalBlock } from '@/lib/journal';
import { IconFileText, IconSparkles, IconQuote, IconCamera, IconArrowLeftRight } from './Icons';

type BlockType = JournalBlock['type'];

/**
 * Block type chips for the Journal Studio and the Pages essay builder.
 *
 * Deliberately monochrome: the panel's colour language is neutral surfaces plus
 * a single accent, and these chips label a block rather than reporting a state,
 * so they carry no colour of their own. The block type is told apart by its
 * icon — the same icon the "Add Block" toolbar uses for it.
 */
const BLOCK_META: Record<BlockType, { label: string; Icon: typeof IconFileText }> = {
  paragraph: { label: 'Text', Icon: IconFileText },
  heading: { label: 'Heading', Icon: IconSparkles },
  quote: { label: 'Quote', Icon: IconQuote },
  photo: { label: 'Photo', Icon: IconCamera },
  'photo-pair': { label: 'Photo Pair', Icon: IconArrowLeftRight },
};

interface BlockBadgeProps {
  type: BlockType;
  /** Optional position prefix, e.g. "3" renders as "3 · Quote". */
  index?: number;
}

export function BlockBadge({ type, index }: BlockBadgeProps) {
  const meta = BLOCK_META[type];
  if (!meta) return <span className="essay-block-badge">{type}</span>;

  const { label, Icon } = meta;
  return (
    <span className="essay-block-badge">
      <Icon size={11} />
      {index != null && <span className="essay-block-badge-index">{index}</span>}
      {label}
    </span>
  );
}
