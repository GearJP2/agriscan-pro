# AgriScan Pro Architecture

This document provides a high-level overview of the AgriScan Pro system architecture.

## Overview

AgriScan Pro is a decoupled application composed of:
1. **Frontend**: A React SPA (Single Page Application) built with Vite and TypeScript.
2. **Backend**: A Django REST Framework API, backed by PostgreSQL.
3. **Task Queue**: Celery with Redis for asynchronous processing (like heavy CSV imports).
4. **Cloud Storage**: AWS S3 for securely storing uploaded sample files.

## Component Breakdown

### 1. Frontend (`/frontend`)
- **Framework**: React 18
- **Tooling**: Vite, TypeScript (strict mode enabled), TailwindCSS.
- **Routing**: Client-side routing with lazy loading and concurrent Suspense boundaries for performance.
- **State & Data Fetching**: Standard context providers (`AuthContext`) and modular Axios API clients.

### 2. Backend (`/backend`)
- **Framework**: Django 5.1 with Django REST Framework.
- **Auth**: JWT tokens via `rest_framework_simplejwt`. Access tokens are short-lived. Refresh tokens are HTTP-only cookies to prevent XSS theft.
- **Database**: PostgreSQL (or SQLite locally) storing Users, Samples, and MycotoxinResults.
- **Storage**: `django-storages` + `boto3` to securely stream heavy file uploads to S3 directly or handle background ingestion.

### 3. Background Workers
- **Queue**: Celery handles tasks like parsing large bulk sample uploads.
- **Broker**: Redis serves as the message broker.

### 4. Continuous Integration (`.github/workflows/ci-cd.yml`)
- Automates quality gates on every Pull Request.
- Executes: Django test suites, ESLint, TypeScript compilation checks, SSR Smoke Tests, and pip/npm audit dependency scans.
