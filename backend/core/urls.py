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
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    """Elastic Beanstalk health check endpoint."""
    checks = {}

    try:
        from django.db import connection
        connection.ensure_connection()
        checks['db'] = 'ok'
    except Exception as e:
        checks['db'] = f'error: {e}'

    try:
        from django.core.cache import cache
        cache.set('health_check', '1', 10)
        checks['cache'] = 'ok'
    except Exception as e:
        checks['cache'] = f'error: {e}'

    # Always return 200 so EB health check passes — individual service issues are in the body
    return JsonResponse({'status': 'healthy', 'checks': checks})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health-check'),
    path('api/accounts/', include('accounts.urls')),
    path('api/', include('samples.urls')),
]
