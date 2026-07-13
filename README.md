# AgriScan Pro

[![CI/CD Pipeline](https://github.com/GearJP2/agriscan-pro/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/GearJP2/agriscan-pro/actions/workflows/ci-cd.yml)

> Agricultural research platform for lab sample management and mycotoxin detection, with EU-threshold risk assessment and role-based access control.

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [API Docs](#api-reference)

---

## Features

- **Sample Management** — Create, update, bulk-import (CSV/JSON), and track agricultural lab samples across regions and vegetation types
- **Mycotoxin Risk Model** — EU-threshold risk classification (safe / detected / high / critical) for 10 toxin types including AFB1, DON, FB1, ZEA, and OTA
- **Analytics Dashboard** — Overview KPIs, co-contamination intersections, and interactive threshold simulation
- **Role-Based Access Control** — Five hierarchical roles (admin → head_researcher → researcher → research_assistant → user) enforced at both API and frontend route levels
- **JWT + Google OAuth 2.0** — Memory-only access tokens, httpOnly refresh cookie rotation with blacklist invalidation, server-side OAuth state validation
- **Background Tasks** — Celery workers for async CSV ingestion and monitor synchronization via ElastiCache Redis
- **SRE Health Check** — `GET /health/` reports DB and Redis latency and system saturation metrics

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.12 |
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| PostgreSQL | ≥ 14 |
| Redis | ≥ 6 |

AWS credentials are required for S3 storage in production. For local development, the backend uses the local filesystem fallback or a configured S3 bucket.

---

## Installation

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

Optional development-only frontend environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ENABLE_BROWSER_LLM_FALLBACK` | not set (`false`) | Must be explicitly set to `true` to allow browser-side fallback requests to public LLM endpoints when backend summary generation fails in development mode. |

---

## Configuration

Copy the example environment file and fill in the required values:

```bash
cp backend/.env.example backend/.env
```

Key variables for local development:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | Django secret key (min 50 chars) |
| `DEBUG` | No | `True` | Set to `False` in production |
| `DB_NAME` | Yes | `agriscan_db` | PostgreSQL database name |
| `DB_USER` | Yes | — | PostgreSQL user |
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `DB_HOST` | No | `localhost` | Database host |
| `ASYNC_TASKS_ENABLED`| No | `False` | Set `True` to enable Celery/Redis background tasks |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis URL (required if ASYNC_TASKS_ENABLED=True) |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `INITIAL_ADMIN_EMAILS` | No | — | Comma-separated emails auto-promoted to admin |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Allowed frontend origins |

See [backend/.env.example](backend/.env.example) for the full list including production S3, SMTP, and SRE variables.

---

## Quick Start

```bash
# 1. Apply database migrations
cd backend
source venv/bin/activate
python manage.py migrate

# 2. Create a superuser (optional for local access to Django Admin)
python manage.py createsuperuser

# 3. Start the backend
python manage.py runserver

# 4. In a separate terminal, start the frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` — the login screen appears.  
Django Admin is at `http://localhost:8000/admin/`.

---

## Usage

### Roles

| Role | Access |
|------|--------|
| `admin` | Full access — user management, all samples, bulk delete |
| `head_researcher` | Full sample access, user directory |
| `researcher` | Full sample access, user directory |
| `research_assistant` | Own samples only |
| `user` | Own samples only, no sample creation |

### Importing samples

```bash
# Bulk create samples via JSON
POST /api/samples/bulk_create/

# Import mycotoxin results via CSV
POST /api/samples/bulk_import_results/
```

### Analytics

```bash
GET  /api/samples/analytics/overview/             # Dashboard KPIs
GET  /api/samples/analytics/co-contamination/     # Co-contamination network
POST /api/samples/analytics/threshold-simulation/ # Threshold what-if analysis
```

---

## API Reference

The backend exposes a self-documented OpenAPI schema via `drf-spectacular`.

```bash
# Generate schema (dev)
cd backend
source venv/bin/activate
python manage.py spectacular --file schema.yml
```

Core endpoint groups:

```text
/api/accounts/   Authentication (login, register, Google OAuth, password reset, profile)
/api/samples/    Sample CRUD, analytics, bulk import, S3 upload, Celery task polling
/health/         SRE health check
```

See [CLAUDE.md](CLAUDE.md#-api-endpoints) for the full endpoint list.

---

## Running Tests

### Backend

```bash
cd backend
source venv/bin/activate

# All tests
python manage.py test accounts samples core

# Single module
python manage.py test accounts.tests.test_user_deletion

# With coverage
coverage run --source='.' manage.py test
coverage report
```

### Frontend

```bash
cd frontend
npm run test
```

### Linting

```bash
# Backend (max line length 120)
cd backend && flake8 --max-line-length=120 .

# Frontend
cd frontend && npm run lint
cd frontend && npm run typecheck
```

---

## Deployment

The backend deploys to AWS Elastic Beanstalk via GitHub Actions on every push to `main`.

### Manual deploy

```bash
# Deploy backend to EB
eb deploy Agriscanpro-backend-env

# Check environment status
eb status --verbose

# Download logs
eb logs --zip
```

### Frontend build

```bash
cd frontend
DEPLOY_TARGET=aws npm run build
```

Static assets are served from S3 behind CloudFront.

### Production environment variables

In addition to the local variables above, production requires:

| Variable | Description |
|----------|-------------|
| `FORCE_SSL` | Set `False` when CloudFront terminates TLS |
| `JWT_REFRESH_COOKIE_SECURE` | `True` in production |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name |
| `MONITOR_ACCESS_MIN_ROLE` | Minimum role for monitor access |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | AgriScan Monitor Vercel KV sync |

---

## Project Structure

```text
agriscan-pro/
├── backend/                  # Django REST Framework API (Python 3.12)
│   ├── accounts/             # Auth, user management, Google OAuth
│   ├── samples/              # Core business logic — samples, mycotoxin results
│   │   ├── constants/        # Toxin registry, EU thresholds, risk policy
│   │   └── services/         # CSV ingestion, S3 presigned URLs
│   ├── core/                 # Settings, URL routing, permissions, Celery
│   ├── .ebextensions/        # AWS EB container commands (migrate, collectstatic)
│   └── .platform/            # AL2023 hooks (Celery worker startup)
│
├── frontend/                 # React + TypeScript (Vite)
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── pages/            # Route-level page components
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # API clients, auth helpers, token storage
│       └── contexts/         # AuthContext and other providers
│
├── .github/workflows/        # CI/CD — backend tests, lint, EB deploy
└── CLAUDE.md                 # Project instructions for Claude Code
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ImproperlyConfigured` during EB `container_commands` | Use `get-config environment` to load env vars before running `manage.py`; see [CLAUDE.md](CLAUDE.md#troubleshooting-beanstalk-deployments) |
| Redis `SSL: CERTIFICATE_VERIFY_FAILED` | Set `REDIS_SSL_CERT_REQS=required` and use `rediss://` URL for ElastiCache |
| CORS errors in local dev | Ensure `CORS_ALLOWED_ORIGINS=http://localhost:5173` in `backend/.env` |
| Google OAuth `invalid_state` error | Clear session/cookies; state is server-side with a TTL — expired states are rejected |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, coding conventions, and pull request process.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting policy.
