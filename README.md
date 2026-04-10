## workra

a small workspace for tracking time on client work without juggling four different tabs.

i built this for myself. i kept losing context between a timer app, a notes doc, and whatever chat thread the client was in. workra is one place to start a session, write down what you actually did, and look back later. nothing more than that for now.

## what's in it

- accounts: signup, login, refresh tokens (short-lived access token, http-only refresh cookie)
- rooms: one per client or project, joined by a 6-character code or an invite link
- sessions: start with an intent, stop with a summary, only one running at a time per user
- room time tab: every session grouped by day, with totals
- activity log behind the scenes for room and session events
- left sidebar, top bar with the global timer, room tabs along the top of each room

## what's not done yet

tasks, files, calendar, chat, reports, deliverables. the tabs exist but the pages are placeholders. real-time sync is on polling for now.

## stack

- backend: express, mongoose, zod, pino, jwt
- frontend: next.js (app router), tailwind, shadcn/ui, zustand, tanstack query, react-hook-form
- shared: a small zod schema package used by both sides
- monorepo via npm workspaces

```
workra/
├── apps/
│   ├── api/          express + mongoose + jwt
│   └── web/          next.js + shadcn/ui
├── packages/
│   └── shared/       zod schemas and types
└── package.json      workspaces root
```

## requirements

- node 20 or newer
- mongodb running somewhere (local works, atlas works)
- npm (workspaces aware)

## install

```bash
# from the repo root
npm install
```

backend env:

```bash
cp apps/api/.env.example apps/api/.env
```

open `apps/api/.env` and fill in `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. you can generate them with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

set `MONGODB_URI` to your local or atlas connection string. `WEB_ORIGIN` should match where the frontend runs (default `http://localhost:3000`).

frontend env:

```bash
cp apps/web/.env.example apps/web/.env.local
```

the default points at `http://localhost:4000` for the api, which matches the dev script.

## run

two terminals, both from the repo root:

```bash
# terminal 1, api on port 4000
npm run dev:api

# terminal 2, web on port 3000
npm run dev:web
```

then open http://localhost:3000, sign up, create a room, and start a session from the top bar.

## commands

```bash
npm run dev:api                     # start api (tsx watch)
npm run dev:web                     # start web (next dev)
npm run typecheck -w @workra/api    # typecheck backend
npm run lint -w @workra/web         # lint frontend
```

## notes

the api runs through `tsx` in both dev and start so the shared workspace can ship raw typescript. a bundled build will come when there's a real deploy target.
