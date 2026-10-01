import { Fragment } from 'react';
import { APERTURE_SIGN } from '@/lib/exif';

/**
 * EXIF text with the aperture sign kept lowercase.
 *
 * Several presets set their EXIF lines in `text-transform: uppercase`, which
 * maps "ƒ" to "Ƒ" — "Ƒ/4" is not how an aperture is written. The sign is
 * wrapped in `.exif-fsign` (app/globals.css), which opts it out of the
 * transform; the rest of the line keeps the preset's casing.
 */
export default function ExifText({ text }: { text: string }) {
  const parts = text.split(APERTURE_SIGN);
  // One wrapping span: the hero chip is a flex container, and loose text
  // around the sign would become separate flex items that drop the spaces.
  return (
    <span>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="exif-fsign">{APERTURE_SIGN}</span>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
