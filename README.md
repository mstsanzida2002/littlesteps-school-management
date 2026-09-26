# LittleSteps

LittleSteps is a mobile-first nursery school management platform that replaces paper registers and verbal notices with a simple digital system. Admins manage the school, teachers handle attendance and results from their phones, and guardians track their child's attendance, results, and meetings in real time.

## Features

### Admin

* Manage teacher and student accounts with bilingual English/Bangla login slips
* Manage classes, sections, subjects, and school years
* Assign teachers with timetable and clash detection
* Configure grading, attendance rules, and school settings
* Manage attendance, results, meetings, and notices
* School-wide dashboards, attendance trends, and audit logs

### Teacher

* Mobile-friendly class attendance
* Attendance editing with reasons and history
* Create and publish tests and results
* Manage class meetings and RSVP summaries
* Dashboard for pending work and frequent absentees

### Guardian

* View attendance by day, subject, and month
* Receive absence and low-attendance alerts
* View published results and teacher remarks
* RSVP to meetings and download calendar invites
* Switch between children from one phone
* Install as a mobile PWA

### Platform

* Real-time updates with Socket.io
* Optional guardian email alerts
* Public school landing page

## Tech Stack

| Layer    | Technologies                                                           |
| -------- | ---------------------------------------------------------------------- |
| Frontend | React, Vite, React Router, TanStack Query, Tailwind CSS, Zod, Recharts |
| Backend  | Node.js, Express, Mongoose, Zod, Socket.io                             |
| Database | MongoDB Atlas                                                          |
| Security | JWT, bcryptjs, Helmet, rate limiting, NoSQL injection protection       |
| Testing  | Vitest, Supertest, Playwright, mongodb-memory-server                   |
| Tooling  | npm Workspaces, ESLint, Prettier                                       |

## Security & Privacy

Children's data is protected through:

* API-level role-based access control
* Short-lived JWT access tokens and rotating refresh tokens
* Session invalidation after suspension or password changes
* Mandatory password changes for temporary passwords
* Rate limiting and input validation
* NoSQL injection and XSS protection
* Append-only audit logs for sensitive changes

## Getting Started

### Requirements

* Node.js 22+
* MongoDB Atlas

### Installation

```bash
git clone https://github.com/<your-username>/littlesteps.git
cd littlesteps
npm install

cp server/.env.example server/.env
cp client/.env.example client/.env
```

Configure `server/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/littlesteps_dev
JWT_ACCESS_SECRET=<random-string-at-least-32-characters>
CLIENT_ORIGIN=http://localhost:5173
```

Start the application:

```bash
npm run seed -- --reset
npm run dev
```

* Frontend: `http://localhost:5173`
* API: `http://localhost:5000`

### Demo Accounts

| Role     | Username        | Password       |
| -------- | --------------- | -------------- |
| Admin    | `admin`         | `Admin@1234`   |
| Teacher  | `farhana.akter` | `Teacher@1234` |
| Guardian | `pg-a-01`       | `Student@1234` |

> Demo accounts are for development only.

## Scripts

| Command                   | Purpose                    |
| ------------------------- | -------------------------- |
| `npm run dev`             | Start frontend and API     |
| `npm run build`           | Build frontend             |
| `npm test`                | Run unit/integration tests |
| `npm run e2e`             | Run Playwright tests       |
| `npm run e2e:perf`        | Run performance tests      |
| `npm run seed -- --reset` | Reset demo data            |
| `npm run migrate`         | Run database migrations    |
| `npm run lint`            | Lint the project           |

## Project Structure

```text
littlesteps/
├── client/          React frontend
├── server/          Express API
│   └── src/
│       ├── models/
│       ├── services/
│       ├── migrations/
│       ├── realtime/
│       └── seed/
├── e2e/             Playwright tests
└── docs/            SRS, designs, and audit reports
```

## Testing

* **250+** server tests
* **75** client tests
* **50+** Playwright E2E tests
* In-memory MongoDB replica set for testing transactions
* Performance tested with approximately **500 students**
* Dashboard response target: **under 2 seconds**

## Deployment

Designed for:

* **Vercel** → React frontend
* **Render** → Node.js/Express backend
* **MongoDB Atlas** → Database

Vercel proxies `/api` requests to Render, while Socket.io connects directly to the backend.

## Author

**Mst. Sanzida**

## License

This project is for academic purposes.
