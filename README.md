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

## Getting started

Run the backend and frontend in two separate terminals.

### 1. Backend (`backend/`)

```bash
cd backend
cp .env.example .env          # set DATABASE_URL and a strong JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate        # creates the User table
npm run seed                  # creates the initial ADMIN user
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

## Notes

- Only `ADMIN` may manage users.
- Passwords are hashed with bcrypt; sessions are signed JWTs stored in an
  httpOnly cookie set by the backend.
- The frontend authenticates by calling the backend with `credentials: 'include'`,
  so the API cookie is sent on each request. For local dev both run on
  `localhost`, which the browser treats as same-site (so `SameSite=Lax` works).
  For a cross-domain production deploy, set `CROSS_SITE_COOKIES=true` and serve
  both over HTTPS.
