/**
 * README Header Collage Generator
 *
 * Composes the single hero image at the top of README.md out of screenshots
 * that already exist in docs/screenshots/. One picture that answers "what is
 * this?" in the three ways a visitor cares about: the public gallery, the
 * photo grid, and the admin panel behind it.
 *
 * Usage:
 *   npx tsx scripts/header.ts
 *
 * Run scripts/screenshots.ts first if the source shots are missing or stale —
 * this script only composes, it never captures.
 */

import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const OUTPUT = path.join(SCREENSHOT_DIR, 'header.png');

/** Canvas and spacing. Sized so the result stays legible at README width. */
const CANVAS = { width: 2400, height: 1000 };
const PADDING = 28;
const GAP = 20;

/** Near-black, matching the studio-modern preset the shots are taken in. */
const BACKGROUND = { r: 13, g: 13, b: 13, alpha: 1 };
/** Hairline around each tile, so neighbouring dark screenshots stay distinct. */
const BORDER = { r: 42, g: 42, b: 42, alpha: 1 };

interface Tile {
  file: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Which part survives the crop — screenshots read best from the top. */
  position: 'top' | 'centre';
  /**
   * Optional region of the source to use instead of the whole page. A dense
   * UI shrunk to tile size turns into unreadable mush; taking a smaller region
   * and scaling it less keeps the interface recognisable.
   */
  crop?: { left: number; top: number; width: number; height: number };
}

function layout(): Tile[] {
  const innerHeight = CANVAS.height - PADDING * 2;
  // One large tile carrying the gallery, two stacked beside it. The large one
  // takes roughly the golden share of the width; the rest goes to the column.
  const largeWidth = 1480;
  const columnLeft = PADDING + largeWidth + GAP;
  const columnWidth = CANVAS.width - columnLeft - PADDING;
  const columnTileHeight = Math.floor((innerHeight - GAP) / 2);

  return [
    {
      file: 'theme-studio-modern-home.png',
      left: PADDING,
      top: PADDING,
      width: largeWidth,
      height: innerHeight,
      position: 'top',
    },
    {
      file: 'theme-studio-modern-grid.png',
      left: columnLeft,
      top: PADDING,
      width: columnWidth,
      height: columnTileHeight,
      position: 'top',
    },
    {
      file: 'admin-page-builder.png',
      left: columnLeft,
      top: PADDING + columnTileHeight + GAP,
      width: columnWidth,
      height: columnTileHeight,
      position: 'top',
      // The page builder is the densest shot in the set. Full width, but only
      // the upper region: tab bar, save bar and the hero thumbnails. Scaling
      // ~1000px of source instead of 1440 keeps the labels readable.
      crop: { left: 0, top: 0, width: 1030, height: 564 },
    },
  ];
}

/**
 * sharp ships with Next.js but is not a declared dependency, and 0.35 moved
 * from `export =` to ESM — the namespace stopped being callable and the
 * factory moved to `.default`. Derive the shape from the installed package
 * rather than pinning it, exactly as scripts/screenshots.ts does.
 */
async function loadSharp() {
  type SharpFactory = typeof import('sharp') extends { default: infer Factory }
    ? Factory
    : typeof import('sharp');
  const mod = (await import('sharp')) as unknown as { default?: SharpFactory };
  return mod.default ?? (mod as unknown as SharpFactory);
}

async function main() {
  const tiles = layout();

  const missing = tiles
    .map((t) => t.file)
    .filter((f) => !fs.existsSync(path.join(SCREENSHOT_DIR, f)));
  if (missing.length > 0) {
    console.error(
      `\n❌ Missing source screenshots:\n   ${missing.join('\n   ')}\n\n` +
        `   Run \`npx tsx scripts/screenshots.ts\` against a running site first.\n`,
    );
    process.exit(1);
  }

  let sharp: Awaited<ReturnType<typeof loadSharp>>;
  try {
    sharp = await loadSharp();
  } catch {
    console.error('\n❌ sharp is not available — cannot compose the header.\n');
    process.exit(1);
  }

  const composites = await Promise.all(
    tiles.map(async (tile) => {
      // Reserve a pixel on every side for the hairline, so the visible
      // screenshot lands exactly on the tile geometry above.
      const pipeline = sharp(path.join(SCREENSHOT_DIR, tile.file));
      if (tile.crop) pipeline.extract(tile.crop);

      const inner = await pipeline
        .resize(tile.width - 2, tile.height - 2, {
          fit: 'cover',
          position: tile.position === 'top' ? 'top' : 'centre',
        })
        .toBuffer();

      const bordered = await sharp(inner)
        .extend({ top: 1, bottom: 1, left: 1, right: 1, background: BORDER })
        .toBuffer();

      return { input: bordered, left: tile.left, top: tile.top };
    }),
  );

  await sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(OUTPUT);

  const kb = Math.round(fs.statSync(OUTPUT).size / 1024);
  console.log(`\n🎉 Header written to docs/screenshots/header.png (${kb} KB)`);
  console.log(`   ${CANVAS.width}x${CANVAS.height}, composed from:`);
  for (const tile of tiles) console.log(`   · ${tile.file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
