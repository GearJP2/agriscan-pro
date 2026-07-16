# AgriScan Pro Context

## Purpose

AgriScan Pro is an agricultural-lab platform for sample management, mycotoxin
risk assessment, analytics, and controlled research workflows. This document
is the repository context for coding agents. Keep it accurate and concise;
refer to `README.md` and `docs/` for operator-facing detail.

## Architecture

- **Frontend:** React 18, TypeScript, Vite 7, Tailwind/shadcn-style components.
- **Backend:** Django 5 / Django REST Framework on Python 3.12.
- **Data:** PostgreSQL in production; SQLite for CI. Redis backs Celery and
  cache workloads; S3 stores uploaded files.
- **Hosting:** AWS-only: Elastic Beanstalk backend; S3 and CloudFront frontend.
- **Authentication:** JWT access token in memory, rotating httpOnly refresh
  cookie, Google OAuth, and five hierarchical roles.
- **External analytics:** Backend-owned LLM public-health summaries and NASA
  POWER environmental data feed the surveillance dashboard.

### Important Modules

| Area | Primary locations | Notes |
|---|---|---|
| Auth and users | `backend/accounts/` | OAuth state, cookie/token handling, rate limiting, role gates, monitor sync. |
| Samples and risk | `backend/samples/` | Sample CRUD, imports, toxin registry, risk logic, analytics, Celery tasks. |
| Notifications | `backend/notifications/` | Risk-alert notification model, service, and signals. |
| Backend config | `backend/core/settings.py`, `backend/core/celery.py` | Environment parsing, Celery, REST and security settings. |
| Dashboard | `frontend/src/components/surveillance/` | Surveillance, co-contamination, NASA POWER, and public-health views. |
| API and UI logic | `frontend/src/lib/`, `frontend/src/contexts/` | Axios client, auth state, risk helpers, LLM fallback gate. |
| CI/CD | `.github/workflows/ci-cd.yml` | Tests, scans, artifacts, attestations, verification, and main-only deployment. |

## Core Contracts

- Canonical toxin metadata and EU thresholds live in
  `backend/samples/constants/`; frontend display metadata must remain aligned.
- Risk classification is threshold-based. Do not introduce a second threshold
  source in a serializer, view, or React component.
- The API is rooted at `/api/accounts/` and `/api/samples/`; `/health/` is the
  operational health endpoint. Use the generated OpenAPI schema and README for
  the full endpoint list.
- `SampleViewSet` stays thin. Put filtering in `samples/filters.py`, ingestion
  and integrations in `samples/services/`, and background work in
  `samples/tasks.py`.
- Long-running uploads and cache cleanup must run through Celery when request
  latency or database writes would otherwise affect dashboard reads.
- NASA POWER cache reads only accept rows whose `expires_at` is in the future.
  `prune_expired_nasa_power_cache` performs deletion on the Celery Beat schedule.
- `NasaPowerService` selects an unfiltered fallback province with database
  aggregation; explicit province filters always take precedence.
- Validate external NASA and LLM payloads at the service boundary and return
  controlled API errors rather than partial dashboard data.
- Browser-side LLM fallback is development-only and requires
  `VITE_ENABLE_BROWSER_LLM_FALLBACK=true`.

## Development

### Local services

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (Node 22 recommended; CI uses Node 22)
cd frontend
npm ci
npm run dev
```

Use `backend/.env.example` as the configuration reference. Never commit real
environment files, AWS credentials, OAuth secrets, or token values.

### Verification

```bash
# Backend CI-equivalent checks
cd backend
flake8 .
python manage.py test accounts samples core

# Focused NASA service/cache tests
python manage.py test samples.tests.test_analytics

# Frontend checks
cd frontend
npx --no-install audit-ci --config .audit-ci.json
npm run lint
npm run typecheck
npm test
DEPLOY_TARGET=aws npm run smoke
DEPLOY_TARGET=aws NODE_ENV=production npm run build
```

For the local Docker backend, use `docker compose run --rm --no-deps backend`
followed by the Django command. Do not modify tracked files merely to make a
local environment work.

## API Endpoints

Core groups:

- `/api/accounts/`: login, registration, refresh/logout, Google OAuth,
  password reset, profile, users, and provider management.
- `/api/samples/`: sample CRUD, process logs, mycotoxin results, imports,
  presigned uploads, task status, analytics, and threshold simulation.
- `/health/`: liveness and dependency health data.

Generate the authoritative schema with:

```bash
cd backend && python manage.py spectacular --file schema.yml
```

## CI/CD and Deployment

- Current workflow triggers on pull requests to `main`, pushes to `main`, and
  manual dispatch. A `develop` integration branch workflow is not configured
  yet.
- Tests run path-selectively. Backend uses Python 3.12; frontend uses Node 22.
- Frontend audit blocks high and critical vulnerabilities. Do not weaken this
  with an allowlist unless a documented exception is unavoidable.
- Backend flake8 uses a 120-character line limit and a maximum complexity of 21.
- Deployments run only after a `main` push passes tests, security checks,
  artifact attestation, and attestation verification.
- `gh attestation verify` must receive a repository-qualified signer workflow:
  `${{ github.repository }}/.github/workflows/ci-cd.yml`.
- GitHub Environment and branch-protection settings are remote configuration;
  they are not representable solely in this repository.

## Troubleshooting Beanstalk Deployments

If a Beanstalk `container_commands` Django command cannot see environment
variables, load them with `/opt/elasticbeanstalk/bin/get-config environment`
before activating the virtual environment and running Django. Validate shell
hooks with `bash -n`; keep worker and Beat startup changes idempotent.

## Working Rules

- Follow existing Django and React patterns before adding an abstraction.
- Preserve user changes and avoid unrelated refactors.
- Add migrations only for model changes; do not edit existing migrations.
- Use `apply_patch` for manual edits. Keep generated dependency-lock changes
  limited to the intended dependency update.
- Tests should match risk: focused tests for narrow services, broader suites
  for shared auth, API, task, or deployment changes.
- Commit messages use Conventional Commit style. Explain the operational or
  security reason in the commit body when it is not obvious from the subject.

## Supporting Documentation

- `README.md`: installation, API overview, and operator quick start.
- `docs/ARCHITECTURE.md`: system design details.
- `docs/CI_Security_Workflow.md`: CI/CD and supply-chain controls.
- `docs/SAMPLE_IMPORT_FORMAT.md`: import formats.
- `SECURITY.md`: vulnerability reporting policy.
