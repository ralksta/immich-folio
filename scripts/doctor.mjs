/**
 * Entry point for `npm run doctor` — see scripts/doctor.mts for the doctor
 * itself, and for why it is TypeScript run by node's own type stripping (#521).
 *
 * This launcher is plain JavaScript so that it parses on every Node version.
 * Type stripping arrived in Node 22.18; older runtimes fail on the `.mts` file
 * with an ERR_UNKNOWN_FILE_EXTENSION stack trace, which is not an answer to
 * give someone whose site is already down. The version is checked here, before
 * the import that would throw.
 */

const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 22 || (major === 22 && minor < 18)) {
  process.stderr.write(
    `\nThe config doctor needs Node 22.18 or newer (this is ${process.versions.node}).\n` +
      `It runs TypeScript directly, which older versions cannot do.\n\n` +
      `The same checks are in the admin panel: /admin → the status badge → Diagnostics.\n` +
      `The shipped Docker image already has a new enough Node:\n` +
      `  docker compose exec folio npm run doctor\n\n`,
  );
  process.exit(3);
}

const { main } = await import('./doctor.mts');
process.exitCode = await main();
