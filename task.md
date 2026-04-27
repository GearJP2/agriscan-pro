# AgriScan Pro — Roadmap Task Checklist

Reviewed against the current codebase and the roadmap in `.claude/memory/review-this-project-and-humming-robin.md`.
Follow-up review on 2026-04-24 — see [CODE_REVIEW.md](CODE_REVIEW.md).

## Status legend
- `[x]` Complete
- `[ ]` Incomplete or only partially implemented

---

## Week 1 — Stop the bleeding

- [x] **1. Token storage migration**
  Access tokens live in memory only (`frontend/src/lib/tokenStorage.ts`); refresh tokens are stored in an httpOnly cookie set by the backend. Rotation with blacklist is enforced server-side.

- [x] **2. OAuth state validation**
  Google OAuth state is generated on the backend, stored in Redis with TTL (`auth_helpers.store_oauth_state`), validated and invalidated on a single use (`validate_and_consume_oauth_state`). Covered by `GoogleOAuthTests`.

- [x] **3. Role update permission gate**
  `UserDetailView.update` enforces explicit view-level checks for role/`is_active` changes and blocks email on the generic endpoint. Covered by `UserSecurityFieldPermissionTests` and `UserAccessPermissionTests`.

- [x] **4. `DEBUG` default flip**
  `DEBUG = os.environ.get("DEBUG", "False") == "True"` — defaults to `False`.

- [x] **5. Remove committed `.venv/` and orphan docs**
  `.venv/` and `venv/` are ignored and not tracked. The orphan dependency note (`backend/requirement.md`) has been removed; keep `DB/DB.sql` as the schema artifact if it exists.

---

## Week 2 — Quality gates

- [x] **6. CI lint + test gates**
  `.github/workflows/ci.yml` now runs backend Django tests plus frontend lint, typecheck, smoke checks, and production build on pull requests and pushes to `main`.

- [x] **7. Enable TypeScript `strict: true`**
  `frontend/tsconfig.app.json` now runs with `strict: true`, `frontend/tsconfig.json` enables `strictNullChecks`, and the frontend now passes `npm run typecheck`.

- [x] **8. Frontend `ErrorBoundary`s**
  Route rendering is wrapped in a reset-on-navigation `RouteErrorBoundary`, so one broken page no longer crashes the whole app shell.

- [x] **9. Frontend smoke tests**
  `frontend/scripts/smoke-test.mjs` now SSR-loads representative routes/components through Vite and is wired into `npm run smoke`.
- [x] **10. Logger migration in OAuth**
  `oauth.py` now uses `logger.warning` / `logger.error(..., exc_info=True)` throughout.

---

## Week 3 — Performance & scale

- [x] **11. SampleTable virtualization**
  `SampleTable` now window-renders large result sets with overscan instead of painting every row at once.

- [x] **12. Streamed CSV ingestion**
  Sample-result CSV import now streams rows in two passes instead of materializing the full file into memory.

- [x] **13. N+1 audit pass**
  Query-count regression coverage now protects the sample list endpoint from accidental N+1 reintroductions.

- [x] **14. Route-based code splitting**
  Route components are now lazy-loaded in `frontend/src/App.tsx` behind a shared Suspense fallback.

---

## Week 4 — Hardening & docs

- [x] **15. Dependency scanning**
  `pip-audit` (backend) and `npm audit --audit-level=high` (frontend) added to `.github/workflows/ci.yml`.

- [x] **16. Transaction wrappers**
  `SampleViewSet.bulk_create`, `add_mycotoxin_result`, and `SampleIngestionService.process_csv_results` now run inside `transaction.atomic()`.

- [x] **17. `CONTRIBUTING.md`, `SECURITY.md`, `ARCHITECTURE.md`**
  Created at repository root with development setup, PR guidelines, security disclosure policy, and system architecture overview.

- [x] **18. WIP banners on `agents-orchestrator` + `.mcp`, consolidate entrypoint scripts**
  `README.md` has a `[!WARNING]` block; `orchestrator.js`, `api-gateway.js`, and `start.sh` print WIP banners at startup.

- [x] **19. Expand `.env.example`**
  `.env.example` created at repository root covering all `settings.py` and frontend env variables.

- [x] **20. Audit log table**
  `AuditLog` model created in `core/models.py` with `JSONField` for changes. Wired into `SampleViewSet.destroy()` and `bulk_delete()`.

---

## 2026-04-24 follow-up review — action items

Items flagged in the Week 1 hardening review that still need to land. See [CODE_REVIEW.md](CODE_REVIEW.md#2026-04-24--week-1-security-hardening-follow-up).

### Critical
- [x] **21. Revert `USER_SECURITY_FIELD_ROLES` and `USER_DIRECTORY_VIEW_ROLES` regression (C1)**
  Include `head_researcher` and `researcher` alongside `admin` to restore prior policy. Add a test asserting head_researcher can manage roles.

- [x] **22. Make `blacklist_all_user_tokens` atomic (C2 / BR-C3)**
  Replace the `get_or_create` loop with `bulk_create(ignore_conflicts=True)` inside `transaction.atomic()`.

- [x] **23. Remove body-token fallback on `/login/refresh/` and dead fallback branch in `CustomTokenRefreshView` (C3)**
  Cookie-only going forward. Delete the fallback branch that re-issues the old refresh cookie. Remove `test_refresh_accepts_body_token_for_backward_compatibility`.

### Major
- [x] **24. Replace stale Railway fallback URL in `frontend/src/lib/api.ts` (M1)**
  Production now falls back to CloudFront-routed same-origin `/api` instead of a stale Railway host.

- [x] **25. Clean Thai comments in `backend/core/settings.py:148-149` (M4 / BR-M2)**
  Translate the two AWS_S3 comments to English.

- [x] **26. Extract `IsAdmin` permission class (M5 / BR-C2)**
  Replace the `can_view_user_directory` raise in `UserListView.get_queryset` and the inline admin checks in `samples/views.py` with a shared permission class.

- [x] **27. Split walrus operator in `CustomTokenRefreshView` (M3)**
  Replace `set_refresh_cookie(response := Response(...), token)` with two statements.

- [x] **28. Add SSL/cookie misconfiguration guard**
  On startup, raise when `JWT_REFRESH_COOKIE_SAMESITE="None"` and `JWT_REFRESH_COOKIE_SECURE=True` are combined with `FORCE_SSL=False` and `DEBUG=True`. Catches misconfigured local/staging envs — production is unaffected because SSL terminates at CloudFront.

### Minor
- [x] **29. Drop redundant `sessionStorage` OAuth state check (M2)**
  Server cache is authoritative; the sessionStorage layer breaks cross-tab callbacks.
- [x] **30. Fail-fast check for missing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`** (M9 in review)
- [x] **31. Move mid-module import `from urllib.parse import urlencode` to top of `oauth.py`** (M10 in review)
- [x] **32. Delete legacy `generateGoogleAuthURL` throw-stub in `frontend/src/lib/oauth.ts`** (M11 in review)

---

## 2026-04-24 sample suite investigation — unrelated pre-existing failures

Confirmed while running the full `backend/samples/tests.py` suite after the auth hardening work. These failures are outside the Week 1 auth scope and still need their own follow-up.

- [x] **33. Fix legacy/wide CSV column parsing in `SampleIngestionService.extract_results_from_row()`**
  The importer now detects toxin columns by header name instead of blindly skipping the first two columns. Legacy layouts like `Sample ID,AFB1,DON` and `SampleID,Aflatoxin B1` are parsed correctly again, including normalized sample ID matching for omitted leading zeros. This resolved:
  `test_bulk_import_results_matches_sample_id_and_creates_results`,
  `test_bulk_import_results_accepts_sampleid_header_variant`,
  `test_bulk_import_results_matches_when_numeric_segment_has_no_leading_zero`.

- [x] **34. Reintroduce explicit mycotoxin intensity validation bounds**
  Manual mycotoxin result entry now enforces the legacy `1..10` band at the serializer layer, while CSV imports continue to bypass that serializer and store exact lab values. This resolved:
  `test_add_mycotoxin_result_intensity_too_high_returns_400` and
  `test_add_mycotoxin_result_intensity_too_low_returns_400`

- [x] **35. Reconcile `SampleListSerializer.get_risk_level()` with the intended risk policy**
  `SampleListSerializer.get_risk_level()` now matches the current test contract again:
  `dangerous=True` => `high`,
  `intensity >= 7` => `medium`,
  `intensity 4..6` => `low`.
  This resolved the remaining risk-level regression in `samples.tests`.

---

## Supplemental backend code-health backlog
These items align with the roadmap goals, but are called out separately because they directly affect Django readability, consistency, maintainability, and operational safety.

### Critical
- [x] **BR-C1. Simplify CORS configuration in `backend/core/settings.py`**
  Collapsed duplicated `_CORS_ORIGINS` loop into a single `dict.fromkeys` dedup pass. Env origins + local defaults are now built in one declarative block.

- [x] **BR-C2. Extract duplicated admin checks into a dedicated permission class**
  Addressed with shared `IsAdmin` / `IsAdminOrResearchRole` classes in `backend/core/permissions.py`.

- [x] **BR-C3. Extract token blacklisting into a shared repository/service helper**
  `auth_helpers.blacklist_all_user_tokens()` is now shared and atomic.

### Major
- [x] **BR-M1. Move mid-file imports to the top of `backend/core/settings.py`**
  `django.core.exceptions.ImproperlyConfigured` now precedes third-party imports per PEP-8 convention.
- [x] **BR-M2. Translate mixed-language comments to one project language**
  The remaining Thai comments in `settings.py` have been translated to English.
- [x] **BR-M3. Add consistent docstrings to account views and methods**
  All view classes in `accounts/views.py` now have clear docstrings describing purpose and auth policy.
- [x] **BR-M4. Extract magic numbers into constants**
  `accounts/views.py`: `MAX_OTP_REQUESTS`, `OTP_REQUEST_PERIOD_SEC`, `MAX_OTP_VERIFY_ATTEMPTS`, `OTP_VERIFY_PERIOD_SEC`, `OTP_EXPIRY_MINUTES`, `EMAIL_CHANGE_EXPIRY_HOURS`. `samples/views.py`: `BULK_DELETE_LIMIT`.
- [x] **BR-M5. Move `bulk_create` orchestration out of the view and into the service layer**
  Created `samples/services/sample_service.py` with `SampleService.bulk_create_samples()`. View now validates + delegates + responds.
- [x] **BR-M6. Replace broad exception handling in bulk import with proper logging and safer client responses**
  `bulk_import_results` now catches `ValueError`/`IntegrityError` (400) separately from generic `Exception` (500). The 500 path uses `logger.exception()` for full traceback and returns a safe generic message to the client.
- [x] **BR-M7. Enforce formatting/linting consistency in CI**
  CI now runs frontend lint/typecheck/smoke/build plus backend Django tests on push and pull request.

### Minor
- [x] **BR-MN1. Move `RECENT_ALERTS_LIMIT` to the top-level class constant area**
  Now a module-level constant alongside `BULK_DELETE_LIMIT`.
- [x] **BR-MN2. Wrap long queryset lines for readability**
  Class-level queryset in `SampleViewSet` wrapped across 5 lines.
- [x] **BR-MN3. Wrap long repository logging calls**
  All `logger.*` calls in `samples/views.py` that exceeded ~88 cols are now multi-line.
- [x] **BR-MN4. Remove stale/misleading comments**
  Replaced 4-line "thinking out loud" block in `accounts/views.py` with a single-line summary.
- [x] **BR-MN5. Document logger naming convention**
  `CONTRIBUTING.md` now has a Logger Naming section with a table of `agriscan.*` namespaces.
- [x] **BR-MN6. Standardize repository pattern usage across apps**
  `CONTRIBUTING.md` now has a Data-Access Patterns section clarifying Repository vs Service usage.

---

## Suggested implementation order

### Highest priority (land before merging Week 1)
- [x] 21. Revert role-policy regression
- [x] 22. Atomize `blacklist_all_user_tokens`
- [x] 23. Remove body-token refresh fallback
- [x] 28. SSL/cookie misconfiguration guard

### Next best wins
- [x] 24. Fix stale API URL
- [x] 25. Clean Thai comments
- [x] 26. Extract `IsAdmin` permission class
- [x] 5.  Remaining repo hygiene
- [x] 6.  CI lint/test gates

### Performance phase
- [x] 12. Stream CSV ingestion
- [x] 13. Audit N+1 query behavior with tests
- [x] 11. Virtualize `SampleTable`
- [x] 14. Route-level code splitting

### Documentation and maintainability phase
- [x] 17. Add missing project docs
- [x] 19. Expand environment example
- [x] 15. Add dependency scanning
- [x] 18. Clean orphan files and inconsistent WIP messaging
- [x] 20. Introduce persistent audit logging for sample mutations

---

## Future Enhancements (Nice to Have)

- [x] **FE-1. OAuth & Password Account Linking**
  Implemented seamless linking between Username/Password and Google OAuth with verified-email auto-linking, plus Account Settings UI for connect/disconnect provider management and password set/change flows.

- [ ] **FE-2. Sample status state-transition validation**
  Enforce valid state transitions (e.g. `pending → in_progress → completed`) in a service-layer guard. Currently any status value within the `STATUS_CHOICES` is accepted regardless of the current state. This is business logic that belongs in `SampleService`, not the serializer.

- [ ] **FE-3. Future collection-date guard**
  Reject `collection_date` values that are in the future at the serializer level. Samples cannot logically be collected in the future.

- [ ] **FE-4. API documentation (`drf-spectacular`)**
  Auto-generate OpenAPI schema and serve Swagger/Redoc UI.

- [x] **FE-5. CI/CD Orchestration (Pipeline Dependency)**
  Consolidate `ci.yml`, `deploy-backend.yml`, and `deploy-frontend.yml` into a single workflow or utilize `workflow_run` to prevent race conditions. Ensure deployment jobs only trigger *after* the testing/linting jobs pass successfully to prevent broken code from being deployed.

---

## 2026-04-26 infrastructure stability & aesthetics phase

Final hardening items and aesthetic standardization.

- [x] **36. Migration graph linearization**
  Removed redundant migrations (`accounts:0004`, `samples:0008`) and re-linked dependencies to restore a clean, linear deployment path.
- [x] **37. Modular Profile refactor**
  Extracted monolithic `Profile.tsx` logic into `useProfile.ts` hook and split UI into smaller components.
- [x] **38. OAuth PKCE verification**
  Audited and confirmed SHA-256 + Base64URL-encoded PKCE flow in `oauth.ts`.
- [x] **39. Theme standardization**
  Replaced hardcoded color values with semantic CSS variables (`primary`, `success`, `warning`, `destructive`) across all core screens for robust dark mode support.
- [x] **40. Failed-row CSV generation**
  `SampleIngestionService` now captures raw failing rows and provides an `export_failed_rows` endpoint for user-facing error reports.
- [x] **41. Resolve backend migration test OperationalError**
  Fixed "pending trigger events" on PostgreSQL by setting `atomic = False` in migration `0010` and `0009`. Corrected `MycotoxinResultMigration0010Tests` setup.
- [x] **42. Resolve frontend dependency vulnerabilities**
  Eliminated high-severity ReDoS/Prototype Pollution risks by replacing `xlsx` with `exceljs` and `papaparse`. Fixed moderate risks with `uuid` overrides.
- [x] **43. Fix Papa.parse missing `skipEmptyLines` (Medium bug)**
  All 4 Papa.parse calls in `UnifiedImportForm`, `AdvancedImportForm`, `AddSampleForm` (×2) now include `skipEmptyLines: true`. `error` callbacks retyped from `any` to `Error` (matches `@types/papaparse` signature).
- [x] **44. Fix `URL.revokeObjectURL` missing in SampleList export (Medium bug)**
  `handleExportXLSX` in `SampleList.tsx` now calls `URL.revokeObjectURL(url)` immediately after `link.click()`.
- [x] **45. Fix unused `rowNumber` param and `error: any` type smells**
  `AddSampleForm.tsx` `eachRow` callback param removed. All Papa.parse `error` callbacks now typed as `Error`.
- [x] **46. Fix W293 trailing whitespace in views.py (PEP8)**
  Stripped all trailing whitespace from blank lines in `backend/samples/views.py`. flake8 now passes clean.

---

## 2026-04-27 dashboard analytics & ui logic phase (Current)

Resolved critical UX regressions in the surveillance dashboard and implemented high-end UI interactions.

- [x] **47. Fix Regional Risk Ranking context (Bug)**
  Separated ranking/map data queries from global filters. Ranking now maintains a complete list of all provinces even when a specific province is selected, using `rankingFilters` (provinces=null).
- [x] **48. Implement Selection Toggle (Feature)**
  Added toggle behavior to province selection in both `RegionalRiskMap` and `RegionalRiskRanking`. Clicking an already selected province now clears the filter.
- [x] **49. Dashboard Layout & Contextual KPI Header (Refactor)**
  Reordered sections (Strategic summary first, then Filter/KPI above Map). Redesigned `KPICards` header to dynamically show the selected province name with a MapPin badge and "Drilling down" indicators.
- [x] **50. Adaptive Morphing Sticky Filter (UI/UX)**
  Created a smart sticky `DashboardFilterBar` that attaches to the header when scrolling. It dynamically morphs (removes top rounding, overlaps header border, matches header translucency) to create a "Single Block" appearance.
- [x] **51. Test Data Management (Admin Tools)**
  Implemented `TestDataService`, secured API actions with `IsAdmin`, added comprehensive tests, and integrated the "Admin Tools" dropdown into the `SampleList` UI. Verified with 76 backend tests and 0 frontend errors.
- [x] **52. Dashboard Crash & UI Fixes**
  Fixed a syntax error in `SurveillanceDashboard.tsx` that caused a crash. Resolved `z-index` conflict between the Header and the Threshold Controller/Filter Bar to ensure proper layering during scroll.

---

## Summary

- **Completed roadmap tasks:** `20 / 20` (items 1–20)
- **Completed follow-up review items:** `12 / 12` (items 21–32)
- **Resolved unrelated sample follow-ups:** `3 / 3` (items 33–35)
- **Infrastructure stability & aesthetics:** `16 / 16` (items 36–51) — **all complete**
- **Backend cleanup backlog:** `16 / 16` (BR-C1–C3, BR-M1–M7, BR-MN1–MN6) — **complete**
- **Recommended focus:** Future enhancements (`FE-*`)

This checklist should be updated as each roadmap item is actually merged and verified.
