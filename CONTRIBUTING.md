# Contributing to AgriScan Pro

First off, thank you for considering contributing to AgriScan Pro! It's people like you that make this application better.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd agriscan-pro
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Backend Setup:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

## Pull Request Process

1. Provide a descriptive title for your Pull Request.
2. Ensure any new features include relevant tests (both Python tests for backend and React tests/smoke tests for frontend).
3. Ensure CI passes on your PR:
   - `npm run lint` and `npm run typecheck` must exit without error.
   - `python manage.py test` must pass all suites.
   - `python backend/scripts/run_dependency_audit.py` should pass in the backend environment.
4. Keep PRs focused. If you are solving multiple issues, consider creating multiple PRs.

## Code Style

- **Python**: Follow standard PEP-8.
- **TypeScript/React**: Follow the internal `eslint.config.js` rules. We enforce `strict` mode in TypeScript.

## Backend Conventions

### Logger Naming

All backend loggers use the `agriscan.<app>` namespace so they map directly to
the handlers in `core/settings.py`:

| Logger name          | Used in                           |
|----------------------|-----------------------------------|
| `agriscan.accounts`  | `accounts/views.py`, `auth_helpers.py`, `oauth.py` |
| `agriscan.samples`   | `samples/views.py`, services, tasks |
| `agriscan.middleware` | `core/middleware.py`, `core/exceptions.py` |
| `agriscan.audit`     | Audit-specific events             |
| `agriscan.sre`       | `core/monitoring.py`              |

When adding a new app or module, create a logger with `logging.getLogger("agriscan.<app>")` and register
a matching entry under `LOGGING["loggers"]` in `core/settings.py`.

### Data-Access Patterns

Two patterns coexist in the backend — use the right one for the right job:

- **Repository** (`accounts/repositories.py`) — Thin wrappers around model queries.
  Used in `accounts` where multiple views share the same lookup logic (e.g. `UserRepository.get_user_by_email`).
- **Service** (`samples/services/`) — Orchestration logic involving multiple models, transactions,
  or business rules. Used in `samples` where bulk operations combine `Sample`, `ProcessLog`, and `MycotoxinResult`.

Do **not** add a Repository class to `samples` or a Service class to `accounts` unless the use case genuinely requires it.
