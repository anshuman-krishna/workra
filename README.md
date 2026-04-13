## workra

a structured workspace for freelancers. time tracking, tasks, files, chat, reports, and a calendar, organized into rooms. each room is a client or project.

i built this for myself. i kept losing context between a timer app, a notes doc, and whatever chat thread the client was in. workra is one place to start a session, write down what you actually did, and look back later.

## what's in it

- **rooms** -- each room is a client, project, or workspace. members join with a 6-character invite code.
- **sessions** -- start a timer, declare your intent, stop when done. every session builds a traceable record.
- **tasks** -- lightweight task board per room. statuses: todo, in progress, done.
- **files** -- upload files to a room. same filename creates a new version automatically.
- **chat** -- per-room messaging with live updates over websockets.
- **calendar** -- monthly view with sessions, completed tasks, and events. github-style heatmap across all rooms.
- **reports** -- generate per-room reports for any date range. copy, download as pdf, or enhance the narrative with ai.
- **daily recap** -- dashboard card summarizing today's tracked time, sessions, and completed tasks.
- **ai layer** -- optional. when an anthropic api key is set, the system generates better session summaries, report narratives, and daily recaps. when it's not set, everything still works with deterministic fallbacks.
- **admin panel** -- users with the admin role can view system-wide stats, user list, and room list at `/admin`.

## stack

- backend: express, mongoose, zod, pino, jwt, socket.io
- frontend: next.js (app router), tailwind, shadcn/ui, zustand, tanstack query, react-hook-form
- shared: zod schemas and typescript interfaces used by both sides
- ai: anthropic messages api (claude haiku), optional
- storage: s3-compatible or local disk
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
npm install
npm run build:shared
```

backend env:

```bash
cp apps/api/.env.example apps/api/.env
```

open `apps/api/.env` and fill in `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. generate them with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

set `MONGODB_URI` to your local or atlas connection string. `WEB_ORIGIN` should match where the frontend runs (default `http://localhost:3000`).

to enable ai features, set `ANTHROPIC_API_KEY`. leave it blank to use deterministic fallbacks.

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

### with docker

```bash
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env as needed

docker compose up
```

## commands

```bash
npm run dev:api                     # start api (tsx watch)
npm run dev:web                     # start web (next dev)
npm run build                       # build all packages
npm run typecheck -w @workra/api    # typecheck backend
npm run lint -w @workra/web         # lint frontend
```

## deployment

- **frontend**: vercel or any node host. set `NEXT_PUBLIC_API_URL` to your api url. next.config is set to standalone output.
- **backend**: railway, render, or any container host. the Dockerfile is in `apps/api/`.
- **database**: mongodb atlas or any hosted mongodb.

## admin

to make yourself admin:

```bash
# in mongosh
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

then visit `/admin` in the web app.

## environment variables

all env vars are documented in `apps/api/.env.example`. the important ones:

| variable | required | notes |
|----------|----------|-------|
| `MONGODB_URI` | yes | connection string |
| `ACCESS_TOKEN_SECRET` | yes | min 32 chars |
| `REFRESH_TOKEN_SECRET` | yes | min 32 chars, different from above |
| `ANTHROPIC_API_KEY` | no | enables ai features |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `WEB_ORIGIN` | no | defaults to `http://localhost:3000` |

## notes

the api runs through `tsx` in both dev and production so the shared workspace can ship raw typescript. dockerfiles are provided for containerized deployment.

## license

not yet decided.
