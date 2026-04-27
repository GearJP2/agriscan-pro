- **Infrastructure synchronization**: Automated synchronization of authorized emails to the AgriScan Monitor's Vercel KV store via Celery background tasks.
- **Automated Role Assignment**: Whitelisted emails (via `INITIAL_ADMIN_EMAILS`) automatically receive the 'admin' role upon sign-in/registration.
- **Role-Based Monitor Access**: Hierarchical access control for internal observability tools.

### Key Files by Purpose
... (lines 107-111 continue as before)
#### Authentication & User Management
...
- `backend/accounts/services/monitor_sync_service.py` - Vercel KV (Redis) synchronization logic
- `backend/accounts/tasks.py` - Background tasks for monitor synchronization
...

### 🧪 Testing Strategy
...
# Run monitor integration tests (requires KV credentials)
MONITOR_URL=https://agriscan-monitor.vercel.app python manage.py test accounts.test_monitor_integration
...

### Required Environment Variables (Production)
...
INITIAL_ADMIN_EMAILS    # Comma-separated admin whitelist
MONITOR_ACCESS_MIN_ROLE # Min role for monitor access
KV_REST_API_URL         # Monitor Vercel KV URL
KV_REST_API_TOKEN       # Monitor Vercel KV Token
VITE_MONITOR_URL        # URL of the monitor application (frontend)
...

## Last Updated
- Date: 2026-04-27
- By: Claude Code
- Status: Automated Admin Roles, Monitor Access Linking, and Zero-Touch Infrastructure Synchronization are complete. Task items 53 and 54 are resolved. Integrated with Celery background tasks and verified via integration tests.

## 🌾 Project Overview

**AgriScan Pro** is a comprehensive agricultural research platform for lab sample analysis and mycotoxin detection.

### Tech Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Django REST Framework (Python 3.12)
- **Database**: Amazon RDS PostgreSQL 16.1 (db.t4g.small, Single-AZ) — instance `agriscanpro-db`
- **Cache/Broker**: Amazon ElastiCache (Redis OSS v7) with TLS
- **Storage**: Amazon S3 (via IAM Instance Profile)
- **Hosting**: AWS Elastic Beanstalk (AL2023) - `Agriscanpro-backend-env`
- **Agent System**: Node.js orchestrator (in development - local only)
- **Auth**: JWT (via rest_framework_simplejwt)

### Key URLs
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/`
- Django Admin: `http://localhost:8000/admin/`

---

## 📁 Project Structure

```
agriscan-pro/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # API clients, auth, and utilities
│   │   ├── contexts/         # React context providers (AuthContext, etc.)
│   │   └── main.tsx          # Entry point
│   ├── vite.config.ts        # Vite configuration
│   └── package.json
│
├── backend/                  # Django REST Framework
│   ├── manage.py
│   ├── requirements.txt
│   ├── core/
│   │   ├── settings.py       # Django configuration (AWS RDS/Redis/S3)
│   │   ├── urls.py           # Main URL routing
│   │   └── wsgi.py
│   ├── .ebextensions/        # AWS EB configuration (migrate, collectstatic)
│   ├── .platform/             # AWS AL2023 hooks (Celery worker startup)
│   ├── accounts/             # User authentication
│   │   ├── models.py         # User model
│   │   ├── views.py          # Auth endpoints (login, register)
│   │   ├── serializers.py    # Auth serializers
│   │   └── urls.py
│   ├── samples/              # Core business logic
│   │   ├── models.py         # Sample, ProcessLog, MycotoxinResult risk model
│   │   ├── views.py          # CRUD viewsets (thin views)
│   │   ├── serializers.py    # Data serialization (N+1 optimized)
│   │   ├── urls.py
│   │   ├── admin.py          # Django admin config
│   │   ├── constants/        # Mycotoxin registry, aliases, EU thresholds
│   │   └── services/
│   │       ├── ingestion_service.py  # CSV import logic (decoupled)
│   │       └── s3_service.py         # S3 presigned URL generation
│   ├── core/
│   │   └── permissions.py    # IsOwnerOrAdmin permission class
│   └── venv/                 # Python virtual environment
│
├── .claude/                  # Claude Code configuration
│   ├── agents/               # Agent definitions (7 types)
│   │   ├── orchestrator.md
│   │   ├── dev-agent.md
│   │   ├── data-pipeline.md
│   │   ├── research-collab.md
│   │   ├── devops-agent.md
│   │   ├── qa-agent.md
│   │   ├── report-notify.md
│   │   └── security-monitor.md
│   └── settings.json         # Claude Code workspace settings
│
├── agents-orchestrator/      # 🚧 WIP - Local development only
│   ├── orchestrator.js       # Main orchestration engine
│   ├── api-gateway.js        # REST API for agents
│   ├── lib/                  # Supporting libraries
│   ├── workflows/            # Workflow definitions (4 examples)
│   ├── examples/             # Runnable examples
│   ├── package.json
│   └── README.md
│
├── .mcp/                     # 🚧 WIP - MCP Server implementations
│   ├── servers/
│   │   ├── jira-server.js    # Jira integration
│   │   ├── linear-server.js  # Linear integration
│   │   ├── slack-server.js   # Slack integration
│   │   ├── github-server.js  # GitHub integration
│   │   └── database-server.js # PostgreSQL operations
│   └── .env.example
│
├── .gitignore                # Git ignore rules
├── CLAUDE.md                 # This file
├── ORCHESTRATOR_SUMMARY.md   # Agent system documentation
└── README.md                 # Project README
```

### Key Files by Purpose

#### Frontend Build & Config
- `frontend/vite.config.ts` - Vite build config
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/package.json` - Frontend dependencies

#### Backend Configuration
- `backend/core/settings.py` - Django settings (DB, apps, auth)
- `backend/core/urls.py` - Root URL routing
- `backend/requirements.txt` - Python dependencies

#### Authentication & User Management
- `backend/accounts/models.py` - User model definition
- `backend/accounts/serializers.py` - User serialization
- `backend/accounts/views.py` - Login/register endpoints
- `backend/accounts/oauth.py` - Google OAuth 2.0 implementation
- `backend/accounts/auth_helpers.py` - Centralized OAuth state, token cookies, blacklist, permission gates
- `frontend/src/components/AuthDialog.tsx` - Redesigned login/register modal
- `frontend/src/pages/GoogleAuthCallback.tsx` - OAuth callback handler
- `frontend/src/lib/oauth.ts` - OAuth utilities (token exchange, CSRF protection)
- `frontend/src/lib/tokenStorage.ts` - Memory-only access token storage (no localStorage)
- `frontend/src/lib/authApi.ts` - Cookie-backed auth API wrappers (login, refresh, logout, Google OAuth)

#### Core Business Logic (Samples)
- `backend/samples/models.py` - Sample, ProcessLog, MycotoxinResult models (with composite DB indexes)
- `backend/samples/views.py` - CRUD operations and custom actions (thin views)
- `backend/samples/serializers.py` - Data serialization (N+1 optimized via prefetch)
- `backend/samples/constants/mycotoxin_constants.py` - Toxin registry, aliases, EU threshold metadata, risk policy
- `backend/samples/services/ingestion_service.py` - CSV bulk import logic (decoupled from views)
- `backend/samples/services/s3_service.py` - S3 presigned URL generation
- `backend/core/permissions.py` - `IsOwnerOrAdmin` — role-based object-level permission

---

## 🔄 API Endpoints

### Authentication
```
POST /api/accounts/login/              # Login (username/email, password)
POST /api/accounts/register/           # Register (email, password, name)
POST /api/accounts/login/refresh/      # Refresh JWT token
POST /api/accounts/google-callback/    # Exchange Google auth code for JWT
GET  /api/accounts/google-auth/        # Get Google OAuth authorization URL
POST /api/accounts/password-reset/request/    # Request password reset OTP
POST /api/accounts/password-reset/confirm/    # Confirm OTP and reset password
PATCH /api/accounts/profile/           # Update profile (name, email w/ verification)
POST /api/accounts/email-change/confirm/      # Verify email change via token

```

### Samples (Core Business)
```
GET    /api/samples/            # List samples (with filters)
POST   /api/samples/            # Create new sample
GET    /api/samples/{id}/       # Get sample details
PUT    /api/samples/{id}/       # Update sample
DELETE /api/samples/{id}/       # Delete sample (admin only)

GET    /api/samples/statistics/                    # Dashboard stats
GET    /api/samples/recent_alerts/                 # Flagged samples
POST   /api/samples/{id}/add_process_log/          # Add process log
POST   /api/samples/{id}/add_mycotoxin_result/     # Add test result
POST   /api/samples/bulk_create/                   # Bulk import samples (JSON)
POST   /api/samples/bulk_import_results/           # Bulk import mycotoxin results (CSV)
POST   /api/samples/bulk_delete/                   # Bulk delete (admin only)
POST   /api/samples/request_upload/                # Get S3 presigned upload URL
POST   /api/samples/confirm_upload/                # Enqueue Celery task after S3 upload
GET    /api/samples/task_status/{task_id}/         # Poll Celery task status
GET    /api/samples/analytics/overview/            # Threshold-based dashboard KPIs
GET    /api/samples/analytics/co-contamination/    # Co-contamination intersections/network
POST   /api/samples/analytics/threshold-simulation/ # Simulate toxin thresholds
```

### System
```
GET /health/    # SRE health check — DB latency, Redis latency, system metrics (auth required for metrics)
```

### Filtering Examples
```
GET /api/samples/?status=pending
GET /api/samples/?region=Southeast
GET /api/samples/?province=Chiang%20Mai
GET /api/samples/?vegetation=Rice
GET /api/samples/?risk_level=high
GET /api/samples/?date_from=2026-01-01&date_to=2026-03-31
```

---

## 🛠️ Development Workflow

### Backend Development

#### Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

#### Production Connection (AWS)
- **Database**: RDS PostgreSQL 16.1 (`agriscanpro-db`), publicly accessible. DB name: `agriscan`.
- **Cache**: ElastiCache requires `rediss://` for TLS and `ssl_cert_reqs=required`.
- **S3**: Files are stored in S3; IAM Instance Profile handles auth on EB.

#### Creating Models
1. Define in `backend/samples/models.py`
2. Create serializer in `backend/samples/serializers.py`
3. Create viewset in `backend/samples/views.py`
4. Register in `backend/samples/urls.py`
5. Run migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

#### Creating API Endpoints
```python
# In backend/samples/views.py
@action(detail=False, methods=['post'])
def custom_action(self, request):
    """Custom API action"""
    # Your logic here
    return Response({'result': 'success'})
```

### Frontend Development

#### Setup
```bash
cd frontend
npm install
npm run dev
```

#### Adding Features
1. Create component in `src/components/`
2. Add service/API call in `src/lib/`
3. Add route in main router config
4. Use hooks for state management

#### API Calls
```typescript
// In src/lib/api.ts
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

export const getSamples = (filters) => api.get('/samples/', { params: filters });
```

#### Troubleshooting Beanstalk Deployments

**Issue: `ImproperlyConfigured` during `container_commands`**
If `python manage.py migrate` fails with missing environment variables (e.g., Google OAuth keys), it's because Beanstalk's environment variables aren't automatically loaded into the build-time shell.

**Fix:** Use `get-config environment` to load them manually in your `.config` files:
```yaml
container_commands:
  01_migrate:
    command: |
      export $(/opt/elasticbeanstalk/bin/get-config environment | jq -r 'to_entries | .[] | "\(.key)=\"\(.value)\""')
      source /var/app/venv/*/bin/activate
      python manage.py migrate --noinput
```

---

## 🧪 Testing Strategy

### Backend Tests
```bash
# Run all tests
python manage.py test

# Run specific test
python manage.py test samples.tests.SampleViewSetTest

# With coverage
coverage run --source='.' manage.py test
coverage report
```

### Frontend Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

### Agent Tests (when implemented)
```bash
# Test agent system
node agents-orchestrator/examples/simple-task.js
```

---

## 📝 Code Conventions

### Python (Django)
- Follow PEP 8
- Use snake_case for variables and functions
- Add docstrings to classes and methods
- Model names: singular (Sample, ProcessLog)
- View methods: descriptive verbs (get_queryset, perform_create)

### TypeScript (React)
- Use PascalCase for components
- Use camelCase for variables and functions
- Add types for all function parameters
- Extract complex logic to custom hooks
- Use descriptive component names

### Database
- All tables have `id` primary key (auto-increment)
- All tables have `created_at` and `updated_at` timestamps
- Foreign keys use `_id` suffix in field names
- Use descriptive field names (not abbreviations)

### API Responses
```json
{
  "data": {...},
  "status": "success",
  "timestamp": "2026-03-27T...",
  "meta": {
    "count": 10,
    "page": 1
  }
}
```

---

## 🚀 Status & WIP Features

### ✅ Completed
- User authentication (JWT + Google OAuth 2.0)
- Redesigned auth UI with Material Design 3 aesthetic (Clinical Orchard theme)
- **AWS Migration**: Postgres (migrated from Aurora → RDS PostgreSQL 16.1), ElastiCache Redis (TLS), S3 Storage
- **GitHub Actions**: Automated CI/CD for backend to Elastic Beanstalk
- **Celery & Background Tasks**: Fully integrated with ElastiCache broker
- Sample CRUD operations and Bulk Import
- Process logging & Mycotoxin result tracking
- Django admin integration
- **Backend Performance**: Composite DB indexes on (region,status), (region,collection_date), (status,collection_date); N+1 fix in SampleListSerializer using prefetch_related; `results_count` uses `len()` on prefetch cache
- **Clean Architecture**: CSV ingestion logic in `SampleIngestionService` — thin views; ingestion filters by CSV display IDs (no full table scan)
- **Security**: `IsOwnerOrAdmin` permission class — role-based object-level access control (admin/head_researcher/researcher full access; others owner-only write)
- **Production Hardening**: HSTS (1yr), SSL redirect, Secure/HttpOnly cookies, `SECURE_PROXY_SSL_HEADER` for EB ALB — all gated on `DEBUG=False`
- **SRE Health Check**: `GET /health/` reports DB+Redis latency and system saturation; system metrics gated on `SRE_MONITOR_KEY` env var
- **Agent Gateway Security**: `GATEWAY_API_KEY` required (fail-fast on startup if unset); path traversal closed with alphanumeric sanitization on workflow names
- **Secure Profile Management**: Hardened password reset via hashed OTPs; 2-step email verification; JWT session blacklisting after OTP reset/email-change events; Redis-based rate/attempt limiting; OTP invalidation on new password reset requests prevents replay attacks.
- **Role-Based Route Protection**: `ProtectedRoute` supports `minRole`/`allowedRoles` props; `/samples` restricted to `research_assistant` and above; `user` role blocked at both frontend route and backend `IsOwnerOrAdmin.has_permission`
- **Profile Page Redesign**: Clinical registry-style UI — hero card, Registry Metadata, Output Analytics (live stats), inline email editing with password confirmation; email backend auto-detects dev (console) vs prod (SMTP)
- **Infrastructure Fixes**: Resolved CORS and SSL protocol mismatch for CloudFront/EB; Hardened `SECURE_PROXY_SSL_HEADER` to trust `X-Forwarded-Proto` from CloudFront; Stopped unwanted 301 redirects on the direct EB domain to prevent "null" status connection failures.
- **Week 1 Auth Hardening**:
  - **Token Storage Migration**: Access tokens stored in memory only (`frontend/src/lib/tokenStorage.ts`); refresh tokens managed via httpOnly cookie-backed flow (`frontend/src/lib/authApi.ts`); refresh token rotation enforced with blacklist invalidation.
  - **OAuth State Validation**: Google OAuth uses server-side state persistence (`backend/accounts/auth_helpers.py`) with cache-backed TTL, validation, and one-time consumption — eliminating client-side state vulnerabilities.
  - **Role Update Permission Gate**: Explicit view-level permission checks for sensitive user updates; frontend `isAdmin` flag and backend `admin`/`staff` checks aligned for consistent access control.
  - **DEBUG Safety**: `DEBUG` defaults to `False` unless explicitly opted into via environment variable.
  - **Project Cleanup**: `.venv/` untracked; orphan docs (`Requirement.md`) removed; `DB/DB.sql` retained as schema artifact; `.gitignore` audited for stale tracked files; generated migration files excluded from static analysis.
- **Graceful Dependency Handling**: Optional dependencies (`psutil`, Redis) handled gracefully in local/test environments without hard failures.
- **Logger Migration in OAuth**: OAuth backend code migrated from `print()` to structured `logging.getLogger("agriscan.accounts")` calls.
- **Backend-First Mycotoxin Risk Model**: `MycotoxinResult` uses canonical `toxin_type`, `value`, `unit`, `risk_level`, EU threshold snapshots, and `(sample, toxin_type)` uniqueness. Legacy serializer aliases (`name`, `intensity`, `threshold`, `dangerous`, `method`) are transitional compatibility only.
- **Threshold Source of Truth**: SampleList, dashboard fallback analytics, Regional Risk Ranking, and Regional Risk Map treat `Positive` as above-threshold (`risk_level` `high`/`critical`). `detected_pct` is available separately for samples with any mycotoxin result below or above threshold.
- **Dependency Security Hardening**: Replaced `xlsx` (ReDoS / Prototype Pollution CVEs) with `exceljs` + `papaparse` across all frontend file-import and export paths. Applied `uuid` package override to clear downstream moderate vulnerabilities. `@types/xlsx` removed; `@types/papaparse` added.
- **Migration Atomicity Fix**: `migration 0010` sets `atomic = False` to prevent `OperationalError: pending trigger events` on PostgreSQL when running deferred-constraint data migrations.
- **Frontend CSV Import Bug Fixes**: Added `skipEmptyLines: true` to all four `Papa.parse` calls (`UnifiedImportForm`, `AdvancedImportForm`, `AddSampleForm` ×2) — trailing blank rows no longer reach the import pipeline. Fixed `URL.revokeObjectURL` memory leak in `SampleList.handleExportXLSX`. Typed Papa error callbacks as `Error` (removed `any`). Removed unused `rowNumber` parameter from `eachRow` callback.
- **Backend PEP8 Compliance**: Stripped trailing whitespace (W293) from 15 blank lines in `backend/samples/views.py` — passes `flake8 --max-line-length=120` clean.


### 🚧 In Development (Local Only)
- **Agent Orchestrator** (`agents-orchestrator/`) - Multi-agent task execution system
- **MCP Servers** (`.mcp/`) - External service integrations

These are NOT yet committed to production and are for local development only. See `ORCHESTRATOR_SUMMARY.md` for details.

### 📋 Future Planned
- Real-time notifications (WebSocket)
- Advanced data visualization
- Export to PDF/Excel
- Automated alerts for high-risk samples
- Researcher collaboration features
- Mobile app

---

## 🔐 Security Notes

### Current Implementation
- JWT tokens for authentication (15 min access, 7 day refresh with rotation + blacklist)
- **Refresh token flow**: Cookie-only. `get_refresh_token_from_request()` reads exclusively from the httpOnly cookie; body-token support has been removed. The refresh view has no fallback — if rotation produces no new token, the request fails rather than re-issuing a blacklisted old token.
- **OAuth state validation**: The server is authoritative. `validate_and_consume_oauth_state()` in `auth_helpers.py` performs cache-backed TTL validation, one-time consumption, and replay rejection. Client-side state checks (e.g., `sessionStorage`) are advisory only and not relied upon for security decisions.
- **Role permissions** — granular access control:
  | Role | User Directory | Manage Roles/Status | Self-Service |
  |------|---------------|-------------------|-------------|
  | `admin` | ✅ Full access | ✅ Full access | ✅ |
  | `head_researcher` | ✅ Full access | ✅ Full access | ✅ |
  | `researcher` | ✅ Full access | ✅ Full access | ✅ |
  | `research_assistant` | ❌ Own record only | ❌ | ✅ |
  | `user` | ❌ Own record only | ❌ | ✅ (no self-promotion) |
- `IsOwnerOrAdmin` object-level permissions — role-based (admin/head_researcher/researcher full access; others owner-only write)
- CORS: `CORS_ALLOW_ALL_ORIGINS = DEBUG` — locked down in production via `CORS_ALLOWED_ORIGINS` env var (always includes CloudFront URL)
- Production security headers active when `DEBUG=False`: HSTS (if SSL enabled), SSL redirect (if `FORCE_SSL=True`), Secure/HttpOnly cookies, `SECURE_PROXY_SSL_HEADER`
- Role escalation protection in `UserSerializer.validate_role` — Researcher+ only, no self-promotion
- Agent gateway requires `GATEWAY_API_KEY` header; workflow path traversal blocked by alphanumeric sanitization

### Required Environment Variables (Production)
```
SECRET_KEY              # Django secret key
DB_ENGINE=postgresql
DB_HOST                 # agriscanpro-db endpoint (ap-southeast-1)
DB_NAME=agriscan        # initial DB name on the new RDS instance
DB_USER / DB_PASSWORD
REDIS_URL               # rediss:// for ElastiCache TLS
CORS_ALLOWED_ORIGINS    # Comma-separated frontend URLs
GATEWAY_API_KEY         # Agent orchestrator auth — REQUIRED (fails to start without it)
SRE_MONITOR_KEY         # Protects system metrics on /health/ endpoint
EMAIL_HOST_USER         # SMTP user — if unset, falls back to console backend (OTP prints to terminal)
EMAIL_HOST_PASSWORD     # SMTP password / App Password
DEFAULT_FROM_EMAIL      # Sender display name + address
```

### Best Practices
- Never commit `.env` files with real credentials
- Always validate user input in serializers
- Use Django's built-in permission system
- Keep secret keys in environment variables
- Use HTTPS in production

---

## 📊 Database Models

### Sample
```
id: UUID (primary key)
sample_id: String (unique)
region: String
vegetation_variety: String
status: String (pending, in_progress, completed, flagged)
collection_date: DateTime
purpose: String
sample_type: String
processing_type: String
collected_by: String
updated_by: ForeignKey(User)
created_at: DateTime (auto)
updated_at: DateTime (auto)
```

### ProcessLog
```
id: Integer (primary key)
sample: ForeignKey(Sample)
state: String (registered, processing, testing, etc)
notes: Text
conducted_by: String
timestamp: DateTime (auto)
```

### MycotoxinResult
```
id: Integer (primary key)
sample: ForeignKey(Sample)
toxin_type: String (canonical toxin code, e.g. AFB1, DON, FB1)
value: Float (measured concentration)
unit: String (canonical default: ug_kg)
risk_level: String (safe, detected, high, critical, unclassified)
eu_threshold_low: Float (snapshot)
eu_threshold_high: Float (snapshot)
timestamp: DateTime
notes: Text

Compatibility aliases returned by serializers:
name, intensity, is_detected, dangerous, threshold, method
```

### Mycotoxin Threshold Semantics
- `safe`: value is zero or below detection concern.
- `detected`: value is above zero but not above the EU low threshold.
- `high`: value is above the EU low threshold.
- `critical`: value is above the EU high threshold.
- `unclassified`: toxin has no trusted threshold data.
- UI `Positive` means above threshold (`high`/`critical`), not merely detected.
- Dashboard `detected_pct` tracks samples with any result separately from threshold risk.

---

## 🎯 Common Tasks

### Add New Sample Field
1. Add to model in `backend/samples/models.py`
2. Add to serializers in `backend/samples/serializers.py`
3. Run migrations
4. Update frontend form in `frontend/src/components/SampleForm.tsx`

### Add Custom API Endpoint
1. Create method in viewset (with `@action` decorator)
2. Implement logic
3. Add test in `backend/tests/`
4. Call from frontend via `src/lib/api.ts`

### Debug API Issues
```bash
# Check Django logs
python manage.py runserver  # Watch console

# Check network in browser
# Open DevTools > Network tab

# Test API manually
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/samples/
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview and setup |
| `CLAUDE.md` | This file - Claude instructions |
| `ORCHESTRATOR_SUMMARY.md` | Agent system documentation |
| `agents-orchestrator/README.md` | Orchestrator API documentation |
| `agents-orchestrator/QUICK_START.md` | Agent system quick start |

---

## 🤖 When Working with Claude Code

### Context to Provide
When asking Claude Code to work on this project, mention:
- **Which component**: frontend, backend, or agents
- **What to modify**: models, views, components, etc.
- **Current behavior**: what works now
- **Desired behavior**: what you want to change

### Example Request
```
In the backend, add a new "risk_level" field to the Sample model.
It should be a choice field with options: low, medium, high.
Update the serializer and viewset accordingly.
```

### Code Review Instructions
Before committing code changes:
1. Run linter/formatter (Prettier, Black)
2. Run tests to ensure nothing breaks
3. Check Django admin to ensure models display correctly
4. Test API endpoints with sample data

---

## 🔗 Integration Points (When Ready)

These are documented but not yet integrated:

### To Integrate Agents
1. Start orchestrator: `npm start` (in `agents-orchestrator/`)
2. Create Django task model to track agent jobs
3. Add endpoint that calls orchestrator API
4. Update tests to include agent workflows

### To Integrate MCP Servers
1. Configure credentials in `.mcp/.env`
2. Start MCP servers
3. Create agent implementations that use MCP tools
4. Test with example scripts

---

## ✨ Key Principles for This Project

1. **Security First** - All user inputs validated, authentication required
2. **Data Integrity** - Careful migration management, no data loss
3. **API-Driven** - All features exposed via REST API
4. **Testing Required** - Tests for all new features
5. **Documentation** - Keep docs up-to-date with code changes
6. **Clean Code** - Follow conventions, use descriptive names
7. **User-Focused** - Feature decisions based on researcher needs

---

## 📞 Quick Reference

### Common Commands

**Backend**
```bash
python manage.py runserver           # Start Django
python manage.py makemigrations      # Create migration
python manage.py migrate             # Apply migration
python manage.py createsuperuser     # Create admin
python manage.py test                # Run tests
```

**Frontend**
```bash
npm run dev                          # Start dev server
npm run build                        # Build for production
npm run preview                      # Preview production build
npm run test                         # Run tests
npm run lint                         # Check code quality
```

**Git**
```bash
git status                           # Check status
git add .                            # Stage changes
git commit -m "message"              # Commit with message
git push origin main                 # Push to GitHub
```

**Deployment (AWS)**
```bash
eb deploy Agriscanpro-backend-env       # Deploy backend via EB CLI
eb logs                              # View production logs
eb status                            # Check environment health
```

---

## Last Updated
- Date: 2026-04-27
- By: Claude Code
- Status: All hardening phases (Weeks 1–4), MycotoxinResult migration, dependency security hardening (xlsx → exceljs/papaparse), and frontend CSV import bug fixes are complete. `task.md` items 1–46 are all resolved. One FE-1 follow-up remains: revoke outstanding sessions after `/api/accounts/password/set/`. Infra/ops items (DB migration, EB env vars) remain open.


## Pending Actions

### Code hardening status (see [CODE_REVIEW.md](CODE_REVIEW.md) and [task.md](task.md))
- Role policy, refresh-cookie flow, token blacklisting, API config, permissions, OAuth state, and mycotoxin analytics are all complete and verified.
- Dependency security hardening (xlsx → exceljs/papaparse), migration atomicity, and frontend CSV import bugs (task items 41–46) are resolved as of 2026-04-27.
- **Outstanding P1 follow-up**: `POST /api/accounts/password/set/` currently updates credentials without blacklisting all outstanding refresh tokens; this should be aligned with OTP reset behavior.

### Cookie / OAuth environment variables (new in this release)
- `JWT_USE_HTTPONLY_REFRESH_COOKIE` (default `True`) — toggles the httpOnly refresh cookie flow
- `JWT_REFRESH_COOKIE_NAME` (default `refresh_token`)
- `JWT_REFRESH_COOKIE_PATH` (default `/api/accounts/`)
- `JWT_REFRESH_COOKIE_MAX_AGE` (default 7 days)
- `JWT_REFRESH_COOKIE_SECURE` (default matches `not DEBUG`)
- `JWT_REFRESH_COOKIE_SAMESITE` (default `Lax` in DEBUG, `None` in production)
- `GOOGLE_OAUTH_STATE_TTL_SECONDS` (default `300`) — TTL for cached Google OAuth state tokens

### Infra / ops (still open)
- **DB Migration**: `pg_dump` from Aurora → `psql` restore into `agriscanpro-db` (RDS PostgreSQL 16.1, DB name: `agriscan`)
- **EB Env Vars**: Update `DB_HOST`, `DB_NAME=agriscan`, `DB_USER`, `DB_PASSWORD` to point at new RDS instance
- **Cost**: Downgrade `agriscanpro-db` from `db.t4g.small` → `db.t3.micro` before April 30 (AWS credits expire — otherwise ~$43.64/mo)
- Run `python manage.py migrate` after DB restore to ensure all migrations are applied on new instance
- Set `GATEWAY_API_KEY` env var before starting agent orchestrator (will refuse to start without it)
- Set `EMAIL_HOST_USER` + `EMAIL_HOST_PASSWORD` in `.env` for real email delivery (see `.env.example`); without them OTP prints to terminal only
- Set `SRE_MONITOR_KEY` env var to protect system metrics on `/health/` endpoint
- **Local environment**: Install `psutil` (`pip install psutil`) if local health metrics are needed
- **API docs backlog**: Add `drf-spectacular` schema generation when ready
- **FE-1 security follow-up**: Invalidate all outstanding sessions/tokens after successful `POST /api/accounts/password/set/`
