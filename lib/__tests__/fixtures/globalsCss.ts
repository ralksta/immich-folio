import fs from 'fs';
import path from 'path';

/**
 * The site's own stylesheet as one text: app/globals.css with the
 * `./styles/*.css` parts it imports inlined in their import order (#556).
 * The theme, tokens and Leaflet imports stay as they are, so tests that look
 * at those still see them in globals.css.
 */
export function readGlobalsCss(): string {
  const app = path.join(process.cwd(), 'app');
  return fs
    .readFileSync(path.join(app, 'globals.css'), 'utf8')
    .replace(/@import url\('\.\/(styles\/[\w-]+\.css)'\);\n/g, (_, file: string) =>
      fs.readFileSync(path.join(app, file), 'utf8'),
    );
}
