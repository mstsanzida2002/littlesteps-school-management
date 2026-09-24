# LittleSteps — Nursery School Management System

MERN monorepo for a single nursery school (Playgroup, Nursery, KG-1, KG-2): attendance, results,
meetings, notices and notifications, with role-specific dashboards.

**Requirements live in [docs/SRS.md](docs/SRS.md). Read it before implementing any feature** and
cite requirement IDs (e.g. `FR-TCH-05`) in commits/PRs. Note: the file is currently the SRS
_brief_ (requirements + the structure a full IEEE-830 SRS should follow), not the expanded SRS.

## Status

The whole server side of the SRS is done; the UIs are next:

- The server boots and `/api/health` works; the client shell, routing and data layer are in place.
- All Mongoose models exist with tests, and a dev seed script is available.
- **Auth (FR-AUTH-01…06)** is complete on server and client, including the RBAC and ownership
  guards.
- **Admin module** (FR-ADM-01…06, 10, 11) is done on the server: users, registrations, academic
  structure, teacher assignments, settings and the audit log. The admin UI is not built yet.
- **Attendance** (FR-TCH-03…07, SRS 3.6), the attendance override (FR-ADM-09) and
  **notifications** (FR-NOT-01…05: in-app, Socket.io, optional email) are done on the server.
  The client has the notification bell with a live unread count.
- **Results** (FR-TCH-08…12, FR-STU-05, result override FR-ADM-09), **meetings** (FR-ADM-07,
  FR-TCH-13/14, FR-STU-06/07), **notices** (FR-ADM-08, FR-STU-08) and the three **dashboards**
  (SRS §4) are done on the server.
- **Design system** (direction D "Guava", `docs/design/`) is done: tokens, the logo, shared
  components, chart wrappers, forms with server errors, and the app shell. Login and change
  password use it. See "Design system" below and `/styleguide` (development only).
- **Teacher UI** is done: dashboard, take / view / edit attendance, class summary and student
  history, assessments and result entry, meetings, notices, and the notifications page (shared by
  every role). See "Teacher screens" below.
- **E2E suite** (Playwright, `npm run e2e`) runs against an in-memory database. See "E2E suite".
- Not yet built: the student and admin UIs (their nav items show a "coming soon" page, except
  notices and notifications, which work for every role).

## Stack

| Layer   | Tech                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| Server  | Node ≥ 20.19, Express **4** (not 5 — `express-mongo-sanitize` needs Express 4), Mongoose, Zod |
| Client  | React 19, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Router, TanStack Query v5, Axios |
| UI      | lucide-react icons, Recharts, react-hook-form + Zod (`zod/mini`), Fontsource fonts            |
| Tests   | Vitest + Supertest (server), mongodb-memory-server for integration tests; Vitest (client)     |
| Auth    | jose (JWT access tokens, HS256), bcryptjs (password hashing), opaque rotated refresh cookie   |
| Tooling | npm workspaces, ESLint 9 flat config (per app), Prettier (root), concurrently                 |
| Deploy  | Client → Vercel, Server → Render, DB → MongoDB Atlas                                          |

### Dependency versions (pinned)

All dependencies are pinned to exact versions (no `^`/`~`); `.npmrc` sets `save-exact=true` and
`package-lock.json` is committed. Upgrades are deliberate: bump the exact version, run
`npm install`, then lint + test + build.

| Package                | Major | Package                         | Major |
| ---------------------- | ----- | ------------------------------- | ----- |
| express                | 4     | react / react-dom               | 19    |
| **mongoose**           | **9** | **react-router**                | **8** |
| zod                    | 4     | **vite**                        | **8** |
| dotenv                 | 18    | @vitejs/plugin-react            | 6     |
| helmet                 | 8     | tailwindcss / @tailwindcss/vite | 4     |
| express-rate-limit     | 8     | @tanstack/react-query           | 5     |
| express-mongo-sanitize | 2     | axios                           | 1     |
| **vitest**             | **5** | eslint / @eslint/js             | 9     |
| supertest              | 7     | eslint-plugin-react-hooks       | 7     |
| mongodb-memory-server  | 11    | prettier                        | 3     |
| **jose**               | **6** | bcryptjs                        | 3     |
|                        |       | **lucide-react**                | **1** |
|                        |       | **recharts** (+ react-is 19)    | **3** |
|                        |       | react-hook-form                 | 7     |
|                        |       | **@hookform/resolvers**         | **5** |
|                        |       | zod (client uses `zod/mini`)    | 4     |
|                        |       | @fontsource(-variable)          | 5     |

Exact versions are in each `package.json`.

**Check the installed API; don't rely on memory.** Mongoose 9, React Router 8, Vite 8, Vitest 5 and jose 6
(also Zod 4, dotenv 18, express-rate-limit 8, Recharts 3, lucide-react 1, @hookform/resolvers 5) are newer than most examples online and than older
training data. Before using any API from them, check the installed package's type definitions
(`node_modules/<pkg>/**/*.d.ts`) or its bundled docs/changelog. Don't copy patterns from older
majors, e.g. `react-router-dom` imports, Mongoose callback APIs, `max` instead of `limit`
in express-rate-limit, or Zod 3's `error.errors`.

## Commands (run from repo root)

```bash
npm install            # installs both workspaces
npm run dev            # server :5000 + client :5173 concurrently
npm run dev:server     # / dev:client
npm test               # server + client tests (Vitest)
npm run e2e            # Playwright suite (own API + client, in-memory database)
npm run e2e:screens    # screenshots of every teacher screen → docs/design/screens/teacher
npm run lint           # ESLint both apps   (lint:fix to autofix)
npm run format         # Prettier write     (format:check in CI)
npm run build          # client production build
npm run seed -- --reset   # wipe + reseed the dev database (see "Databases & seed")
npm run migrate           # apply pending migrations (-- --status to list them)
```

Env: copy `server/.env.example` → `server/.env`, `client/.env.example` → `client/.env.local`.
`MONGODB_URI` is optional in development (API boots and `/api/health` reports
`database: "disconnected"`); required in production (server exits on failure).

## Databases & seed

- One Atlas cluster, two databases, selected by the **database name in `MONGODB_URI`**:
  - `littlesteps_dev`: development (local `server/.env`)
  - `littlesteps`: production (Render env only)
  - Tests never touch Atlas; they use mongodb-memory-server.
- `npm run seed` (`server/src/seed/seed.js`, data in `seedData.js`):
  - Prints the connected database name first.
  - Refuses when `NODE_ENV=production`, and refuses **any** write unless the database name ends
    in `_dev` or `_test`.
  - Without `--reset` it refuses if data already exists; `--reset` clears every LittleSteps
    collection first, so it can be re-run.
  - Creates the active session, default Settings, 4 classes × sections A/B, 5 subjects, 1 admin,
    4 class teachers (40 assignments, Sun–Thu timetable: section A 08:00, section B 10:45), 40
    students with guardians, and whole-day attendance for the last 30 calendar days on school
    days only. Today is left unmarked, and 4 students are deliberately below 75%.
  - Also creates demo content (`seed/demoContent.js`) for every class-section:
    - a **published** English class test (marks, a few absent) and a published Drawing
      portfolio (remarks);
    - a **draft** Math class test, half entered;
    - meetings: an all-school PTM with RSVPs, a Playgroup-A online chat, and a cancelled KG-2
      orientation;
    - notices: one pinned, one for teachers, one expired;
    - the matching notifications.
  - **`--large`**: about 500 students (8 × 63) with the same 30 days of attendance (~55k records)
    and more meetings and notices, for performance testing. Seed it into a separate
    `*_perf_dev` database (override `MONGODB_URI`) so `littlesteps_dev` keeps its demo data.
  - **`--e2e`**: also leaves the newest school day on or before today unmarked (today is an off
    day on Fridays and Saturdays), so browser tests always have a day to take attendance on.
  - The data is created by `seed/seedDatabase.js` (importable); `seed/seed.js` is only the CLI
    (safety checks, `--reset`).
  - Seeded accounts have `mustChangePassword: false`.
  - Dev logins: `admin` / `Admin@1234`, teachers `<first>.<last>` / `Teacher@1234`, students
    `<class>-<section>-<roll>` (e.g. `kg1-a-03`) / `Student@1234`. The script prints them all.
- The free M0 tier throttles bursts: keep bulk maintenance operations sequential, not
  `Promise.all` over every collection.

## Migrations (every schema change needs one)

- **Rule:** any schema change (new field, changed default, new or changed index, renamed field)
  ships with a migration in `server/src/migrations/NNN-short-name.js`:
  `export default { description, async up({ db, mongoose, logger }) { … } }`.
  - Migrations are forward-only (no "down"). `up` must be **idempotent**, e.g. using
    `$exists: false` filters and `createIndex`.
  - Use the native `db` handle, not the Mongoose models, so a migration keeps working after the
    models change.
- **Runner** (`src/migrations/runner.js`): applies pending files in name order and records each in
  the `migrations` collection.
  - The lock is taken **only when something is pending**, so ordinary restarts and multiple
    instances never wait on each other.
  - A lock document in `migration_lock` serializes runners (several instances, or startup racing
    a manual run). The holder refreshes `heartbeatAt` every 5 s; a lock with no heartbeat for
    30 s (a crashed or killed runner, e.g. a dev `--watch` restart mid-migration) is taken over.
  - If a migration fails, it isn't recorded and the lock is released.
- **Two ways to run them (both are safe together, because of the lock):**
  1. **Automatically at server start-up**, before listening (`server.js`). If a migration fails,
     the server exits, so it never serves traffic on a half-migrated database. In development,
     when the first connection is retried in the background, migrations run once it succeeds.
     This way deploys don't depend on the host.
  2. **Manually or as a pre-deploy step:** `npm run migrate` (status: `npm run migrate -- --status`).
     On Render, it can be the Pre-Deploy Command (`npm run migrate -w server`), but that's
     optional.
- `seed --reset` records every migration as applied (baseline), since freshly seeded data already
  has the current schema.
- Applied so far: `001-teacher-assignment-status`, `002-attendance-notifications`,
  `003-results-meetings-notices`.

## Database outages

- While MongoDB is unreachable, every `/api` route except `/api/health` returns **503
  `DATABASE_UNAVAILABLE`** "Service temporarily unavailable" (`middleware/requireDatabase.js`).
  `bufferTimeoutMS` is 5 s, and driver/selection errors are also mapped to 503.
- **Development:** if the first connection fails, the API still starts and retries in the
  background (5 s → 60 s backoff), then runs migrations.
- **Production:** if the first connection fails, the server exits so the deploy fails loudly;
  Render restarts it.
- After any successful connect, the MongoDB driver reconnects on its own.

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
  models/          Mongoose schemas (*.model.js), index.js barrel, helpers/schemaTypes.js
  validators/      Zod schemas per feature
  middleware/      auth (authenticate, authorize), ownership guards, rateLimiter (per-app
                   factories), validate, errorHandler, notFound
  utils/           ApiError, apiResponse, asyncHandler, logger, date, password
  seed/            dev seed script + static demo data (npm run seed)
server/tests/      *.test.js; helpers/db.js = in-memory Mongo replica set

client/src/
  app/             router.jsx, queryClient.js, providers.jsx
  lib/             axios.js (the only Axios instance), tokenStore.js
  config/          constants.js (ROLES, ROLE_LABELS, ROUTES, ROLE_HOME, NAV_ITEMS),
                   statuses.js (every status → icon, label, tone)
  layouts/         PublicLayout, AuthLayout, DashboardLayout (role prop)
  routes/          ProtectedRoute (signed in?), RoleRoute (role allowed?)
  assets/brand/    logo-original.png (source) + logo-280/560 .webp/.png (transparent exports)
  components/brand/  Logo, LogoMark (flat footprint SVG), LogoLink; logoAssets.js (srcsets, preload)
  components/ui/     shared components (see "Design system")
  components/layout/ Sidebar, AppHeader, BottomNav, MoreSheet (the dashboard shell)
  components/charts/ TrendLineChart, ComparisonBarChart, CalendarHeatmap, ChartFigure, summaries
  features/<area>/{api,hooks,components,pages}
                   areas: auth, school (settings + my assignments), dashboard, attendance,
                   results, meetings, notices, notifications; pages per role in teacher/ …
  config/paths.js  URL builders (teacherPaths) and notificationLink(notification, role)
  lib/             errorMessages.js (every error code → words), serverErrors.js,
                   realtimeInvalidation.js (notification type → query keys)
  hooks/           useZodForm, useUnsavedChanges, useMediaQuery, useDocumentTitle
  dev/styleguide/  /styleguide page (development only; not in production builds)
  __tests__/       client unit tests (Vitest, node environment)
  utils/ pages/    app-wide (non-feature) pieces
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
  - error `{ success: false, message, code?, errors?: [{ field, message, location? }], details?,
stack? }`. Produced solely by `middleware/errorHandler.js`; stack only in dev for 5xx.
  - `code` is a machine-readable `ERROR_CODES` value (`config/constants.js`). Clients branch on
    `code`, never on `message`. `details` carries structured context (clash list, reference
    counts, next free roll…).
  - Raise them with `new ApiError(status, message, errors, { code, details })`, the shortcut
    methods (`ApiError.conflict(msg, errors, { code, details })`), or
    `ApiError.invalidField(field, msg)` for a single-field 422.
- **Errors:** `throw ApiError.notFound('Student not found')` etc. Mongoose Cast/Validation,
  duplicate key 11000 and Zod errors are translated centrally — don't catch them to reformat.
  JWT errors become 401s inside `verifyAccessToken`.
- **Validation:** Zod schemas in `validators/<feature>.validator.js`, applied with
  `validate({ body, query, params })`. Parsed data is on `req.validated.*`.
- **Env:** never read `process.env` outside `config/env.js`; add new vars to the schema and both
  `.env.example` files.
- **Naming:** files `camelCase.js` with suffixes — `user.model.js`, `user.service.js`,
  `user.controller.js`, `user.routes.js`, `user.validator.js`. Models `PascalCase` singular.
  Routes plural, kebab-case (`/api/teacher-assignments`).
- **Lists** (`utils/listQuery.js`):
  - The query schema comes from `listQuerySchema({ sortable, defaultSort, filters })`:
    `page` (≥1), `limit` (1–100, default 20), `search` (special characters escaped,
    case-insensitive), `sort` (`field` / `-field`, only from an allowed list).
  - Run the query with `paginate(Model, filter, { page, limit, sort, select, populate })` →
    `{ items, meta: { page, limit, total, totalPages } }`. Respond
    `sendSuccess(res, { data: items, meta })`.
  - Filters must hit indexed fields.
- **Audit** (`services/audit.service.js`): every admin create/update/delete/status change calls
  `recordAudit({ actorId, action, entityType, entityId, before?, after?, meta }, { session? })`.
  - Use `diffChanges(before, after)` so only changed fields are stored.
  - Secrets (`password*`, `tokenVersion`) are always stripped.
  - Actions are dotted verbs: `user.create`, `user.suspend`, `assignment.end`,
    `settings.update`, …
  - `meta` = `requestMeta(req)` (`utils/requestMeta.js`).
- **Transactions:** `withTransaction(async (session) => …)` (`utils/transaction.js`). Pass
  `{ session }` to every read and write inside; for `Model.create` use the array form,
  `Model.create([doc], { session })`.
  - Use them wherever several documents must change together (user + profile, approval,
    delete cascade, session switch).
- **Deletes** are refused while anything references the entity:
  `assertNotReferenced(kind, id, label)` → 409 `IN_USE` with counts. Users with history →
  409 `USER_HAS_HISTORY` (suspend instead). Extend `services/reference.service.js` when new
  collections reference existing entities.
- **Models** (`src/models/<name>.model.js`, exported from `src/models/index.js`):
  - Build fields from `models/helpers/schemaTypes.js`: `ref()`, `schoolDate()` (every
    calendar-date field), `phone()` (Bangladeshi mobile), `optionalEmail()`, `baseSchemaOptions`.
  - Declare indexes with `schema.index()`. Rules that span documents (a section belongs to its
    class, `teacherId` is a teacher, marks ≤ totalMarks) are enforced in services, not models.
  - Mongoose 9: `pre` hooks get **no `next`**; throw (or return a rejected promise) to fail.
    Use `returnDocument: 'after'`, not `new: true`.
  - Enums shared across layers live in `config/constants.js`; model-specific enums are exported
    from the model file (e.g. `ASSESSMENT_TYPES`).
  - Read Settings only via `Settings.get()` (single document, created with defaults if missing).
  - Hash passwords with `utils/password.js` (bcryptjs, cost 12). `passwordHash` is
    `select: false` and removed by `toJSON`.
  - AuditLog is append-only: updates throw.
- Record admin overrides and critical changes in AuditLog (FR-ADM-09/11).

## Client conventions

- Components never import Axios. Pattern: `features/x/api/*.js` (functions calling `api`) →
  `features/x/hooks/use*.js` (TanStack Query) → components.
- `api` resolves with the server envelope `{ success, message, data, meta }` and rejects with
  `ApiClientError { status, message, errors }`.
- Query keys: a `xKeys` factory per feature (`studentKeys.detail(id)`); invalidate on mutation.
- Server state lives in TanStack Query — no Redux/Context copies of server data.
- Pages are lazy-loaded in `app/router.jsx`; layouts provide the `<Suspense>` boundary.
- Tailwind only (no CSS modules). Mobile-first (design at 375px, then scale up): guardians
  mostly use phones, often mid-range Android on slow data. Use the tokens in `index.css`, never
  raw hex values in components (chart SVG attributes use `components/charts/chartTheme.js`).
- `RoleRoute`/`ProtectedRoute` are UX only — **security is enforced by the API**.
- **Errors in words:** show API errors through `lib/errorMessages.js` (`friendlyError`,
  `errorMessage`). It has a message for every server `ERROR_CODES` value (a unit test compares
  the two lists), prefers the code, then the status, and keeps the server's own message where it
  is more specific (403/404/409/422, login 401s, roll numbers, clashes). Forms, `ErrorState` and
  toasts all use it. Adding a server error code means adding its message here.
- **Live updates:** the shell mounts `useRealtimeInvalidation`: every pushed notification
  invalidates the query roots it is about (`lib/realtimeInvalidation.js`: absence → attendance,
  results, meetings, notices) plus every dashboard. Query keys start with those roots
  (`['attendance', …]`, `['results', …]`, `['meetings', …]`, `['notices', …]`,
  `['dashboard', role]`). Mutations invalidate their root and `['dashboard']`. There is no
  separate "data changed" socket event yet.
- **Loading / error / empty:** wrap queries in `<QueryState query loading>` (skeleton, then
  ErrorState with "Try again"); every list has an EmptyState.
- **Unsaved work:** `useUnsavedChanges(isDirty)` → `{ blocker, allowNavigation }`; render
  `<UnsavedChangesDialog blocker />`, and call `allowNavigation()` right before navigating
  away after a successful save.
- **URLs:** build them with `config/paths.js` (`teacherPaths.takeAttendance({ classId, … })`);
  filters and selections live in the query string, so links and the back button work.

## Teacher screens

| Route (`/teacher/…`)                              | Screen                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| (index)                                           | Dashboard: today's classes (take attendance), stats, 30-day charts, absentees, drafts, meetings |
| `attendance`                                      | Take attendance: class, day chips, roster, sticky counts, confirm                               |
| `attendance/records`                              | Day view per class-section; edit a record or a whole day with a reason                          |
| `attendance/summary`                              | Range and subject filters, daily rate chart, students by percent                                |
| `students/:id/attendance`                         | One student: session %, by subject, calendar, recent days                                       |
| `results`, `results/new`, `…/:id/edit`            | Assessments (All / Drafts / Published) and the create / edit form                               |
| `results/:id`                                     | Result entry (grid on desktop, cards on phones), publish, edits                                 |
| `meetings`, `meetings/new`, `…/:id`, `…/:id/edit` | List, own-scope form, details with replies, cancel                                              |
| `notices`, `notifications`                        | Read-only notices; notifications (both routes exist for every role)                             |

- **Lookups:** `GET /api/settings/school` (any signed-in user: rules, today's Dhaka date, the
  session) and `GET /api/teacher-assignments/mine` (teachers: own class-sections with subjects,
  timetable and `wholeClasses`). Both are cached for 5 minutes (`features/school`).
- **Take attendance** (built for speed on a phone):
  - Day chips come from `markableSchoolDays()` (`utils/schoolDays.js`): today and earlier
    school days within `attendanceBackdateDays`, skipping off days and days outside the
    session. A day from the URL that isn't allowed shows the OFF_DAY / BACKDATE_LIMIT message
    (fallback only).
  - Everyone starts Present; rows are memoised native radio groups (48px buttons). The request
    sends `defaultStatus: 'present'` plus the exceptions only.
  - Subjects: the sheet's scheduled ones. When some are already taken, only the rest are sent
    (`subjectIds`). When none are scheduled, the teacher ticks their own subjects.
  - Double submission is blocked (ref + disabled button), and `ALREADY_MARKED` or an
    already-taken day shows "Already taken — view or edit".
- **Result entry:** grades are previewed with `utils/grading.js` (same threshold rule as the
  server) using the assessment's snapshot once published and the school scale for drafts. Drafts
  send only touched rows (`features/results/entryRows.js`); API errors `entries.<i>.<field>`
  are mapped back to students. Publish saves first if needed. `RESULTS_INCOMPLETE` returns
  `details.students` (`{ studentId, name, rollNo, problem }`), which are highlighted.
- **Meetings:** teachers invite their class-sections, whole classes from `wholeClasses`, or
  chosen students (roster from the class summary). Date and time are Dhaka wall-clock
  (`schoolDateTimeParts` for editing).

## Design system (direction D "Guava")

Palette from the logo: Charleston `#1E3309` (brand), Citron `#849A28`, Cerise `#E23260`, Deep
Blush `#F2678E`, Light Pink `#FCA9AA`. Preview and screenshots: `docs/design/`.

**Tokens** (`client/src/index.css`, Tailwind v4 `@theme`, no tailwind.config.js)

- Scales `brand-*`, `citron-*`, `cerise-*`, `blush-*`, `sand-*`; semantic `page`, `surface`,
  `ink`, `muted`, `line`, `line-strong`, `focus`; status tones `present`, `absent`, `late`,
  `excused`, `neutral`, `info`, each with a fill, `-ink` (AA text) and `-soft` (background);
  `rounded-card`, `rounded-control`, `shadow-card`, `shadow-raised`; the `touch-target` utility.
- **Contrast:** Citron (3.2:1 on white) and Cerise (4.3:1) are fills and graphics only; text uses
  the `-700` / `-ink` shades. **Cerise is never used for success.** Base font size 17px.
- Fonts are self-hosted (Fontsource, imported in `main.jsx`): Outfit Variable (Latin) with Hind
  Siliguri for Bangla. Both use unicode-range subsets and `font-display: swap`, so the Bangla
  fonts download only when Bangla is on screen. Mark Bangla text with `lang="bn"` (font and
  taller lines).

**Statuses** (`config/statuses.js`): attendance, publication (draft/published), account, RSVP
(`will_attend` / `cannot_attend` / null = no response) and meeting states. Every status has an
icon **and** a label: render `<StatusBadge group value />` or use `getStatus()`; never colour
alone. Add new statuses there (a unit test checks every server value).

**Logo** (`components/brand`)

- Full logo (`<Logo>`, `<LogoLink>`): login (large, centred; preloaded on `/login` only, by
  `preloadLoginLogo()` in `main.jsx`, while the session check runs), the expanded sidebar and
  the public header. Light surfaces only: its dark green "Little" disappears on dark ones.
  width/height are always set, so it never shifts the layout. The link goes to the user's
  dashboard, or to login when signed out; its name is "LittleSteps".
- Compact mark (`<LogoMark>`, inline SVG of the logo's footprint): collapsed sidebar, mobile
  header, loaders, and the icons in `public/` (`favicon.svg`, `favicon-32.png`,
  `apple-touch-icon.png`).
- The transparent logo was cut out automatically from the 3D render: clean on light backgrounds,
  with faint patches in the soft shadows on dark ones. If a designer-made transparent PNG
  arrives, re-export it with the same file names and the 280 × 241 ratio.

**Components** (`components/ui`): Button/IconButton (`buttonClasses` for links), Input,
PasswordInput, Textarea, Select (native), Checkbox, RadioGroup (`segmented` for fast status
picking), DatePicker, FormField, Card, StatCard, Badge/StatusBadge, ProgressRing, Modal, Drawer,
ConfirmDialog (optional required reason), Tabs/TabPanel, DataTable (a table from md, cards on
phones), Pagination (API meta), SearchInput (debounced), FilterBar (bottom sheet on phones),
EmptyState, ErrorState (by status), Alert, Skeleton, Toaster + `toast.*`, Avatar (Bangla
initials), NotificationBell (presentational; the connected one is in `features/notifications`),
Spinner, PageHeader (also sets the tab title) and PageTitle.

- Dialogs are native `<dialog>` + `showModal()` (focus trap, Esc, focus return). Modals are
  bottom sheets on phones.
- **DatePicker values are `'YYYY-MM-DD'` Dhaka keys**, never Dates; build min/max with
  `todayDateKey()` and `addDaysToKey()`.
- Accessibility: 44px touch targets (`sm` buttons grow on coarse pointers), visible focus rings
  (`:focus-visible`), labels and descriptions wired by FormField, `prefers-reduced-motion`
  honoured globally (Recharts animations follow it too), and a skip link in the shell.

**Forms**: `useZodForm(schema, { defaultValues })` (react-hook-form + zodResolver). Submit with
`form.submit(async (values) => mutation.mutateAsync(values))`. A thrown ApiClientError puts 422
field errors on their fields (dotted paths such as `entries.2.marksObtained` work; the first one
is focused) and everything else in `form.formError` (show it in `<Alert tone="error">`). The
logic is in `lib/serverErrors.js`.

- **Client schemas use `zod/mini`** (`import * as z from 'zod/mini'`, `.check(z.minLength(…))`):
  full `zod` would add ~18 KB gzip to the login page.
- For controlled inputs (DatePicker, RadioGroup), put the FormField **inside**
  `<Controller render>`, so it wires the real input.

**Charts** (`components/charts`): TrendLineChart (daily %, threshold line), ComparisonBarChart
(horizontal bars with their values), CalendarHeatmap (CSS grid, an icon per day). Each renders
inside `ChartFigure`: a written summary (`summaries.js`, also the accessible name), a "Show the
numbers" table, and an empty state. Import charts only from lazy pages, so Recharts never loads
on the login route.

**App shell** (`layouts/DashboardLayout` + `components/layout`)

- A collapsible sidebar from lg (the state is kept in localStorage).
- Below lg, a bottom nav with the role's `primary` NAV_ITEMS (at most 4) plus "More", a sheet
  with the other items, change password and log out.
- A light header: today's Dhaka date, name and role (phones: whose account this is, because
  siblings share a phone), the bell and log out. Safe-area insets throughout.
- Page titles are the page's own `<h1>` (PageHeader), not repeated in the header.

**Styleguide**: `/styleguide`, only when `import.meta.env.DEV` (the route and its chunk are
dropped from production builds). Add every new component and state there, with Bangla text.

**Budget** (production, gzip): `/login` loads ~168 KB of JS (entry 142, zod/mini +
react-hook-form 19, icons 6.5), 9 KB of CSS, the Outfit Latin font (32 KB) and the logo (26 KB;
67 KB at 2x). After adding dependencies, check that the login route still loads no chart or
feature code (`npx vite build` output).

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

## Deviations from the SRS (data model)

1. **All person references are `User._id`**: `studentId`, `teacherId`, `recipientId`,
   `organizerId`, `editedBy`, `actorId`, etc. Profiles link back via a unique `userId`. Ownership
   checks compare against `req.user.id` directly.
2. **`username` is the required unique login; `email` is optional** (unique only when present,
   via a partial index; `''`/`null` are normalized to undefined). Siblings may share a guardian
   email. Login accepts username or email (FR-AUTH-01).
3. **`sessionId` added** to StudentProfile, Attendance and Assessment: roll numbers and records
   are per academic session. `StudentProfile` is currently per session; a separate
   enrollment-history collection can come later if promotions need history.
4. **Calendar-date fields** (`Attendance.date`, `Assessment.date`, `dateOfBirth`,
   `admissionDate`, `joiningDate`, session start/end) use the `schoolDate()` field type: a setter
   routes every value through `utils/date.js` (Asia/Dhaka → UTC midnight) and a validator rejects
   anything not normalized. Setters also run on query filters, so `{ date: '2026-09-23' }` works.
5. **Extra unique index `Result (assessmentId, studentId)`**.
6. **Meeting invites** store both the organizer's selection (`invite.target` =
   `students | sections | classes | all`, plus the chosen IDs) and the resolved
   `inviteeStudentIds[]`, which is what queries and notifications use. `inviteeTeacherIds[]` covers
   FR-TCH-14, and `responses[]` covers FR-STU-07.
7. **Additions:**
   - `TeacherAssignment.schedule[]` (weekday + `HH:mm` slots) for FR-TCH-01 and "today's classes".
   - Settings adds `lateCountsAsPresent` (default true) and `weeklyOffDays` (default Fri, Sat).
8. **Auth additions:**
   - `User.tokenVersion` (session invalidation).
   - A **`RefreshToken`** collection (hashed opaque tokens, `family`, TTL on `expiresAt`).
   - `User.registration` (guardian, DOB, gender, requested class, note) for self-registered
     Pending students. A StudentProfile needs roll number, section and session, so the admin
     creates it on approval (FR-ADM-02/05) and clears `registration`.
9. **Admin additions:**
   - Account status **`rejected`**, with `registration.review { reason, reviewedBy, reviewedAt }`.
   - `User.mustChangePassword`.
   - `TeacherAssignment.status` (`active | ended`), plus `endedAt` and `endedBy`.
   - Roles are fixed after creation (no promote/demote).
10. **Attendance and notification additions** (migration 002):
    - `StudentProfile.attendanceAlert { belowThreshold, since, lastPercent }`.
    - `Settings.attendanceBackdateDays` (default 7).
    - `Notification.data` (structured payload) and `Notification.dedupeKey` (partial unique
      index; `absence:<studentId>:<YYYY-MM-DD>`).
11. **Results, meetings and notices additions** (migration 003):
    - `Assessment.mode` (`marks | grade | remarks`), `totalMarks` only for marks, and a
      `gradingScale` snapshot plus `publishedBy`.
    - `Result.attendance` (`present | absent | excused`) and `Result.percent`.
    - `Meeting.invite.teacherIds`, target `none` (staff-only), and
      `cancelledAt` / `cancelledBy` / `cancelReason`.
    - `Notice.status` (`draft | published`) and `createdBy`.

## Attendance feature rules

- **Mark once per class-section per day:** the teacher marks a class-section once for the day,
  and the service creates one Attendance record for **every subject that teacher has scheduled in
  that class-section on that weekday** (from `TeacherAssignment.schedule`). Individual subject
  records stay editable afterwards, through the normal edit flow with a mandatory reason and an
  AttendanceEditLog. The schema doesn't change for this.
- **One absence notification per student per school day:** absences are whole-day in practice,
  so FR-NOT-01 notifications are **grouped**. Create ONE `absence` notification per student per
  school day, listing the affected subjects. Don't create one per subject record.
  - If further subjects are marked absent later that day, update that day's notification instead
    of adding another.
  - Corrections (FR-TCH-06) update or resolve that same grouped notification.
- Only dates whose weekday is not in `Settings.weeklyOffDays` can be marked. Use
  `weekdayOf()` from `utils/date.js`.
- Attendance % = (present + late) ÷ recorded classes × 100 when `lateCountsAsPresent` is true;
  otherwise present ÷ recorded × 100.
- The timetable is guaranteed consistent by the admin module: no teacher clashes and no
  class-section clashes. So "subjects scheduled for this class-section on this weekday" is
  unambiguous.

### Attendance implementation (`services/attendance*.js`, `routes/attendance.routes.js`)

| Endpoint                                                            | Who                           | Notes                                       |
| ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------- |
| `POST /api/attendance`                                              | teacher                       | mark a class-section for a date (below)     |
| `GET /api/attendance/today`                                         | teacher                       | own class-sections: marked/partial/pending  |
| `GET /api/attendance/class-sections/:c/:s/sheet?date=`              | assigned teacher, admin       | students, subjects, existing records        |
| `PATCH /api/attendance/:id`                                         | teacher, admin                | edit one record `{ status, reason }`        |
| `PATCH /api/attendance/students/:id/days/:date`                     | teacher, admin                | whole day `{ status, reason, subjectIds? }` |
| `GET /api/attendance/student/:id/summary` / `history`               | self, assigned teacher, admin | overall, per subject, per month             |
| `GET /api/attendance/class-sections/:c/:s/summary`                  | assigned teacher, admin       | daily rates + per-student table             |
| `/api/notifications` (list, `unread-count`, `:id/read`, `read-all`) | any signed-in user            | own notifications only                      |

**Marking**

- Body: `{ classId, sectionId, date, defaultStatus?, entries[{ studentId, status }], subjectIds? }`.
  - `defaultStatus` = "mark all present" (the entries are then the exceptions). Otherwise every
    enrolled student needs an entry.
  - Students = enrolled in that class-section in the active session, with `admissionDate` on or
    before the date.
- **Subjects** = the teacher's active assignments scheduled on that weekday.
  - With `subjectIds`, exactly those subjects are marked (unscheduled classes, substitutions).
    They must be the teacher's **own** subjects for that class-section (otherwise 403), and the
    audit entry records `timetableOverride`.
  - Nothing scheduled → 422 `NO_SCHEDULED_SUBJECTS`, telling the teacher to choose subjects
    manually.
- **Date rules**, all 422: `FUTURE_DATE`, `OUTSIDE_SESSION`, `OFF_DAY`, and `BACKDATE_LIMIT`.
  - The backdate limit applies to teachers only: dates older than
    `Settings.attendanceBackdateDays`. The message says an admin can make the change.
  - Admins have no limit, and don't take attendance themselves; they override through edits.
- **Already marked** → 409 `ALREADY_MARKED`, with `details.edit` pointing to the edit endpoints.
  The unique index `(studentId, subjectId, date)` is the final guard.
- **One transaction** covers: `bulkWrite` of the records, the absence notifications, the
  low-attendance check, and the audit entry `attendance.mark`.

**Edits** (`attendanceEdit.service.js`), one service for both roles

- Teachers can edit only subjects in their active assignments, within the backdate limit. On a
  whole-day edit they only change their own subjects.
- Admins can edit anything; the audit entry is `attendance.override` with `override: true`.
- The reason is required.
- **One transaction** covers: the status change (optimistic check), `AttendanceEditLog`, AuditLog,
  the absence notification re-sync, the correction notification and the low-attendance re-check.

**Notifications** (`attendanceAlerts.service.js`)

- The absence notification is **recomputed from the records** (`syncAbsenceNotification`):
  - created on the first absence;
  - updated when more subjects are absent (and set unread again);
  - shrunk by corrections, and kept but marked `corrected` when no absence remains.
- `attendance_corrected`: one per edit per student, listing each change away from Absent.
- **Low attendance:** a warning is sent only when `attendanceAlert.belowThreshold` flips to true.
  - It needs at least **5 recorded school days**, and uses the current threshold and
    `lateCountsAsPresent`.
  - Recovery resets the flag silently, so a later drop warns again.
- **Outbox rule:** create or update Notification documents _inside_ the transaction and queue
  deliveries in an outbox (`createOutbox`, `queueNotificationEvent`, `queueEmail`).
  `dispatchOutbox` runs **only after commit**. Build the outbox inside the transaction callback,
  because it may be retried. Never emit or send from inside a transaction.
- **Email** (guardians, only if they have an email address):
  - absence: only when the day's notification is **first created**;
  - low attendance: on each crossing;
  - none for markings or edits of dates **older than 1 day** (in-app notifications are still
    created).

**Summaries** (`attendanceSummary.service.js`)

- Built with aggregation `$facet`, counting only recorded classes. `percent` is `null` when
  nothing was recorded.
- Months come from `$dateToString '%Y-%m'` in UTC, which is correct because dates are stored as
  UTC midnight of the Dhaka date.

## Results (FR-TCH-08…12, FR-STU-05, FR-ADM-09) — `services/results.service.js`

**Grading rule (snapshot at publish)**

- A grade is stored on each Result when calculated; published grades are **never recomputed
  from the current Settings scale**.
- **Draft** grades are provisional: they're calculated with the current scale when an entry is
  saved.
- **Publishing snapshots** `Settings.gradingScale` onto `Assessment.gradingScale` and regrades
  every non-overridden marks entry with it, so the whole assessment is consistent.
- After publishing, edits (teacher or admin) grade with the **assessment's own snapshot**.
  Changing the settings affects only assessments published afterwards.
- A scale is thresholds: the grade is the first band (highest first) whose `minPercent` ≤
  percent (`services/grading.js`). A manual grade in marks mode sets `gradeOverridden`; new
  marks without a grade recalculate it and clear the override.

**Rules**

- **Who:** teachers manage assessments for class-section-subjects in their active assignments,
  so any teacher of that subject can help. Admins manage any.
- **Modes:**
  - `marks`: `totalMarks`; marks from 0 to total, 2 decimals.
  - `grade`: a grade from the scale.
  - `remarks`: feedback only.
  - Remarks are optional in every mode, but required for present students in remarks mode.
- **Absent / excused** entries have no marks or grade (422 otherwise). The UI shows "Absent",
  never 0.
- Results can be entered and published only from the assessment date.
- **Drafts:** `PUT /api/results/:assessmentId` bulk-upserts entries, which stay freely editable.
  Draft assessments can be edited (changing `totalMarks` regrades) or deleted.
- **Publish** (`PATCH /api/assessments/:id/publish`):
  - Needs a complete entry for every student enrolled in that class-section and admitted by the
    assessment date; otherwise 422 `RESULTS_INCOMPLETE`, listing each student and what's
    missing.
  - One transaction covers: the snapshot, the regrade, published status, and **one
    `result_published` notification per student**.
  - No unpublishing in v1.
- **Published edits** (`PATCH /api/results/:id`): teachers (own subjects) or admins
  (`result.override`). Reason required; before/after audited; `result_updated` sent to that
  student.
- **Students only see published results:** `studentResults` joins each Result to its Assessment
  and matches `status: 'published'` for every caller.

## Meetings (FR-ADM-07, FR-TCH-13/14, FR-STU-06/07) — `services/meeting.service.js`

- **Date and time:** entered as Dhaka local `{ date, time }` and stored as an instant
  (`atSchoolTime`). Must be in the future. Venue or an `https://` link required.
- **Invites:** the target (`students | sections | classes | all | none`) is stored **and
  resolved** to `inviteeStudentIds` (active-session enrolment). Admins may add `teacherIds`.
  - **Teacher scope:** their own class-sections only. A whole class only if they teach every
    section of it. Never `all` or teachers.
- **Enrolment changes** (`syncStudentMeetingInvites`) run inside the transaction of the
  enrolment change: creating a student, approving a registration, or moving a student.
  - **Joining:** added to upcoming, non-cancelled meetings whose target covers them (`all`, their
    class, their section), with a `meeting_invite`.
  - **Leaving:** removed only from meetings they got via their old section or class, and only if
    the new placement isn't still covered. Their response is removed and they get "no longer
    invited".
  - Individual invites (target `students`) and past or cancelled meetings never change.
- **Updates** (organiser or admin, before the start):
  - A detail change sends `meeting_updated` to everyone who stays invited.
  - An invite change re-resolves the list: new invitees get `meeting_invite`, and removed ones
    get "no longer invited" (`meeting_updated` with `data.removed`).
- **Cancel** (`{ reason }`): `meeting_cancelled` to everyone; later updates and RSVPs return 409.
- **RSVP:** invited students only, until the start; they can change it (atomic upsert of their
  single response). Errors: 409 `MEETING_STARTED` / `MEETING_CANCELLED`.
- **Responses:** `GET /:id/responses` (organiser or admin) returns counts plus a per-student
  list.
- **Visibility:** admins see all; teachers see meetings they organise or are invited to; students
  see their invitations only (without the invitee list). Anything else is 404.

## Notices (FR-ADM-08, FR-STU-08) — `services/notice.service.js`

- Only admins can write.
- **Draft → publish** (`POST /api/notices` with `publish: true`, or `POST /:id/publish`): one
  bulk insert of `notice` notifications to every **active** user in the audience, sent after
  commit. Edits don't re-notify.
- **Expiry:** `PATCH /:id/expire`, or `expiresAt`. Non-admins see only published, unexpired
  notices for `all` or their role, pinned first.

## Dashboards (SRS §4) — `GET /api/dashboard/{admin|teacher|student}`

- One request per role, using `Promise.all` plus aggregation pipelines
  (`services/dashboard.service.js`). Rates follow the attendance rules.
- **Admin:** counts; pending approvals; today's rate; a 30-day trend; per-class comparison;
  below-threshold students (same rule as the warning); upcoming meetings; the audit feed; and
  **assignments without a schedule**.
- **Teacher:** today's classes and those **still to mark**; a 30-day rate plus daily series per
  section; frequent absentees (3+ absent days in 30); draft assessments; upcoming meetings.
- **Student:** attendance % and counts with the monthly series; the latest absence alerts;
  recent **published** results; upcoming invitations with their RSVP; unread count; notices.

**Performance** (large seed: ~500 students, ~55k attendance records, free M0 Atlas, measured from
the dev machine to the API on the same machine, so each call includes the Atlas round trips):

| Endpoint                     | Run 1: cold / median / max | Run 2: cold / median / max | Size   |
| ---------------------------- | -------------------------- | -------------------------- | ------ |
| `GET /api/dashboard/admin`   | 709 / 408 / 1177 ms        | 342 / 362 / 374 ms         | 7.3 KB |
| `GET /api/dashboard/teacher` | 637 / 540 / 565 ms         | 527 / 569 / 1018 ms        | 9.5 KB |
| `GET /api/dashboard/student` | 310 / 310 / 320 ms         | 644 / 375 / 591 ms         | 3.2 KB |

All under 2 s (worst single response 1.18 s; the spikes are shared-tier variance). The heaviest
query, the below-threshold aggregation over the whole session, uses `sessionId_1_date_1` (IXSCAN)
and takes about 200 ms. No extra indexes were needed beyond migration 003.

Recheck with `--large` whenever dashboard queries change.

## Admin module (FR-ADM-01…06, 10, 11)

All routes use `authenticate` + `authorize('admin')` and live in `routes/user.routes.js` and
`routes/admin.routes.js` (`crudRouter` helper).

| Resource                    | Endpoints                                                                    |
| --------------------------- | ---------------------------------------------------------------------------- |
| `/api/users`                | list (filters role/status/class/section/session, search), get, create, edit  |
|                             | `GET /next-roll`, `PATCH /:id/{suspend,reactivate,approve,reject,password}`  |
|                             | `DELETE /:id` (no history only)                                              |
| `/api/classes`, `/sections` | CRUD, with counts; blocked deletes → 409 `IN_USE`                            |
| `/api/subjects`             | CRUD                                                                         |
| `/api/sessions`             | CRUD + `POST /:id/activate` (`{ confirm: true }` required when switching)    |
| `/api/teacher-assignments`  | list (active session by default), create, `PATCH` schedule, delete/end       |
| `/api/settings`             | `GET`, `PATCH` (partial)                                                     |
| `/api/audit-logs`           | list with filters `action`, `actorId`, `entityType`, `entityId`, `from`/`to` |

**Users**

- Admin-created accounts are **active** with **`mustChangePassword: true`**. So is an admin
  password reset.
- Students get their StudentProfile in the **active session**, in one transaction with the user.
  Teachers get a TeacherProfile.
- **Roll numbers:** `next-roll` suggests highest + 1; the admin may pick any free number. The
  unique index is the final guard: 409 `ROLL_NUMBER_TAKEN`, _"Roll 6 is already taken in
  Playgroup-B (2026). Next free: 7."_
- Roles cannot be changed (400).
- **Self-protection:** an admin cannot suspend or delete themselves (403). The last active admin
  cannot be suspended or deleted (409 `LAST_ADMIN`, re-checked after the write to catch races).
- **Suspension** calls `invalidateUserSessions`. Reactivation is suspended → active only.
- **Hard delete** only without history (`countUserHistory`): attendance, results, assignments,
  assessments, meetings, notices, edit logs. AuditLog entries don't count. The delete cascade
  removes the profile, refresh tokens and notifications.

**Registrations**

- **Approve** (`{ classId, sectionId, rollNo?, dateOfBirth?, admissionDate? }`), in ONE
  transaction: StudentProfile from `registration`, then status active, then `registration`
  removed, then audit. Any failure rolls everything back.
- A date of birth is required, from the registration or the request.
- **Reject** `{ reason }` → status `rejected`; login says the registration was not approved.

**Academic structure**

- Sections can't move between classes, and capacity can't go below current enrolment.
- The active session can't be deleted. New sessions start inactive.
- **Switching sessions** without `confirm: true` returns 409
  `SESSION_SWITCH_CONFIRMATION_REQUIRED` with enrolment and assignment counts. With confirm, one
  transaction deactivates the old session, then activates the new one.

**Teacher assignments** (`services/teacherAssignment.service.js`)

- Always in the active session. The user must be an **active teacher**, and the section must
  belong to the class.
- **Clash detection** (409 `SCHEDULE_CLASH`, `details.clashes`) runs against other _active_
  assignments in the session. Slots are half-open `[start, end)`, so back-to-back slots are fine.
  1. **teacher:** the same teacher at overlapping times;
  2. **class-section:** the same class-section at overlapping times, even with different teachers.
- Slots inside one schedule must not overlap (422).
- **Removing** an assignment with attendance or assessments ends it (`status: 'ended'`); it
  stays for history but grants no access. Otherwise it is deleted. Re-assigning an ended
  combination reactivates it.
- Only **active** assignments grant access (`access.service`).

**Settings**

- The grading scale is thresholds `[{ grade, minPercent, gpa? }]`. It is accepted in any order
  and stored highest-first.
- Validation: unique grades and thresholds, the lowest band at 0, values 0–100, and GPA never
  increasing as the grade falls. Together these mean 0–100 is covered with no gaps or overlaps.
- Responses add a display `maxPercent`.
- `weeklyOffDays` must be unique, with at least one school day.

## Auth (FR-AUTH-01…06)

**Endpoints**

| Endpoint                        | Access             | Notes                                                         |
| ------------------------------- | ------------------ | ------------------------------------------------------------- |
| `POST /api/auth/login`          | public             | `{ identifier, password }` → `{ accessToken, user }` + cookie |
| `POST /api/auth/refresh`        | cookie             | rotates the refresh token → `{ accessToken, user }`           |
| `POST /api/auth/logout`         | cookie             | revokes the current token; no access token needed             |
| `GET /api/auth/me`              | signed in          |                                                               |
| `PATCH /api/auth/password`      | signed in          | ends all sessions, then re-issues one for this device         |
| `POST /api/auth/register`       | public, if enabled | Pending student + AuditLog; 404 when disabled                 |
| `PATCH /api/users/:id/password` | admin              | ends that user's sessions + AuditLog (never the password)     |

**Tokens**

- **Access token:** a jose JWT (HS256, `typ: at+jwt`, with issuer and audience checked), valid for
  `ACCESS_TOKEN_TTL` (15m). It carries `sub`, `role` and `tv` (tokenVersion). It is returned in
  the body and kept **in memory only** (`client/src/lib/tokenStore.js`), never in
  localStorage/sessionStorage.
- **Refresh token:** 32 random bytes in the `ls_rt` cookie (`httpOnly`, `SameSite=Lax`,
  `path=/api/auth`, `secure` in production, 7 days). Only its SHA-256 hash is stored in
  `RefreshToken`.
  - **Rotation:** every refresh atomically revokes the old token (`findOneAndUpdate` on
    `revokedAt: null`) and issues a new one in the same `family`.
  - **Reuse detection:** presenting a revoked token revokes the whole family, **except** a token
    rotated less than `ROTATION_GRACE_MS` (10 s) ago. That is a multi-tab race, not theft: it
    gets a 401 that **does not clear the cookie**, because the browser may already hold the
    winning tab's newer token.

**Ending sessions**

- **`invalidateUserSessions(userId, reason)`** (token.service) increments `tokenVersion` and
  revokes every refresh token for that user.
- Call it on password change or reset, on suspension (with the status change), and anywhere else
  a user's sessions must end immediately.
- `authenticate` re-reads the user's status and `tokenVersion` on **every** request.

**Login**

- One generic message for an unknown identifier and a wrong password. A dummy bcrypt compare
  equalises the timing.
- Pending/Suspended get a specific 403, but only after the password is correct.

**Rate limits** (in memory, per app instance; `req.ip` honours `TRUST_PROXY`)

- Login: 5 failures / 15 min per IP + identifier, plus 30 failures / 15 min per IP.
- Register: 5 / hour.
- **Refresh**, keyed per session: `RATE_LIMIT_REFRESH_SESSION_MAX` (default 60 / 15 min) per
  refresh-token family (it survives rotation; an unknown token is keyed by its hash; no cookie is
  skipped), plus a loose per-IP backstop `RATE_LIMIT_REFRESH_IP_MAX` (default 600 / 15 min).
  Bangladeshi mobile carriers put many guardians behind shared IPs, so the per-IP limit must
  never be the tight one. Tests pass `createApp({ rateLimits: { refreshSessionMax,
refreshIpMax } })`.
- Running several instances would need a shared store.

**Other rules**

- **Forced password change:** while `mustChangePassword` is true, login and refresh succeed and
  return `mustChangePassword: true`.
  - Every protected route returns 403 `PASSWORD_CHANGE_REQUIRED` (in `authenticate`), except
    `/auth/me` and `/auth/password` (which use `authenticateAllowingPasswordChange`), plus
    `/auth/refresh` and `/auth/logout`.
  - The client's `ProtectedRoute` sends such users to `/change-password`. Changing the password
    clears the flag.
- Passwords: 8+ characters, a letter and a number (any script, so Bangla works), and **at most
  72 UTF-8 bytes** (bcrypt truncates; a Bangla letter is 3 bytes). Validate new passwords with
  `passwordPolicy` from `validators/auth.validator.js`.
- **401 vs 403:** 401 = not signed in or session invalid (the client will try a refresh);
  403 = signed in but not allowed. Wrong _current_ password on change → **400**, not 401.
- **Guards** (`middleware/auth.js`, `middleware/ownership.js`; logic in
  `services/access.service.js`):
  - `authenticate`, then `authorize(...roles)`.
  - `teacherOwnsAssignment(getScope?)`: assignment in the **active session**; admin passes;
    student is denied.
  - `studentOwnsRecord(getStudentId?)`: own record, an assigned teacher, or admin.
  - Every feature route uses these, and services re-check with `canAccess*` when they load data
    by other IDs.

**Client** (`features/auth/session.js`)

- `refreshSession()` is **single-flight** and shared by app start-up (`AuthProvider` →
  `bootstrapSession()`) and the Axios 401 retry. StrictMode double effects and parallel 401s
  therefore send one request.
- Refresh failures carry a code: `NO_SESSION` (no cookie), `TOKEN_ROTATED` (grace-window race)
  or `SESSION_INVALID`. The client **retries once after 400 ms only on `TOKEN_ROTATED`**; the
  others fail immediately.
- Access tokens carry `sid` (the login's refresh family), so logout disconnects only that
  device's sockets.
- A failed refresh clears **local state only** (token → query cache → auth state). **Never call
  `POST /auth/logout` automatically**: only the user's Log out button does. It then broadcasts
  `{ type: 'logout' }` on the `littlesteps-auth` BroadcastChannel so every tab clears
  immediately.
- Logout always clears the whole TanStack Query cache, since phones are shared.

## Real-time (Socket.io) and email

- **Server** (`src/realtime/io.js`):
  - Attached to the HTTP server at `/socket.io`. CORS allows `CLIENT_ORIGINS` only; no cookies.
  - **Handshake:** `auth.token` must be an access token that passes the same checks as HTTP
    (`userFromAccessToken`: signature, expiry, active, `tokenVersion`). Users with
    `mustChangePassword` are rejected.
  - Each socket joins `user:<id>`.
  - **Events:** `notification:new`, `notification:updated`, `notifications:unread-count`.
  - **Disconnects:**
    - at access-token expiry;
    - all of a user's sockets on `invalidateUserSessions` (suspension, password change/reset);
    - that login's sockets on logout (`sid`).
    - These are wired through `utils/sessionEvents.js`, so token.service doesn't import
      realtime.
  - In-memory adapter: **one API instance**. Scaling out needs the Redis adapter.
  - All emit helpers do nothing when Socket.io isn't initialised (tests, scripts).
- **Client** (`client/src/lib/socket.js`):
  - Connects to `VITE_SOCKET_URL`: empty in development (Vite proxies `/socket.io` with
    `ws: true`), the **Render origin** in production, because Vercel rewrites can't proxy
    WebSockets. So the server's `CLIENT_ORIGIN` must include the Vercel domain.
  - Follows `tokenStore` (reconnects with each new token). After a server disconnect or an
    expired-token rejection, it refreshes the session.
  - `useUnreadCount` gets pushes over the socket and polls every 60 s while disconnected.
- **Email** (`src/notifications/email.js`): one provider interface, `send({ to, subject, text })`.
  - Providers: `smtp` (Nodemailer), `resend` (HTTPS API, for hosts that block SMTP) and
    `console`.
  - Off unless `EMAIL_ENABLED=true`. Provider settings are validated in `env.js` only when
    enabled. Failures are logged and never thrown.
  - Tests use `setEmailProvider(recorder)`.

## Same-origin API (deployment decision)

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
    `isValidDateKey`, `addDays`, `monthRange`, `schoolDateKeyOf`, `weekdayOf`,
    `atSchoolTime(schoolDate, 'HH:mm')` (wall-clock time in Dhaka → real instant), `daysBetween`,
    `formatSchoolDateLong` ("Thu, 24 Sep 2026", for messages)
  - client: `client/src/utils/date.js` — `todayDateKey`, `formatSchoolDate` (formats in UTC so the
    day never shifts), `formatDateTime` (real instants, shown in Asia/Dhaka)
  - Never use `new Date().setHours(0,0,0,0)`, `toLocaleDateString()` without a timeZone, or raw
    date arithmetic in services/components. Extend the utility (with tests) instead.
- Real instants (`createdAt`, `markedAt`, meeting `dateTime`) stay as normal UTC timestamps.

## Testing

- Unit/HTTP tests: import `createApp()` from `src/app.js` and use Supertest (no port binding).
- Integration tests with a DB: `beforeAll(startTestDB)`, `afterEach(clearTestDB)`,
  `afterAll(stopTestDB)` from `tests/helpers/db.js` (single-node replica set, so transactions
  work). The first run downloads a mongod binary (~780 MB, cached in `~/.cache/mongodb-binaries`).
  Indexes are built on start, so unique-index tests behave like production.
- Every new service/endpoint gets tests, including a forbidden-access test for each role that
  should not reach it.
- Auth test helpers (`tests/helpers/factories.js`): `createUser({ role, status, password })`,
  `tokenFor(user)` (signs an access token without calling /login), `refreshCookieFrom(res)`.
- Create a fresh `createApp()` per test when rate limits matter; limiters are per app.
  `createApp({ testRouter })` mounts test-only routes at `/api/test`, and
  `createApp({ selfRegistrationEnabled })` overrides the env flag.
- Admin tests: `tests/helpers/school.js` → `createSchool()` (active 2026 session, Playgroup A/B,
  Nursery A, 3 subjects, an admin and a teacher) and `apiAs(user)` (an authenticated Supertest
  client for `/api`).
- To prove a transaction matters, make a step **after** the first write fail. See the approval
  atomicity test in `admin.registration.test.js`.
- Tests never read `server/.env`; `vitest.config.js` sets `JWT_ACCESS_SECRET` and
  `BCRYPT_ROUNDS=4`.
- Attendance tests: `tests/helpers/attendance.js`.
  - `createAttendanceSchool()` gives a session spanning today ±90 days, 3 students in
    Playgroup-A, a second teacher, and `day` / `weekday` = the most recent school day.
  - Also: `assign()`, `insertAttendance()`, `recentSchoolDays()` and `markBody()`.
  - Dates are relative to the real "today" (Dhaka), so tests hold on any date.
- Results, meetings, notices and dashboards: `results.test.js`, `meetings.test.js`,
  `notices-dashboards.test.js`. `apiAs(user)` has `get/post/patch/put/delete`.
- When checking notifications, filter by type, title or `data`, not by position; the order
  documents come back in isn't guaranteed.
- **Client** (`client/src/__tests__`, `npm test -w client`): pure logic in a node environment
  (statuses, server-error mapping, dates, chart summaries, schemas, pagination). Components are
  checked in the browser via `/styleguide`.
- Socket tests (`realtime.test.js`) run `initRealtime` on a random port and connect with
  `socket.io-client` using `transports: ['websocket']`.

## E2E suite (`e2e/`, Playwright)

- `npm run e2e` starts its own stack (`e2e/playwright.config.js`):
  - the API on :5100 from `server/src/scripts/e2eServer.js`: an **in-memory MongoDB replica
    set** (the same approach as `tests/helpers/db.js`) seeded with `seedDatabase({ e2e: true })`
    at start-up (about a second). No Atlas, no slow reseed, and no way to touch
    `littlesteps_dev`;
  - the Vite dev client on :5174 proxying `/api` and `/socket.io` to it.
  - Rate limits are raised through env for the run only. Browsers: Playwright's own Chromium
    (`npx playwright install chromium` once).
- **Parallel safety:** spec files run in parallel (3 workers), tests inside a file in order
  (`fullyParallel: false`; data-changing specs also use `mode: 'serial'`). Every spec that
  changes data owns different people, so they never collide:

  | Spec                           | Owns (changes)                                              |
  | ------------------------------ | ----------------------------------------------------------- |
  | `attendance.spec.js`           | farhana.akter, Playgroup-A/B attendance on the unmarked day |
  | `results.spec.js`              | tahmina.rahman, the KG-1-A draft Math test                  |
  | `meetings.spec.js`             | shirin.akhter, a new KG-2-A meeting                         |
  | `realtime.spec.js`             | admin override of kg2-b-02's attendance                     |
  | `notifications.spec.js`        | nur-b-01's notifications (read state)                       |
  | `password-change.spec.js`      | a new user it creates (`e2e.newteacher`)                    |
  | `auth.spec.js`, `a11y.spec.js` | read-only (sessions only)                                   |

  A new data-changing spec takes an unused class-section or student and adds a row here.

- `npm run e2e:screens` (`screens.spec.js`, project `screens`): every teacher screen at 375
  and 1280 px, including dialogs, loading and error states, into `docs/design/screens/teacher/`.
  Read-only; it uses `reducedMotion: 'reduce'` so charts are not caught mid-animation.
- Assert what the user sees (roles, labels, text); use the API (`apiAs` in `tests/helpers.js`)
  only for set-up and for checking side effects such as notifications.

## Don'ts

- No business logic in controllers or route files; no Axios calls in components.
- No `process.env` outside `config/env.js`; no secrets in client env (`VITE_*` is public).
- No date math outside the date utilities.
- Don't upgrade Express to 5 without replacing `express-mongo-sanitize`.
- Don't implement a feature without checking its FR IDs in `docs/SRS.md`.
- Don't store tokens in localStorage/sessionStorage. Don't call `POST /auth/logout` from error
  handling, only from an explicit user action.
- Don't add a protected route without `authenticate` + `authorize`, plus an ownership guard when
  it is scoped to a class-section or a student.
- Don't change a schema without a migration.
- Don't point browser checks at `littlesteps_dev`: use the E2E suite (in-memory database).
- Don't show a status by colour alone (use `config/statuses.js`), put the full logo on a dark
  surface, use Cerise for success, or import full `zod` or chart components on the login path.
- Don't emit sockets or send emails inside a transaction; queue them in the outbox.
