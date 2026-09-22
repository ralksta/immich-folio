/**
 * Starting-point block structures offered in the Journal Studio's Create
 * modal, as an alternative to an empty editor. Client-safe (no `fs`), same
 * tier as `lib/journal.ts` — importable directly from `JournalStudio.tsx`.
 *
 * Every photo and photo-pair placeholder leaves its `assetId` as `''`:
 * `parseJournalMarkdown` round-trips that as an unfilled placeholder (see the
 * comment on the image regex in `lib/journal.ts`), and the block editor
 * already renders it as a "+ Pick" tile.
 */

import type { JournalBlock } from './journal';

export interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  blocks: JournalBlock[];
}

type PhotoLayout = Extract<JournalBlock, { type: 'photo' }>['layout'];

// Captions and authors default to `undefined`, not `''`: that is what
// `parseJournalMarkdown` produces for an empty `(...)` or a missing `-- author`,
// so a template block must start that way too or the round-trip test sees a
// reshaped block on first load.
const photo = (layout: PhotoLayout, caption?: string): JournalBlock => ({
  type: 'photo',
  assetId: '',
  layout,
  caption: caption || undefined,
});

const pair = (caption?: string): JournalBlock => ({
  type: 'photo-pair',
  assetIds: ['', ''],
  caption: caption || undefined,
});

// Quote text must not contain ` -- `: that is the author separator.
const quote = (text: string, author?: string): JournalBlock => ({
  type: 'quote',
  text,
  author: author || undefined,
});

const heading = (text: string, level = 2): JournalBlock => ({ type: 'heading', level, text });

const paragraph = (text: string): JournalBlock => ({ type: 'paragraph', html: text });

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'wedding',
    name: 'Wedding',
    description: 'Prep, ceremony and reception around one hero image, with a line from the vows.',
    blocks: [
      paragraph('[Who, where, and when — a sentence or two.]'),
      photo('fullbleed', '[The image that carries the whole day.]'),
      heading('Getting Ready'),
      pair('[Rings and dress, side by side.]'),
      heading('Ceremony'),
      photo('wide', '[The vows, the walk, the kiss.]'),
      quote('[The line from the day you want remembered.]', '[Who said it]'),
      heading('Reception'),
      pair('[First dance and the speeches.]'),
      photo('contained', '[The party, later.]'),
      paragraph('[A closing line — no need to wrap it up neatly.]'),
    ],
  },
  {
    id: 'hiking',
    name: 'Hiking / Outdoor',
    description: 'Route and conditions up front, the trail in pairs, the summit on its own.',
    blocks: [
      paragraph('[Route, distance, weather — keep it factual.]'),
      photo('fullbleed', '[The landscape that sets the scene.]'),
      heading('The Trail'),
      pair('[Early on the trail.]'),
      photo('contained', '[A detail worth stopping for.]'),
      pair('[Higher up.]'),
      photo('wide', '[The summit, or wherever it ended.]'),
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    description: 'One stop per section, two photos each — duplicate or trim as needed.',
    blocks: [
      paragraph('[Where, and over what dates.]'),
      heading('[Day or place 1]'),
      paragraph('[A short note on this stop.]'),
      pair(),
      heading('[Day or place 2]'),
      paragraph('[A short note on this stop.]'),
      pair(),
      heading('[Day or place 3]'),
      paragraph('[A short note on this stop.]'),
      pair(),
    ],
  },
  {
    id: 'birthday',
    name: 'Birthday / Family',
    description: 'Almost no text — pairs of moments and one full-bleed frame.',
    blocks: [
      paragraph('[One personal sentence about the day.]'),
      pair(),
      pair(),
      photo('fullbleed', '[The one moment worth a full-bleed frame.]'),
    ],
  },
  {
    id: 'portrait-session',
    name: 'Portrait Session',
    description: 'Solo wide frames with room to breathe, and a line in their own words.',
    blocks: [
      paragraph('[Who this session is with, and the idea behind it, in a sentence.]'),
      photo('wide'),
      quote('[Something they said during the session.]', '[Their name]'),
      photo('wide'),
      photo('wide'),
    ],
  },
  {
    id: 'behind-the-scenes',
    name: 'Behind the Scenes',
    description: 'Setup and shoot as a pair, then the finished result to land on.',
    blocks: [
      paragraph('[What the assignment or setup was.]'),
      pair('[Setting up, and mid-shoot.]'),
      photo('contained', '[Another making-of moment.]'),
      heading('The Result'),
      photo('fullbleed', '[The finished shot.]'),
    ],
  },
  {
    id: 'pets',
    name: 'Pets',
    description: 'Candid pairs, one close-up portrait with personality.',
    blocks: [
      paragraph('[Who they are — name, and whatever makes them them.]'),
      pair(),
      photo('wide', '[A close-up — the one with personality.]'),
      pair(),
    ],
  },
  {
    id: 'new-series',
    name: 'New Series',
    description: 'Opens on a statement, then photo-and-text pairs introducing the project.',
    blocks: [
      quote('[One sentence on why this series exists.]'),
      photo('wide'),
      paragraph('[A line about this image.]'),
      photo('wide'),
      paragraph('[A line about this image.]'),
      photo('wide'),
      paragraph('[A line about this image.]'),
      paragraph('[More to come — or however this should close.]'),
    ],
  },
];
