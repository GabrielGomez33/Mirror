# Mirror Client — Staging Deploy Log

The `deploy-staging` job (`.github/workflows/ci-cd.yml`) builds the client with
staging `VITE_*` values and deploys `dist/` to the staging web root. It fires on
push to `develop` when `vars.STAGING_ENABLED == 'true'`.

Target: https://staging.theundergroundrailroad.world/Mirror/ (Basic Auth gated;
API + WS proxied same-origin to mirror-server-staging on :9444).

## Deploy history
- 2026-08-31 — First staging client deploy (subdomain + TLS + Basic Auth gate live).
