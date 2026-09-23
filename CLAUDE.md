# LittleSteps — Nursery School Management System

MERN monorepo for a single nursery school (Playgroup, Nursery, KG-1, KG-2): attendance, results,
meetings, notices and notifications, with role-specific dashboards.

**Requirements live in [docs/SRS.md](docs/SRS.md). Read it before implementing any feature** and
cite requirement IDs (e.g. `FR-TCH-05`) in commits/PRs. Note: the file is currently the SRS
_brief_ (requirements + the structure a full IEEE-830 SRS should follow), not the expanded SRS.

## Status

Foundation only: server boots, `/api/health` works, client shell + routing + data layer are in
place. No models, auth, or features yet.

## Stack

| Layer   | Tech                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| Server  | Node ≥ 20.19, Express **4** (not 5 — `express-mongo-sanitize` needs Express 4), Mongoose, Zod |
| Client  | React 19, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Router, TanStack Query v5, Axios |
| Tests   | Vitest + Supertest (server), mongodb-memory-server for integration tests                      |
| Tooling | npm workspaces, ESLint 9 flat config (per app), Prettier (root), concurrently                 |
| Deploy  | Client → Vercel, Server → Render, DB → MongoDB Atlas                                          |

## Commands (run from repo root)

```bash
npm install            # installs both workspaces
npm run dev            # server :5000 + client :5173 concurrently
npm run dev:server     # / dev:client
npm test               # server tests (Vitest)
npm run lint           # ESLint both apps   (lint:fix to autofix)
npm run format         # Prettier write     (format:check in CI)
npm run build          # client production build
```

Env: copy `server/.env.example` → `server/.env`, `client/.env.example` → `client/.env.local`.
`MONGODB_URI` is optional in development (API boots and `/api/health` reports
`database: "disconnected"`); required in production (server exits on failure).

## Layout

```
server/src/
  server.js        boot: env → DB → listen → graceful shutdown
  app.js           createApp(): middleware stack (exported for Supertest; no listen)
  config/          env.js (Zod-validated env — only place that reads process.env),
                   db.js, cors.js, constants.js (ROLES, ACCOUNT_STATUS, SCHOOL_TIMEZONE)
  routes/          index.js mounts every feature router under /api
  controllers/     thin HTTP adapters
  services/        business logic + DB access
  models/          Mongoose schemas
  validators/      Zod schemas per feature
  middleware/      errorHandler, notFound, rateLimiter (global + authLimiter), validate
  utils/           ApiError, apiResponse, asyncHandler, logger, date
server/tests/      *.test.js; helpers/db.js = in-memory Mongo replica set

client/src/
  app/             router.jsx, queryClient.js, providers.jsx
  lib/             axios.js (the only Axios instance), tokenStore.js
  config/          constants.js (ROLES, ROUTES, ROLE_HOME, NAV_ITEMS, SCHOOL_TIMEZONE)
  layouts/         PublicLayout, AuthLayout, DashboardLayout (role prop)
  routes/          ProtectedRoute, RoleRoute (pass-through until auth exists)
  components/ui/   shared presentational components
  features/<auth|admin|teacher|student>/{api,hooks,components,pages}
  hooks/ utils/ pages/   app-wide (non-feature) pieces
```

## Server conventions

- **ES modules everywhere**, always include the `.js` extension in relative imports.
- **Request flow:** `route → validate(zodSchemas) → controller → service → model`.
  - Controllers: read `req.validated` / `req.user`, call one service, respond. No DB calls, no
    business rules.
  - Services: all business logic, authorization-by-ownership checks, DB access. Throw `ApiError`.
  - Wrap every async controller in `asyncHandler` (Express 4 does not catch async errors).
- **Responses** — always via `utils/apiResponse.js`:
  - success `{ success: true, message, data, meta? }` (`meta` = pagination from `paginationMeta`)
  - error `{ success: false, message, errors?: [{ field, message, location? }], stack? }`
    (stack only in dev for 5xx). Produced solely by `middleware/errorHandler.js`.
- **Errors:** `throw ApiError.notFound('Student not found')` etc. Mongoose Cast/Validation,
  duplicate key 11000, Zod and JWT errors are translated centrally — don't catch them to reformat.
- **Validation:** Zod schemas in `validators/<feature>.validator.js`, applied with
  `validate({ body, query, params })`. Parsed data is on `req.validated.*`.
- **Env:** never read `process.env` outside `config/env.js`; add new vars to the schema and both
  `.env.example` files.
- **Naming:** files `camelCase.js` with suffixes — `user.model.js`, `user.service.js`,
  `user.controller.js`, `user.routes.js`, `user.validator.js`. Models `PascalCase` singular.
  Routes plural, kebab-case (`/api/teacher-assignments`).
- **Lists** are paginated (`?page=&limit=`) and must hit indexed fields.
- Record admin overrides and critical changes in AuditLog (FR-ADM-09/11).

## Client conventions

- Components never import Axios. Pattern: `features/x/api/*.js` (functions calling `api`) →
  `features/x/hooks/use*.js` (TanStack Query) → components.
- `api` resolves with the server envelope `{ success, message, data, meta }` and rejects with
  `ApiClientError { status, message, errors }`.
- Query keys: a `xKeys` factory per feature (`studentKeys.detail(id)`); invalidate on mutation.
- Server state lives in TanStack Query — no Redux/Context copies of server data.
- Pages are lazy-loaded in `app/router.jsx`; layouts provide the `<Suspense>` boundary.
- Tailwind only (no CSS modules). Mobile-first: guardians mostly use phones. Use the theme
  tokens in `index.css` (`brand-*`, `present`, `absent`, `late`).
- `RoleRoute`/`ProtectedRoute` are UX only — **security is enforced by the API**.

## Roles & access rules

| Role      | Scope                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `admin`   | Everything: users & approvals, classes/sections/subjects/sessions, teacher assignments, enrollment, meetings, notices, overrides, settings, audit logs |
| `teacher` | Only class + section + subject combos in their **TeacherAssignment**s: attendance, assessments/results, meetings for own sections                      |
| `student` | Read-focused, **own records only**; used by the guardian (children don't log in themselves)                                                            |

- Account status `pending | active | suspended`; only `active` can log in. No one gets in until
  an admin creates/approves the account.
- Ownership checks (teacher ↔ assignment, student ↔ own data) go in **services**, on every
  endpoint, never only in the UI.
- Children's data is sensitive: never return guardian contact details or other students' data to
  roles that don't need it.

## Auth & deployment decision (same-origin API)

- **Access token:** short-lived JWT, kept **in memory only** (`client/src/lib/tokenStore.js`),
  sent as `Authorization: Bearer`. Never in localStorage/sessionStorage.
- **Refresh token:** HTTP-only, `Secure`, `SameSite=Lax` (or `Strict`) cookie scoped to
  `/api/auth`, rotated on every refresh. On page load the client calls `/api/auth/refresh` to
  recover a session. The Axios interceptor already does single-flight refresh on 401 once the auth
  feature registers `setRefreshHandler()`.
- **The client always calls the relative path `/api`** — in dev via the Vite proxy
  (`client/vite.config.js`), in prod via a **Vercel rewrite** (`client/vercel.json`) that proxies
  `/api/*` to the Render service. The browser therefore sees the API as first-party, so the refresh
  cookie is not a third-party cookie and is not blocked by Safari/iOS ITP.
  - Do **not** introduce an absolute API base URL (`VITE_API_URL`) or cross-site cookies
    (`SameSite=None`).
  - Replace the `YOUR-RENDER-SERVICE` placeholder in `client/vercel.json` when deploying.
  - Server sits behind 2 proxies in prod (Vercel → Render): set `TRUST_PROXY=2` and confirm
    `req.ip` is the real client IP before trusting per-IP rate limits.
  - CORS only matters for direct (non-proxied) calls; keep `CLIENT_ORIGIN` tight.

## Dates & timezone (important)

- The school timezone is **Asia/Dhaka** (`SCHOOL_TIMEZONE`).
- Attendance dates (and any other "calendar day" fields) are calendar dates interpreted in
  Asia/Dhaka and **stored normalized as UTC midnight of that date** (2026-09-23 →
  `2026-09-23T00:00:00.000Z`). APIs exchange them as `'YYYY-MM-DD'` keys.
- **All date logic goes through the shared date utility**:
  - server: `server/src/utils/date.js` — `toSchoolDate`, `todaySchoolDate`, `toDateKey`,
    `isValidDateKey`, `addDays`, `monthRange`, `schoolDateKeyOf`
  - client: `client/src/utils/date.js` — `todayDateKey`, `formatSchoolDate` (formats in UTC so the
    day never shifts), `formatDateTime` (real instants, shown in Asia/Dhaka)
  - Never use `new Date().setHours(0,0,0,0)`, `toLocaleDateString()` without a timeZone, or raw
    date arithmetic in services/components. Extend the utility (with tests) instead.
- Real instants (`createdAt`, `markedAt`, meeting `dateTime`) stay as normal UTC timestamps.

## Testing

- Unit/HTTP tests: import `createApp()` from `src/app.js` and use Supertest (no port binding).
- Integration tests with a DB: `beforeAll(startTestDB)`, `afterEach(clearTestDB)`,
  `afterAll(stopTestDB)` from `tests/helpers/db.js` (single-node replica set, so transactions
  work). The first run downloads a mongod binary (~600 MB, cached in `~/.cache/mongodb-binaries`).
- Every new service/endpoint gets tests, including a forbidden-access test for each role that
  should not reach it.

## Don'ts

- No business logic in controllers or route files; no Axios calls in components.
- No `process.env` outside `config/env.js`; no secrets in client env (`VITE_*` is public).
- No date math outside the date utilities.
- Don't upgrade Express to 5 without replacing `express-mongo-sanitize`.
- Don't implement a feature without checking its FR IDs in `docs/SRS.md`.
