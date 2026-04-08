# AgriScan Pro

A comprehensive agricultural research platform for lab sample analysis and mycotoxin detection. Built with a React frontend and Django REST Framework backend, deployed on AWS.

## 1. Stack

### 1.1 Runtimes

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.20.0+` | Frontend runtime |
| **Python** | `3.12.x` | Backend runtime |
| **PostgreSQL** | `16+` | Production database (Aurora Serverless v2) |
| **Redis** | `7.x` | Cache + Celery broker (ElastiCache OSS) |

### 1.2 Frontend
- **React** `18.3.1` + **Vite** `5.4.x` + **TypeScript**
- **Tailwind CSS** `3.4.x` / **Shadcn UI** / **React Query** `5.x`
- **Framer Motion** (page transitions)

### 1.3 Backend
- **Django** `6.0.x` + **Django REST Framework** `3.16.x`
- **django-redis** `5.4.x` + **Celery** `5.4.x`
- **django-storages[s3]** (S3 file uploads via IAM Instance Profile)
- **psycopg2-binary** (self-contained, no system libpq required)

---

## 2. Infrastructure (Production — AWS ap-southeast-1)

| Service | Component | Details |
| :--- | :--- | :--- |
| **Elastic Beanstalk** | API Tier | Python 3.12 / AL2023 — `Agriscanpro-backend-env` |
| **Aurora PostgreSQL** | Database | Serverless v2 (v16.1) — publicly accessible |
| **ElastiCache** | Cache/Broker | Redis OSS v7, TLS (`rediss://`), private VPC only |
| **Amazon S3** | Storage | IAM Instance Profile auth — no credentials in code |
| **CloudFront** | CDN | Frontend (Vite build) + S3 asset delivery |

### 2.1 VPC & Security Group Notes

- EB and ElastiCache must be in the **same VPC**
- The ElastiCache security group must allow **TCP 6379 inbound from the EB instance security group**
- Aurora is publicly accessible; the RDS SG allows TCP 5432 from the EB SG

### 2.2 Production Environment Variables

Set these in **EB Console → Configuration → Updates, monitoring, and logging → Platform software**:

| Variable | Example / Notes |
| :--- | :--- |
| `SECRET_KEY` | Django secret key |
| `DB_ENGINE` | `postgresql` |
| `DB_HOST` | Aurora cluster endpoint |
| `DB_NAME` | `agriscan_db` |
| `DB_USER` | `agriscan_user` |
| `DB_PASSWORD` | DB user password |
| `REDIS_URL` | `rediss://[ElastiCache-endpoint]:6379/0` |
| `ALLOWED_HOSTS` | `agriscan-api-v2.ap-southeast-1.elasticbeanstalk.com` |
| `CORS_ALLOWED_ORIGINS` | Frontend URL(s), comma-separated |
| `GATEWAY_API_KEY` | Agent orchestrator auth — **required, app won't start without it** |
| `SRE_MONITOR_KEY` | Protects system metrics on `/health/` |
| `EMAIL_HOST_USER` | SMTP user (omit to print OTPs to console) |
| `EMAIL_HOST_PASSWORD` | SMTP password / App Password |
| `DEFAULT_FROM_EMAIL` | `AgriScan Pro <noreply@yourdomain.com>` |

---

## 3. Deployment

### 3.1 Automated (GitHub Actions)

Push to `main` → GitHub Actions deploys to Elastic Beanstalk automatically.

**Required GitHub Secrets:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (`ap-southeast-1`)

Workflow: [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml)

### 3.2 Manual (EB CLI)

```bash
cd backend
eb deploy Agriscanpro-backend-env
```

### 3.3 How Deployment Works

On each deploy, the predeploy hook [`.platform/hooks/predeploy/01_django_setup.sh`](backend/.platform/hooks/predeploy/01_django_setup.sh) runs:
1. `collectstatic` — copies static files to `staticfiles/`
2. `migrate` — applies any pending DB migrations

Celery worker is started by [`.platform/hooks/postdeploy/01_start_celery.sh`](backend/.platform/hooks/postdeploy/01_start_celery.sh).

---

## 4. Health Check

```
GET /health/
```

Returns:
```json
{
  "status": "healthy",
  "checks": {
    "db": "ok",
    "cache": "ok"
  }
}
```

Always returns HTTP 200. The `checks` field shows live DB and Redis reachability — useful for diagnosing connectivity issues after deploy.

---

## 5. Monitoring & Logs

| Log | Location |
| :--- | :--- |
| Application logs | CloudWatch Logs (via EB) |
| Deploy/hook logs | `eb logs` → `eb-hooks.log` |
| Celery worker | `/var/log/celery.log` on instance |
| DB logs | Amazon RDS Console (Aurora) |

---

## 6. Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in local credentials
python manage.py migrate
python manage.py runserver   # http://localhost:8000
```

---

## 7. Running Django Commands on EB (via SSH)

EB environment variables are not loaded in interactive SSH sessions. Always source them first:

```bash
source /opt/elasticbeanstalk/deployment/env && python manage.py <command>
```

**Create superuser:**
```bash
source /opt/elasticbeanstalk/deployment/env && \
DJANGO_SUPERUSER_PASSWORD=yourpassword python manage.py createsuperuser \
  --username admin --email admin@example.com --noinput
```

**Run migrations manually:**
```bash
source /opt/elasticbeanstalk/deployment/env && python manage.py migrate
```
