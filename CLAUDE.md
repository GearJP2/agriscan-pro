# AgriScan Pro Context

## Purpose

AgriScan Pro is an agricultural-lab platform for sample management, mycotoxin
risk assessment, analytics, and controlled research workflows. This document
is the repository context for coding agents. Keep it accurate and concise;
refer to `README.md` and `docs/` for operator-facing detail.

## Architecture

- **Frontend:** React 18, TypeScript, Vite 7, Tailwind/shadcn-style components.
- **Backend:** Django 5 / Django REST Framework on Python 3.12.
- **Data:** PostgreSQL runs with Django on the production EC2 Compose host;
  SQLite is used for CI. S3 stores uploaded files where configured.
- **Current hosting (V2):** Django and PostgreSQL run through Docker Compose on
  one EC2 instance managed through SSM. The frontend remains on S3/CloudFront,
  and dashboard snapshots use a separate private S3 bucket and CloudFront.
- **Production network (V2):** EC2 instance `i-00d57bf6d54db1428` has Elastic
  IP `43.211.57.163`. The main CloudFront distribution routes `/api/*` and
  `/health*` to its public DNS origin over HTTP port 80; the default behavior
  continues to serve the frontend S3 origin.
- **Historical hosting (V1):** Elastic Beanstalk, RDS, and optional Redis/Celery
  documentation is archived under `docs/V1/`.
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
| Dashboard | `frontend/src/components/surveillance/` | Surveillance, co-contamination, NASA POWER, public-health, and overview views. |
| Dashboard contract | `backend/samples/services/dashboard_payload_service.py`, `frontend/src/types/dashboard.ts` | Shared aggregate contract used by snapshots and authenticated analytics. |
| Snapshot publication | `backend/samples/services/dashboard_snapshot_publisher.py`, `generate_dashboard_snapshot` | Privacy validation, deterministic JSON, checksum, version-first/manifest-last S3 publication. |
| Snapshot delivery | `frontend/src/lib/dashboardSnapshot.ts`, `infrastructure/dashboard-snapshots.yaml` | Zod validation, scoped cache, private S3, CloudFront OAC, and fixed SSM command. |
| Feature UI | `frontend/src/features/{samples,users,notifications}/` | Sample workflows, user/profile management, and notification polling/state. |
| API and UI logic | `frontend/src/lib/`, `frontend/src/contexts/` | Axios client, auth state, risk helpers, LLM fallback gate. |
| CI/CD | `.github/workflows/ci-cd.yml`, `.github/workflows/dashboard-snapshot.yml` | Main delivery pipeline plus hourly OIDC/SSM snapshot scheduling. |

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
- `TestDataService` creates and removes only `TEST-`-prefixed sample data;
  that prefix is reserved and rejected by normal API/import paths. Test data
  must not emit risk notifications, and cleanup must remove matching alerts.
- Generated data must remain idempotent and deterministic when `seed` and
  `as_of` are supplied. Use `generate_test_data` and `delete_test_data` for CLI
  execution; missing users are attributed to `System`.
- Long-running uploads and cache cleanup must run through Celery when request
  latency or database writes would otherwise affect dashboard reads.
- Interactive NASA POWER cache reads accept only unexpired rows. Snapshot
  generation never calls NASA directly: it may reuse the matching latest cache
  row as `fresh` or `stale`, otherwise the section is `unavailable`.
- `NasaPowerService` selects an unfiltered fallback province with database
  aggregation; explicit province filters always take precedence.
- Validate external NASA and LLM payloads at the service boundary and return
  controlled API errors rather than partial dashboard data.
- Browser-side LLM fallback is development-only and requires
  `VITE_ENABLE_BROWSER_LLM_FALLBACK=true`.

### Public dashboard snapshot rules

- Anonymous dashboard rendering reads only CloudFront snapshot JSON and never
  calls `/api` or downloads raw samples.
- Advanced filters, simulations, environmental requests, and manual aggregate
  fallback require authentication.
- Public aggregates use a minimum group size of five. Apply primary and
  complementary suppression, including sensitive non-zero subcounts and global
  KPI counts; do not expose a value that can be recovered by subtraction.
- Snapshot JSON must contain no raw rows, sample/user identifiers, collectors,
  notes, logs, or audit fields. Keep the recursive deny-list validation.
- Immutable versions are uploaded and verified before `manifest.json`. A failed
  generation must leave the previous manifest unchanged.
- Browser cache fallback is permitted only for transport failures, HTTP 429, or
  HTTP 5xx. Schema, path, content-type, manifest, and checksum failures must be
  surfaced rather than hidden by cached data.

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
python manage.py test accounts samples core notifications

# Snapshot contract and publication tests
python manage.py test samples.tests.test_dashboard_snapshot

# Test-data CLI
python manage.py generate_test_data --seed 42 --as-of 2026-08-16
python manage.py delete_test_data

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

# Infrastructure and scheduled workflow
cfn-lint ../infrastructure/dashboard-snapshots.yaml
actionlint ../.github/workflows/dashboard-snapshot.yml
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
- `/api/samples/analytics/dashboard/`: canonical authenticated aggregate
  dashboard contract.
- `/api/samples/analytics/dashboard/simulate/`: authenticated aggregate
  contract with threshold overrides.
- `/api/notifications/`: authenticated users' notifications, unread counts,
  and read-state actions.
- `/health/`: liveness and dependency health data.

Generate the authoritative schema with:

```bash
cd backend && python manage.py spectacular --file schema.yml
```

## CI/CD and Deployment

- Current workflow triggers on pull requests to `main`, pushes to `main`, and
  manual dispatch. A `develop` integration branch workflow is not configured
  yet.
- `dashboard-snapshot.yml` runs hourly at minute 17 and by manual dispatch. It
  assumes a GitHub OIDC role and may invoke only the stack-owned SSM document
  against the configured production instance; do not replace it with generic
  `AWS-RunShellScript` or long-lived AWS keys.
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
- `BACKEND_HEALTH_URL` must use the stable main CloudFront endpoint
  (`https://d3s961c8cl4lgn.cloudfront.net/health/`), not a direct EC2 address.
- Keep Elastic IP `43.211.57.163` associated with the production instance. If
  it is intentionally replaced, update the main CloudFront EC2 origin and
  `.env.ec2` `ALLOWED_HOSTS`, then recreate the backend. SSM and snapshot jobs
  continue to target the stable instance ID and do not depend on its public IP.

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
- `docs/ARCHITECTURE.md`: versioned architecture index.
- `docs/V1/ARCHITECTURE.md`: historical EB/RDS/Redis/S3 architecture.
- `docs/V2/ARCHITECTURE.md`: target single-EC2 runtime and snapshot deployment
  contract.
- `docs/V1/CI_Security_Workflow.md`: current CI/CD and supply-chain controls.
- `docs/V1/SAMPLE_IMPORT_FORMAT.md`: current import formats.
- `SECURITY.md`: vulnerability reporting policy.
