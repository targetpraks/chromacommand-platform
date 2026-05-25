# ChromaCommand Security Policy

Contact: **security@infinitybrands.co.za**

## Known Security Issues & Remediation Status

| # | Issue | Status | Details |
|---|-------|--------|---------|
| 1 | **JWT secret rotation** | ⏳ Pending | Short-lived tokens (1h access / 30d refresh) are enforced, but automatic rotation on suspected compromise is not yet implemented. Workaround: revoke user sessions via the dashboard (`auth.logoutAll`), then rotate the `JWT_SECRET` env var and redeploy the API containers. |
| 2 | **AuthGate bypass removed** | ✅ Done | Sprint 2 removed the legacy permit-list bypass that allowed unscoped access to `/api/trpc` without a valid JWT. All tRPC procedures now require `protectedProcedure` or stricter role gates (`requireRole`, `requireScope`). |
| 3 | **Token storage moved to cookie** | ✅ Done | Sprint 2 moved refresh-token storage from `localStorage` to `HttpOnly` cookies (`__Host-refresh` with `Secure; SameSite=Lax`). XSS no longer exposes long-lived tokens. |
| 4 | **MQTT anonymous access** | ⏳ Pending prod config | Local development (`mosquitto.conf`) allows anonymous reads for rapid iteration. Production must set `allow_anonymous false` and enforce per-device TLS client certificates or username/password ACLs. |
| 5 | **Edge provisioning CA placeholder** | ⏳ Pending X.509 | The edge-gateway currently auto-provisions via `PROVISION_ADMIN_KEY` over HTTPS. Planned: replace shared-key provisioning with an X.509-based CA where each edge device gets a unique certificate signed by InfinityBrands’ internal CA. |
| 6 | **Docker image digest pinning** | ⏳ Pending | `docker-compose.yml` and `k8s/*.yaml` reference moving tags (`node:20-alpine`, `postgres:15-alpine`). Pin to immutable digests (`node:20-alpine@sha256:…`) and automate Dependabot-style digest bumps in CI. |
| 7 | **Helmet / CSP headers added** | ✅ Done | Sprint 2 added `fastify-helmet` with a strict Content-Security-Policy on the API layer. Dashboard CSP is enforced via Next.js `headers` in `next.config.js`. |

## Reporting a Vulnerability

1. Email **security@infinitybrands.co.za** with a clear description, repro steps, and any logs or screenshots.
2. Allow up to 72 hours for an initial acknowledgment.
3. We will provide a target timeline for remediation and coordinate disclosure if applicable.
