# OCLaunch

**Build. Review. Improve.**

OCLaunch helps solo founders turn product feedback into reviewed improvements and better releases.

Platform address (production target): `https://launch.orangecloud.vn`  
Parent brand: Orangecloud / `orangecloud.vn`

## Stack

- React + Vite + TypeScript + Tailwind (`apps/web`)
- Cloudflare Workers + Hono API + Static Assets (`workers/platform`)
- D1 (authoritative data) + private R2 (artifacts)
- Shared Zod schemas/tokens (`packages/shared`)

## Quick start (local)

```bash
npm install
npm run build -w @oclaunch/shared
npm run build -w @oclaunch/web
npm run db:migrate:local -w @oclaunch/platform
npm run dev -w @oclaunch/platform
```

Open `http://localhost:8787`. Use **Continue as local founder** on the sign-in page (labeled dev bypass) or register a passkey.

For a split Vite UI + API proxy:

```bash
npm run dev
```

UI: `http://localhost:5173` · API: `http://localhost:8787`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | Shared + web + worker dry-run bundle |
| `npm run typecheck` | TypeScript across workspaces |
| `npm test` | Unit tests |
| `npm run db:migrate:local` | Apply D1 migrations locally |

## Documentation

- [Architecture & binding map](docs/architecture.md)
- [Deployment checklist](docs/deployment.md)
- [Development & integrations](docs/development.md)

## Status

This repository implements the OCLaunch MVP control plane and UI. GitHub draft PR, Browser Run human-tester snapshots, Workers AI suggestions, Sandbox builds, and live project-domain DNS require owner credentials and deploy approval — see Integrations in the app and `docs/deployment.md`.
