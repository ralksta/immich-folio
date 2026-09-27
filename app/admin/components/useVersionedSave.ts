'use client';

/**
 * Saving a content file without clobbering a change made elsewhere (#601).
 *
 * Each editor keeps the `version` its GET returned in a ref and saves through
 * this hook, which sends it as `If-Match`. When the server answers 409 with
 * `conflict: true` — the file was saved from another tab or device, edited by
 * hand, or restored from a backup since it was loaded — the operator picks:
 *
 * - Reload: throw away this editor's edits and load the file as it is now.
 * - Overwrite anyway: save again against the new version, replacing that change.
 * - Keep editing (cancel): nothing happens; the edits and their draft stay.
 *
 * Other 409s (a rename onto a taken slug) carry no `conflict` flag and are
 * returned like any other failure.
 */

import { useCallback, type MutableRefObject } from 'react';
import { useChoice } from './ConfirmDialog';

/** The If-Match header for a version, or none before the first load. */
export function ifMatch(version: string | null): Record<string, string> {
  return version ? { 'If-Match': `"${version}"` } : {};
}

/** The body of any JSON answer; routes return objects. */
export type SaveData = Record<string, unknown> & { error?: string };

export type VersionedSaveResult =
  | { kind: 'saved'; res: Response; data: SaveData }
  | { kind: 'failed'; res: Response; data: SaveData | null }
  | { kind: 'reload' }
  | { kind: 'keep' };

export function isEditConflict(res: Response, data: unknown): data is { version: string } {
  return (
    res.status === 409 &&
    !!data &&
    typeof data === 'object' &&
    (data as { conflict?: unknown }).conflict === true &&
    typeof (data as { version?: unknown }).version === 'string'
  );
}

type ConflictChoice = 'overwrite' | 'reload';

/**
 * `what` names the file in the dialog ("The settings", "This entry").
 * A network failure throws, as a plain fetch would.
 */
export function useVersionedSave() {
  const choose = useChoice();

  return useCallback(
    async (
      url: string,
      body: unknown,
      versionRef: MutableRefObject<string | null>,
      what: string,
    ): Promise<VersionedSaveResult> => {
      let version = versionRef.current;
      for (;;) {
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...ifMatch(version) },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as SaveData | null;

        if (isEditConflict(res, data)) {
          const choice = await choose<ConflictChoice>({
            title: 'Changed elsewhere',
            message: `${what} was changed since you opened it — in another tab, on another device, by hand or by a backup restore. Saving now would replace that change.`,
            actions: [
              { id: 'overwrite', label: 'Overwrite anyway' },
              { id: 'reload', label: 'Reload (discard mine)' },
            ],
            cancelLabel: 'Keep editing',
          });
          if (choice === 'overwrite') {
            version = data.version;
            continue;
          }
          return { kind: choice === 'reload' ? 'reload' : 'keep' };
        }

        if (res.ok && data) {
          if (typeof data.version === 'string') versionRef.current = data.version;
          return { kind: 'saved', res, data };
        }
        return { kind: 'failed', res, data };
      }
    },
    [choose],
  );
}
