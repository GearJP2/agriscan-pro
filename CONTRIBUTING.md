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
4. Keep PRs focused. If you are solving multiple issues, consider creating multiple PRs.

## Code Style

- **Python**: Follow standard PEP-8.
- **TypeScript/React**: Follow the internal `eslint.config.js` rules. We enforce `strict` mode in TypeScript.
