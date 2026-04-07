# AgriScan Pro - Agriculture Scanning System

A comprehensive Django-based backend and React frontend system for agricultural scanning and data management.

## 1. System & Stack Requirements

To run, build, or contribute to this project, you will need to have the following runtimes and frameworks installed.

### 1.1 Runtimes

| Technology | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.20.0+` | Core JavaScript runtime for the frontend. |
| **npm** | `10.8.x+` | Package manager for frontend dependencies. |
| **Python** | `3.12.x` | Runtime for the Django backend. |
| **PostgreSQL** | `16+` | Production relational database (Aurora Serverless v2). |
| **Redis** | `7.x` | Cache backend + Celery broker (ElastiCache OSS). |

### 1.2 Frontend Core

- **React** `18.3.1` / **Vite** `5.4.19`
- **TypeScript** / **Tailwind CSS** `3.4.17`
- **Shadcn UI** / **React Query** `5.83.0`

### 1.3 Backend Core

- **Django** `6.0.x` / **Django REST Framework** `3.16.x`
- **django-redis** `5.4.x` / **Celery** `5.4.x`
- **django-storages[s3]** (AWS S3 for file uploads)

---

## 2. Infrastructure (Production - AWS)

The production environment is hosted on AWS using a highly available and scalable serverless architecture.

| Service | Component | Details |
| :--- | :--- | :--- |
| **Elastic Beanstalk**| Web/API Tier | Python 3.12 running on AL2023 (`Agriscan-Backend-env`) |
| **Aurora Postgres** | Database Tier | Serverless v2 (v16.1) |
| **ElastiCache** | Cache/Queue | Redis OSS v7 with TLS/Encryption enabled |
| **Amazon S3** | Storage Tier | Managed via IAM Instance Profile (no keys in code) |
| **CloudFront** | Global Delivery | Serving Frontend (Vite) and S3 assets |

### 2.1 Production Environment Variables

Set these in the **Elastic Beanstalk Console** (Configuration > Updates, monitoring, and logging > Platform software):

- `DB_ENGINE`: `postgresql`
- `DB_HOST`: *[Aurora Endpoint]*
- `DB_NAME`: `agriscan_db`
- `REDIS_URL`: `rediss://[ElastiCache-Endpoint]:6379/0` (Note the `rediss://` for TLS)
- `AWS_STORAGE_BUCKET_NAME`: *[Your-S3-Bucket]*
- `ALLOWED_HOSTS`: `api.yourdomain.com,Agriscan-Backend-env.ap-southeast-1.elasticbeanstalk.com`
- `CORS_ALLOWED_ORIGINS`: `https://yourdomain.com`

---

## 3. Deployment Guide

### 3.1 Automated Deployment (CI/CD)
The project uses **GitHub Actions** for automated deployment to AWS Elastic Beanstalk.
- Workflow: `.github/workflows/deploy-backend.yml`
- **Required GitHub Secrets:**
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (e.g., `ap-southeast-1`)

### 3.2 Manual Deployment (EB CLI)
If needed, you can deploy manually from the `backend` folder:
```bash
cd backend
eb deploy Agriscan-Backend-env
```

---

## 4. Monitoring & Logs

- **Application Logs:** Streamed to **CloudWatch Logs** via Elastic Beanstalk.
- **Celery Worker Logs:** Located on the instance at `/var/log/celery.log`.
- **Database Logs:** Accessible via Amazon RDS Console (Aurora).
- **Health Check:** EB pings `/health/` (monitored in EB Dashboard).

---

## 5. Local Development Setup

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver
```

> See [`backend/requirement.md`](./backend/requirement.md) for detailed Redis & Celery configuration.
