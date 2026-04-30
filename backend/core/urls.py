"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


def health_check(_request):
    """
    Health check endpoint used by Elastic Beanstalk and monitoring.

    Always returns HTTP 200 unless the database is unreachable.

    Response shape:
        {
            "status": "ok" | "degraded",
            "database": {"status": "ok" | "failed", "error": "..."},
            "redis": {
                "status": "ok" | "failed" | "skipped",
                "reason": "..."          # present when skipped
            },
            "tasks": {"mode": "sync" | "async"}
        }
    """
    from django.conf import settings
    from django.db import connection

    async_enabled: bool = getattr(settings, "ASYNC_TASKS_ENABLED", False)
    redis_url: str = getattr(settings, "REDIS_URL", "")
    task_mode = "async" if async_enabled else "sync"

    # ── Database check ────────────────────────────────────────────────────────
    db_status: dict = {"status": "ok"}
    overall_status = "ok"
    try:
        connection.ensure_connection()
    except Exception as exc:
        db_status = {"status": "failed", "error": str(exc)[:120]}
        overall_status = "degraded"

    # ── Redis check ───────────────────────────────────────────────────────────
    if not async_enabled or not redis_url:
        redis_status: dict = {
            "status": "skipped",
            "reason": "ASYNC_TASKS_ENABLED=False" if not async_enabled else "REDIS_URL not set",
        }
    else:
        try:
            from django.core.cache import cache
            cache.set("_health_ping", "1", timeout=5)
            if cache.get("_health_ping") == "1":
                redis_status = {"status": "ok"}
            else:
                redis_status = {"status": "failed", "error": "ping returned unexpected value"}
                overall_status = "degraded"
        except Exception as exc:
            redis_status = {"status": "failed", "error": str(exc)[:120]}
            overall_status = "degraded"

    return JsonResponse({
        "status": overall_status,
        "database": db_status,
        "redis": redis_status,
        "tasks": {"mode": task_mode},
    })


urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/', include('samples.urls')),
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
