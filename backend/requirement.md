# Backend Python Dependencies

> All packages are listed in `requirements.txt`. Run `pip install -r requirements.txt` to install.

## 1. Core Packages

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **Django** | `>=6.0.0,<6.1.0` | Web framework |
| **djangorestframework** | `>=3.16.0,<3.17.0` | REST API toolkit (DRF) |
| **djangorestframework-simplejwt** | `>=5.4.0` | JWT authentication |
| **psycopg2-binary** | `>=2.9.0` | PostgreSQL driver |
| **django-storages[s3]** | `>=1.14.0` | Cloud file storage (AWS S3) |
| **boto3** | `>=1.35.0` | AWS SDK |
| **gunicorn** | `>=21.2.0` | Production WSGI server |

---

## 2. Redis (Cache & Broker)

The project uses Redis for both Django caching and as a message broker for Celery.

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **django-redis** | `>=5.4.0` | Redis cache backend (includes `redis-py`) |

### 2.1 Connection String (`REDIS_URL`)

- **Local:** `redis://localhost:6379/0`
- **Production (AWS ElastiCache):** `rediss://[endpoint]:6379/0`
  - Use `rediss://` (double 's') for TLS/SSL connections.
  - ElastiCache with encryption enabled requires `REDIS_SSL_CERT_REQS=required` (default in `settings.py`).

---

## 3. Storage (AWS S3)

In production, files are stored in Amazon S3. 

- **IAM Auth:** The application uses **IAM Instance Profiles** on Elastic Beanstalk. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` do **not** need to be set in environment variables if the EC2 role has S3 permissions.
- **Config:** Managed via `STORAGES` in `settings.py`.

---

## 4. Celery (Async Tasks)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **celery[redis]** | `>=5.4.0` | Async task queue with Redis support |

### 4.1 Deployment on AWS Beanstalk
Celery workers are managed via `.platform/hooks/postdeploy/01_start_celery.sh`. This script:
1. Activates the virtual environment.
2. Stops any hanging celery processes.
3. Starts a new `celery worker` in the background.

### 4.2 Code Setup (`backend/core/celery.py`)

```python
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('agriscan')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Autodiscover tasks in all installed apps
app.autodiscover_tasks()
```

### 4.3 Monitoring Tasks
On the server, you can monitor worker output:
```bash
tail -f /var/log/celery.log
```
