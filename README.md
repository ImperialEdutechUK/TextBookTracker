# TextBookTracker

Textbook sharing and print tracking with role-based authentication and
PostgreSQL-backed user management. The project is split into two apps:

```
TextBookTracker/
├── backend/    Express + TypeScript + Prisma API (owns the DB and JWT auth)
└── frontend/   Next.js (React) UI — talks to the backend over HTTP
```

## Features

- Secure email/password login
- Role-based access control for ADMIN, CREATOR, MANAGER, and VIEWER
- Admin-managed user registration and account status updates
- Protected dashboard and admin routes
- PostgreSQL database schema using Prisma ORM
- Textbook request management (create, list, search/filter, detail, edit, soft delete)
  with status history and a textbook catalog

## Getting started

Run the backend and frontend in two separate terminals.

### 1. Backend (`backend/`)

```bash
cd backend
cp .env.example .env          # set DATABASE_URL and a strong JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate        # applies all migrations (User + textbook tables)
npm run seed                  # creates the initial ADMIN user
npm run seed:textbooks        # seeds a starter textbook catalog (optional)
npm run dev                   # http://localhost:4000
```

Backend environment variables (`backend/.env`):

| Variable             | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                                   |
| `JWT_SECRET`         | Secret used to sign session JWTs                               |
| `PORT`               | Port the API listens on (default `4000`)                       |
| `FRONTEND_URL`       | Allowed CORS origin (default `http://localhost:3000`)          |
| `CROSS_SITE_COOKIES` | `true` only if frontend/backend are on different sites (HTTPS) |

### 2. Frontend (`frontend/`)

```bash
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL to the backend URL
npm install
npm run dev                   # http://localhost:3000
```

Frontend environment variables (`frontend/.env.local`):

| Variable               | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Backend base URL (default `http://localhost:4000`) |
| `NEXT_PUBLIC_APP_NAME` | Display name for the app                           |

## API endpoints (backend)

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `GET  /api/users`
- `POST /api/users`
- `PUT  /api/users/:id`
- `DELETE /api/users/:id`
- `GET  /api/textbooks`
- `GET  /api/textbook-requests/options`
- `GET  /api/textbook-requests`
- `POST /api/textbook-requests`
- `GET  /api/textbook-requests/:id`
- `PUT  /api/textbook-requests/:id`
- `DELETE /api/textbook-requests/:id`

## Notes

- Only `ADMIN` may manage users.
- Textbook request access follows the permission matrix: `ADMIN`/`MANAGER` see all
  requests, `CREATOR` sees requests they created, and `VIEWER` (learner) sees only
  requests assigned to them. Only `CREATOR`/`ADMIN` may create or edit; only
  `ADMIN` may (soft) delete. The creator is always taken from the session, never
  the request body. Status transitions are owned by the Workflow / Status Tracking
  module — this module only sets the initial `CREATED` state and renders history.
- Passwords are hashed with bcrypt; sessions are signed JWTs stored in an
  httpOnly cookie set by the backend.
- The frontend authenticates by calling the backend with `credentials: 'include'`,
  so the API cookie is sent on each request. For local dev both run on
  `localhost`, which the browser treats as same-site (so `SameSite=Lax` works).
  For a cross-domain production deploy, set `CROSS_SITE_COOKIES=true` and serve
  both over HTTPS.

 
 
