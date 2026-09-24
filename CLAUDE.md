# LittleSteps — Nursery School Management System

MERN monorepo for a single nursery school (Playgroup, Nursery, KG-1, KG-2): attendance, results,
meetings, notices and notifications, with role-specific dashboards.

**Requirements live in [docs/SRS.md](docs/SRS.md). Read it before implementing any feature** and
cite requirement IDs (e.g. `FR-TCH-05`) in commits/PRs. Note: the file is currently the SRS
_brief_ (requirements + the structure a full IEEE-830 SRS should follow), not the expanded SRS.

## Status

Foundation, data layer, authentication, the admin module and attendance + notifications are done:

- The server boots and `/api/health` works; the client shell, routing and data layer are in place.
- All Mongoose models exist with tests, and a dev seed script is available.
- **Auth (FR-AUTH-01…06)** is complete on server and client, including the RBAC and ownership
  guards.
- **Admin module** (FR-ADM-01…06, 10, 11) is done on the server: users, registrations, academic
  structure, teacher assignments, settings and the audit log. The admin UI is not built yet.
- **Attendance** (FR-TCH-03…07, SRS 3.6), the attendance override (FR-ADM-09) and
  **notifications** (FR-NOT-01…05: in-app, Socket.io, optional email) are done on the server.
  The client has the notification bell with a live unread count.
- **Deferred:** FR-ADM-07 (meetings), 08 (notices) and 09 (result overrides) are built with their
  features.
- Not yet built: results, meetings, notices, dashboards, the teacher and student UIs, the
  notification list page (comes with the student module), and the admin UI.

## Stack

| Layer   | Tech                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- |
| Server  | Node ≥ 20.19, Express **4** (not 5 — `express-mongo-sanitize` needs Express 4), Mongoose, Zod |
| Client  | React 19, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Router, TanStack Query v5, Axios |
| Tests   | Vitest + Supertest (server), mongodb-memory-server for integration tests                      |
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

Exact versions are in each `package.json`.

**Check the installed API; don't rely on memory.** Mongoose 9, React Router 8, Vite 8, Vitest 5 and jose 6
(also Zod 4, dotenv 18, express-rate-limit 8) are newer than most examples online and than older
training data. Before using any API from them, check the installed package's type definitions
(`node_modules/<pkg>/**/*.d.ts`) or its bundled docs/changelog. Don't copy patterns from older
majors, e.g. `react-router-dom` imports, Mongoose callback APIs, `max` instead of `limit`
in express-rate-limit, or Zod 3's `error.errors`.

## Commands (run from repo root)

```bash
npm install            # installs both workspaces
npm run dev            # server :5000 + client :5173 concurrently
npm run dev:server     # / dev:client
npm test               # server tests (Vitest)
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
  - A lock document in `migration_lock` serializes runners (several instances, or startup racing
    a manual run). A lock older than 10 min is treated as stale and taken over.
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
- Applied so far: `001-teacher-assignment-status`, `002-attendance-notifications`.

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
  config/          constants.js (ROLES, ROUTES, ROLE_HOME, NAV_ITEMS, SCHOOL_TIMEZONE)
  layouts/         PublicLayout, AuthLayout, DashboardLayout (role prop)
  routes/          ProtectedRoute (signed in?), RoleRoute (role allowed?)
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

## Results feature rules (for implementation)

- **Grades are stored on each Result at the time they are calculated and are never recomputed**
  from the current grading scale. Changing `Settings.gradingScale` affects only future
  calculations; existing results, published or draft, keep their stored `grade`.
- Apply the scale as thresholds: the grade is the first band (highest first) whose `minPercent`
  ≤ percentage. A manual override sets `gradeOverridden: true` (FR-TCH-10).
- Admin overrides of attendance and results (FR-ADM-09) go through the same services as the
  teacher edits, with the same logging.

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
- Register: 5 / hour. Refresh: 60 / 15 min.
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
- Socket tests (`realtime.test.js`) run `initRealtime` on a random port and connect with
  `socket.io-client` using `transports: ['websocket']`.

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
- Don't emit sockets or send emails inside a transaction; queue them in the outbox.
