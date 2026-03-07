# Backend Python Dependencies

> All packages are listed in `requirements.txt`. Run `pip install -r requirements.txt` to install.

## Core Packages

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **Django** | `>=6.0.0,<6.1.0` | Web framework |
| **djangorestframework** | `>=3.16.0,<3.17.0` | REST API toolkit (DRF) |
| **djangorestframework-simplejwt** | `>=5.4.0` | JWT authentication |
| **django-cors-headers** | `>=4.9.0,<4.10.0` | CORS handling |
| **psycopg2-binary** | `>=2.9.0` | PostgreSQL driver |
| **django-storages[s3]** | `>=1.14.0` | Cloud file storage (Cloudflare R2 / S3) |
| **boto3** | `>=1.35.0` | AWS/R2 SDK (used by django-storages) |
| **gunicorn** | `>=21.2.0` | Production WSGI server |
| **python-dotenv** | `>=1.0.0` | Load `.env` vars in development |

## Redis

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **django-redis** | `>=5.4.0` | Redis cache backend for Django |

> **Note:** This project does **not** install `redis-py` directly — `django-redis` bundles it as a dependency automatically.

### Environment Variable

Add to your `.env` (local) or Railway environment variables (production):

```env
# Local Redis (default if not set)
REDIS_URL=redis://localhost:6379/0

# Production example (Redis with password)
REDIS_URL=redis://:yourpassword@your-redis-host:6379/0
```

### What Django uses Redis for

- **Cache backend** — store API responses, query results, rate-limit counters
- **Broker / Result Backend for Celery** (see below)

---

## Celery (to be implemented by teammate)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **celery** | `>=5.4.0` | Distributed task queue |
| **celery[redis]** | — | Redis transport support for Celery |

### How Django hands off data to Celery via Redis

```
[Django View]
    │
    │  task.delay(arg1, arg2)          ← serializes args → pushes to Redis list
    ▼
[Redis] ──────────────── broker_url = REDIS_URL (db 0)
    │
    │  Celery worker picks up task message
    ▼
[Celery Worker]
    │  runs task, stores result in Redis
    ▼
[Redis] ──────────────── result_backend = REDIS_URL (db 1)
    │
    │  .get() / AsyncResult
    ▼
[Django View / Response]
```

### Quickstart for teammate's `celery.py`

```python
# backend/core/celery.py
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('agriscan')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Django settings.REDIS_URL is exported — reuse it here
from django.conf import settings
app.conf.broker_url = settings.REDIS_URL          # db 0  — task messages
app.conf.result_backend = settings.REDIS_URL.replace('/0', '/1')  # db 1 — results

app.autodiscover_tasks()
```

### Sending a task from a Django view

```python
# views.py (example)
from samples.tasks import run_prediction   # teammate creates this

def predict_view(request, sample_id):
    task = run_prediction.delay(sample_id=sample_id)
    return JsonResponse({'task_id': task.id})  # frontend can poll for status
```

### Polling task status (optional)

```python
from celery.result import AsyncResult

def task_status_view(request, task_id):
    result = AsyncResult(task_id)
    return JsonResponse({'status': result.status, 'result': result.result})
```
