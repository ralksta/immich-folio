## 2024-05-24 - [HIGH] Add rate limiting to health check endpoint
**Vulnerability:** Missing rate limiting on the `/api/health` endpoint which fetches data from the upstream Immich server (`/server/ping`), exposing the server to downstream DoS via excessive polling.
**Learning:** Endpoints fetching upstream data, even seemingly "innocuous" ones like health checks, must be protected to prevent downstream Denial-of-Service (DoS) and excessive load on backend dependencies.
**Prevention:** Implement sliding-window rate limiting on all endpoints that interact with upstream services.