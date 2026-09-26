# Deployment checklist

Do **not** deploy, change live DNS, or send invitations without explicit owner approval.

## Prerequisites (owner)

1. Cloudflare account with permission to create Workers, D1, R2.
2. Inventory existing `orangecloud.vn` DNS/routes before attaching hostnames.
3. Create separate **staging** and **production** D1 databases and R2 buckets.
4. Replace `REPLACE_WITH_*_DATABASE_ID` in `workers/platform/wrangler.toml`.
5. Set secrets via `wrangler secret put` (never commit):
   - `SESSION_SECRET`
   - `GITHUB_APP_ID` / GitHub private key (broker Worker)
   - `GITHUB_WEBHOOK_SECRET`
6. Confirm reserved hostnames remain unused by OCLaunch claims: `launch`, `www`, `api`, etc.

## Hostnames

| Environment | Worker | Custom domain | `APP_ORIGIN` / WebAuthn RP ID |
|-------------|--------|---------------|-------------------------------|
| staging | `oclaunch-platform-staging` | `launch-staging.orangecloud.vn` | `https://launch-staging.orangecloud.vn` |
| production | `oclaunch-platform-production` | `launch.orangecloud.vn` | `https://launch.orangecloud.vn` |

Staging may still be reachable on `*.workers.dev`; that origin is listed in `APP_ORIGINS_EXTRA` only.

## Staging

```bash
npm run build
cd workers/platform
WRANGLER_ENV=staging node ../../scripts/publish-static-r2.mjs
npx wrangler d1 migrations apply oclaunch-staging --env staging
npx wrangler deploy --env staging
```

`scripts/publish-static-r2.mjs` uploads `apps/web/dist` (HTML, JS, CSS, favicon, and the logo) to the `STATIC` R2 bucket. The Worker serves those objects first and falls back to Workers static assets if an object is missing.

Custom domain in config: `launch-staging.orangecloud.vn`.

## Production

```bash
WRANGLER_ENV=production node ../../scripts/publish-static-r2.mjs
npx wrangler d1 migrations apply oclaunch-production --env production
npx wrangler deploy --env production
```

Or via Actions: `workflow_dispatch` with environment `production` and confirm `launch.orangecloud.vn`.

Custom domain in config: exact `launch.orangecloud.vn` (no zone-wide wildcard). Deploy staging first so it no longer claims `launch.orangecloud.vn`.

## Feature flags

| Var | Default | Meaning |
|-----|---------|---------|
| `DEV_LOGIN_SECRET` | unset | Local loopback login only. Do not set this on staging or production |
| `MAINTENANCE_SECRET` | unset | Required header for maintenance HTTP routes. Cron does not use it |
| `SESSION_SECRET` | secret | Pepper for recovery codes. Required before passkey registration |
| `ENABLE_PATCH_PR` | `false` | Draft PR / sandbox path |
| `ENABLE_PROJECT_DOMAINS` | `false` | Gateway activation |
| `ENABLE_BROWSER_RUN` | `true` | Browser Run human-tester is on by default (`[browser] binding = "BROWSER"`). Does not bypass WAF; project owners allowlist bot detection ID `119853733` on zones they control. |
| `ENABLE_WORKERS_AI` | `false` | Workers AI suggestions |

## Rollback notes

- Worker rollback does **not** undo D1 migrations, DNS changes, or merged customer PRs.
- Prefer additive migrations.
- Revoke report shares and integration connections through API — access must fail closed.

## Cost controls (initial policy)

- 3 projects / account
- 2 automated reviews / project / month
- 20 MB of uploaded evidence / project / month
- Human reviews remain available when automated quota is exhausted
- 48h preview TTL and 10-minute build timeout when sandbox is enabled
