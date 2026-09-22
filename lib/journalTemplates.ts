/**
 * Starting-point block structures offered in the Journal Studio's Create
 * modal, as an alternative to an empty editor. Client-safe (no `fs`), same
 * tier as `lib/journal.ts` — importable directly from `JournalStudio.tsx`.
 *
 * Every photo, pair and grid placeholder leaves its `assetId` as `''`:
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

const grid = (count: number, caption?: string): JournalBlock => ({
  type: 'photo-grid',
  assetIds: Array.from({ length: count }, () => ''),
  caption: caption || undefined,
});

// Quote text must not contain ` -- `: that is the author separator.
const quote = (text: string, author?: string): JournalBlock => ({
  type: 'quote',
  text,
  author: author || undefined,
});

// Values are placeholders too — an empty value would be dropped on save.
const facts = (...rows: Array<[label: string, placeholder: string]>): JournalBlock => ({
  type: 'facts',
  items: rows.map(([label, value]) => ({ label, value })),
});

// Templates opt into "every geotagged photo of the entry"; named stops are
// added in the studio, where a typed point is a label and two numbers.
const map = (caption?: string): JournalBlock => ({
  type: 'map',
  caption: caption || undefined,
  line: true,
  items: [{ kind: 'all-photos' }],
});

// An album block with no album yet: the studio shows "Pick album".
const album = (caption?: string): JournalBlock => ({
  type: 'album',
  albumId: '',
  layout: 'grid',
  ...(caption ? { caption } : {}),
});

const heading = (text: string, level = 2): JournalBlock => ({ type: 'heading', level, text });

const paragraph = (text: string): JournalBlock => ({ type: 'paragraph', html: text });

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'wedding',
    name: 'Wedding',
    description:
      'Date and venue up front, one hero image, a line from the vows, the party as a grid.',
    blocks: [
      paragraph('[Who, where, and when — a sentence or two.]'),
      facts(['Date', '[The date]'], ['Venue', '[Where it took place]']),
      photo('fullbleed', '[The image that carries the whole day.]'),
      heading('Getting Ready'),
      pair('[Rings and dress, side by side.]'),
      heading('Ceremony'),
      photo('wide', '[The vows, the walk, the kiss.]'),
      quote('[The line from the day you want remembered.]', '[Who said it]'),
      heading('Reception'),
      grid(3, '[First dance, the speeches, the party.]'),
      paragraph('[A closing line — no need to wrap it up neatly.]'),
    ],
  },
  {
    id: 'hiking',
    name: 'Hiking / Outdoor',
    description: 'Distance and elevation as facts, the trail as a grid, the route on a map.',
    blocks: [
      paragraph('[Route and conditions — keep it factual.]'),
      facts(['Distance', '[21 km]'], ['Elevation', '[1,240 m]'], ['Duration', '[6 h]']),
      photo('fullbleed', '[The landscape that sets the scene.]'),
      heading('The Trail'),
      grid(3, '[Along the way.]'),
      photo('wide', '[The summit, or wherever it ended.]'),
      map('[The route, from the geotagged photos above.]'),
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    description: 'The trip on a map, then one stop per section with two photos each.',
    blocks: [
      paragraph('[Where, and over what dates.]'),
      map('[Where the trip went, e.g. Busan → Seoul.]'),
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
    description: 'Almost no text — the whole album as a grid and one full-bleed frame.',
    blocks: [
      paragraph('[One personal sentence about the day.]'),
      album('[The day, as it happened.]'),
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
