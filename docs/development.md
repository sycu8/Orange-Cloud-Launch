# Development

## Environment

Copy `.env.example` values into `workers/platform/.dev.vars` as needed. Wrangler `[vars]` already enable local `DEV_AUTH_BYPASS`.

## Main local loop

1. Sign in (dev login or passkey).
2. **Add your project** (private by default).
3. Capture a release URL.
4. Run automated review (deterministic checks always; Browser Run reports not-configured).
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
