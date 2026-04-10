# workra

clarity in every working hour.

phase 1 — foundation: monorepo, auth, rooms, base layout.

## structure

```
workra/
├── apps/
│   ├── api/          express mvc + mongoose + jwt
│   └── web/          next.js app router + shadcn/ui
├── packages/
│   └── shared/       zod schemas and types shared across api/web
└── package.json      npm workspaces root
```

## prerequisites

- node >= 20
- mongodb (local or atlas)
- npm (workspaces-aware)

## setup

```bash
# from repo root
npm install

# backend env
cp apps/api/.env.example apps/api/.env
# then edit apps/api/.env — at minimum, set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET
# generate secrets with:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# frontend env (default points at http://localhost:4000)
cp apps/web/.env.example apps/web/.env.local
```

## run

two terminals, from repo root:

```bash
# terminal 1 — api on :4000
npm run dev:api

# terminal 2 — web on :3000
npm run dev:web
```

then open http://localhost:3000.

## what works in phase 1

- signup / login / logout / refresh (jwt access + httpOnly refresh cookie, rotated on every refresh)
- `/users/me`
- create room, list my rooms, join by 6-char invite code, view room
- sidebar + topbar layout with dashboard, rooms, calendar, reports
- room tabs (overview live, others are placeholder empty states)

## what is deliberately out of scope for phase 1

time tracking, sessions, files, tasks, chat, calendar, reports, websockets, admin, email verification, s3. placeholders exist so the layout is honest.

## production builds

phase 1 uses `tsx` as the api runtime in both dev and "start" so the shared workspace can ship raw `.ts`. a bundled api build (tsup/esbuild) will land with the deployment phase alongside the vercel/railway setup.

## commands

```bash
npm run dev:api            # start api (tsx watch)
npm run dev:web            # start web (next dev)
npm run typecheck -w @workra/api   # typecheck backend
npm run lint -w @workra/web        # lint frontend
```
