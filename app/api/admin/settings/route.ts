import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin/withAdmin';
import { revalidatePath } from 'next/cache';
import {
  readSettingsYaml,
  readSettingsYamlVersioned,
  writeSettingsYaml,
} from '@/lib/admin/yaml-service';
import {
  VersionConflictError,
  baseVersionFrom,
  conflictResponse,
  etag,
} from '@/lib/admin/contentVersion';
import { invalidateConfigCache, getConfigOrNull } from '@/lib/config';
import { validateSettings } from '@/lib/config/settingsSchema';
import { hashPasswordKeys } from '@/lib/admin/passwordHashing';
import { keepLockedValues, resolveEnvLocks } from '@/lib/admin/envLocks';
import { env } from '@/lib/env';
import { validateSettingValues } from '@/lib/config/settingValues';

const SITE_PASSWORD_KEY = new Set(['sitePassword']);
import type { SettingsYaml } from '@/lib/config/schema';

/** GET: Read current settings.yaml config. */
export const GET = withAdmin(async () => {
  const { data: settings, version } = await readSettingsYamlVersioned();
  const config = getConfigOrNull();
  return NextResponse.json(
    {
      settings: settings || {},
      // Sent back in If-Match on save (#601).
      version,
      // The resolved value and its origin, so the panel can say when what it
      // shows came from SITE_URL rather than from the field itself (#472).
      siteUrl: {
        effective: config?.siteUrl ?? null,
        source: config?.siteUrlSource ?? 'none',
      },
      // Fields an environment variable overrides, as path → variable name. Only
      // the names: the values are secrets (a password, an ntfy topic) (#605).
      envLocks: resolveEnvLocks(env),
    },
    { headers: { ETag: etag(version) } },
  );
});

/** PUT: Write settings.yaml config. */
export const PUT = withAdmin(async (request: Request) => {
  const body = await request.json().catch(() => null);
  if (!body?.settings) {
    return NextResponse.json({ error: 'Missing settings data' }, { status: 400 });
  }

  // Checked before the write, not after: settings.yaml is read by every public
  // page, so a malformed save is discovered by visitors rather than here.
  // Then the values the site would silently ignore — an accent that is not
  // hex, nine columns — which used to be saved with a success message.
  const validation = validateSettings(body.settings);
  const fields = validation.ok ? validateSettingValues(body.settings) : validation.errors;
  if (fields.length > 0) {
    return NextResponse.json(
      {
        error: 'These settings could not be saved.',
        fields,
      },
      { status: 400 },
    );
  }

  try {
    // Only the top-level site password: settings.yaml has no other password.
    const stored = await readSettingsYaml().catch(() => null);
    // A locked field keeps what the file holds: the environment wins anyway,
    // so a changed value would be saved and then silently ignored (#605).
    const incoming = keepLockedValues(body.settings as SettingsYaml, stored, resolveEnvLocks(env));
    const settings = await hashPasswordKeys(incoming, SITE_PASSWORD_KEY, stored);
    const version = await writeSettingsYaml(settings, baseVersionFrom(request));
    invalidateConfigCache();
    // No immich.invalidateAll(): the Immich cache holds Immich's data only, and
    // the gallery.yaml side (allowlist, titles, order) is applied per request
    // from the new config. Clearing it made the next visitor refetch every
    // album although nothing in Immich had changed.
    revalidatePath('/', 'layout');
    return NextResponse.json({
      success: true,
      message: 'Saved successfully. Backup of previous version created.',
      // The stored site password, hashed, so the field can read "Protected".
      sitePassword: settings.sitePassword,
      version,
    });
  } catch (err) {
    if (err instanceof VersionConflictError) return conflictResponse(err.currentVersion);
    console.error('[Admin] Failed to write settings.yaml:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
});
