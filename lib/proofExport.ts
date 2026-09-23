/**
 * Turning a submitted selection into something the photographer can act on.
 *
 * The client picked from web previews; the photographer edits RAW files. So
 * the most useful export is the list of file names *without* their extension:
 * pasted into Lightroom's or Capture One's filename filter, it matches
 * IMG_0412.CR3 as readily as IMG_0412.JPG.
 */

export interface ExportAsset {
  /** 1-based position in the album, as the client saw it. */
  position: number;
  fileName: string;
  takenAt?: string;
}

export type ExportFormat = 'lightroom' | 'txt' | 'csv';

/** `IMG_0412.JPG` → `IMG_0412`. A name without a dot stays as it is. */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Quote a CSV field when it needs it (RFC 4180), and defuse spreadsheet formulas. */
function csvField(value: string): string {
  // A leading =, +, - or @ makes Excel and LibreOffice evaluate the cell. File
  // names come from the client's camera, not from us — never let one run.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function formatExport(assets: ExportAsset[], format: ExportFormat): string {
  switch (format) {
    case 'lightroom':
      // De-duplicated: a RAW+JPEG pair uploaded to Immich shares one base name.
      return Array.from(new Set(assets.map((a) => baseName(a.fileName)))).join(', ');
    case 'txt':
      return assets.map((a) => a.fileName).join('\n') + (assets.length ? '\n' : '');
    case 'csv': {
      const rows = [['position', 'file_name', 'taken_at']].concat(
        assets.map((a) => [String(a.position), a.fileName, a.takenAt ?? '']),
      );
      return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
    }
  }
}

export function exportContentType(format: ExportFormat): string {
  return format === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8';
}

export function exportExtension(format: ExportFormat): string {
  return format === 'csv' ? 'csv' : 'txt';
}
