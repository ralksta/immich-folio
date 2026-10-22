'use client';

import type { JournalBlock } from '@/lib/journal';
import {
  IconFileText,
  IconSparkles,
  IconQuote,
  IconCamera,
  IconArrowLeftRight,
  IconGrid,
  IconColumns,
  IconMap,
  IconFolder,
} from './Icons';
import { useAdminDictionary } from './AdminI18n';
import type { AdminDictionary } from '@/lib/i18n/admin';

type BlockType = JournalBlock['type'];

/**
 * Block type chips for the Journal Studio and the Pages essay builder.
 *
 * Deliberately monochrome: the panel's colour language is neutral surfaces plus
 * a single accent, and these chips label a block rather than reporting a state,
 * so they carry no colour of their own. The block type is told apart by its
 * icon — the same icon the "Add Block" toolbar uses for it.
 */
const BLOCK_META: Record<
  BlockType,
  { label: keyof AdminDictionary['pickers']['badges']; Icon: typeof IconFileText }
> = {
  paragraph: { label: 'paragraph', Icon: IconFileText },
  heading: { label: 'heading', Icon: IconSparkles },
  quote: { label: 'quote', Icon: IconQuote },
  photo: { label: 'photo', Icon: IconCamera },
  'photo-pair': { label: 'photoPair', Icon: IconArrowLeftRight },
  'photo-grid': { label: 'photoGrid', Icon: IconGrid },
  facts: { label: 'facts', Icon: IconColumns },
  map: { label: 'map', Icon: IconMap },
  album: { label: 'album', Icon: IconFolder },
};

interface BlockBadgeProps {
  type: BlockType;
  /** Optional position prefix, e.g. "3" renders as "3 · Quote". */
  index?: number;
}

export function BlockBadge({ type, index }: BlockBadgeProps) {
  const t = useAdminDictionary().pickers.badges;
  const meta = BLOCK_META[type];
  if (!meta) return <span className="essay-block-badge">{type}</span>;

  const { label, Icon } = meta;
  return (
    <span className="essay-block-badge">
      <Icon size={11} />
      {index != null && <span className="essay-block-badge-index">{index}</span>}
      {t[label]}
    </span>
  );
}
