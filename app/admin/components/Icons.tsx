/**
 * The icon set moved to components/Icons.tsx so the public frontend can use it
 * too — it had no admin-specific dependency, and the alternative was a second
 * copy of the same SVG paths. Re-exported here so the admin's `./Icons`
 * imports keep working.
 */
export * from '@/components/Icons';
