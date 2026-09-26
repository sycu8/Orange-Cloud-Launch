# Development

## Environment

Copy `.env.example` into `workers/platform/.dev.vars`. Set `SESSION_SECRET` and `DEV_LOGIN_SECRET` there. Local login works only on loopback and only for a dedicated local user; it is not enabled by Wrangler `[vars]`. Apply D1 migrations, including `0002_security.sql`, before signing in with a recovery code.

## Main local loop

1. Sign in (dev login or passkey).
2. **Add your project** (private by default).
3. Capture a release URL.
4. Run automated review (deterministic checks always). With `ENABLE_BROWSER_RUN=true` and a `BROWSER` binding, Browser Run acts as a human tester: opens the release URL, walks a short same-origin path, captures desktop and phone snapshots, and stores them as ordered first-use workflows (`browser_observation` only — never human outcomes). A bot challenge ends that path.

### Browser Run vs bot protection

OCLaunch **does not bypass WAF or bot challenges**. Cloudflare Browser Run is always identified as a bot. For automated snapshots of a release you control:

1. Prefer a preview / review URL that is not behind an interstitial, **or**
2. On your Cloudflare zone, create a WAF custom rule that **Skip**s Bot Detection ID `119853733` (Browser Run Quick Actions) — see [Cloudflare’s allowlist guide](https://developers.cloudflare.com/browser-run/faq/#can-i-allowlist-browser-run-on-my-own-website).

If Browser Run hits a challenge page, OCLaunch records an Access finding and keeps human review as the evidence path.
5. Create a Review Mission and open the invite as a second user.
6. Accept findings → create change set → **Export for coding agent**.
7. Generate a release report and optional redacted share (`/r/:id`).
8. Product Passport HTML is server-rendered at `/p/:slug` for public/unlisted projects.

## Supported draft-PR profile

React / Vite + Tailwind. Unsupported stacks should use agent export.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

## Design pack

Source design pack used for tokens/schema/wrangler reference lives in the Project store under `internal/oclaunch-design-pack/OCLaunch/`. Brand assets are copied into `apps/web/src/assets/`.
