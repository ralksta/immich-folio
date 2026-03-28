# Security Policy

## Supported Versions

Only the latest release on `main` is actively maintained.

| Version         | Supported |
| --------------- | --------- |
| `main` (latest) | ✅        |
| older commits   | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

Instead, use one of these private channels:

- **GitHub Security Advisories** (preferred): [Open a draft advisory](https://github.com/ralksta/immich-folio/security/advisories/new)
- **Email**: contact the maintainer via the email listed on the GitHub profile

### What to include

- Description of the vulnerability and potential impact
- Steps to reproduce (minimal reproduction if possible)
- Affected versions / configurations
- Any proposed fix or mitigation

### Response timeline

- **Acknowledgement**: within 48 hours
- **Triage & assessment**: within 7 days
- **Fix & coordinated disclosure**: within 30 days for critical issues

## Scope

immich-folio acts as a **reverse proxy** in front of your private Immich instance. Security issues in scope include:

- Authentication / session bypass
- API key / secret leakage
- XSS vulnerabilities in gallery pages or lightbox
- Rate-limiting bypass enabling DoS
- Insecure Docker defaults that expose the Immich backend

Out of scope: vulnerabilities in Immich itself (report those upstream at [immich.app](https://immich.app)).
