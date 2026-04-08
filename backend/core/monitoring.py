import os
import time
import logging
import psutil
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache

_SRE_MONITOR_KEY = os.environ.get('SRE_MONITOR_KEY')

logger = logging.getLogger('agriscan.sre')

def monitor_health_check(request):
    """
    SRE-grade health check (Golden Signals).
    Reports Latency, Saturation, and Connectivity.
    """
    start_time = time.time()
    results = {
        'status': 'healthy',
        'timestamp': time.time(),
        'version': '1.2.0-secure',
        'metrics': {},
        'checks': {}
    }

    # 1. Database Signal (Latency + Connectivity)
    try:
        db_start = time.time()
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        results['checks']['database'] = {
            'status': 'up',
            'latency_ms': round((time.time() - db_start) * 1000, 2)
        }
    except Exception as e:
        results['status'] = 'degraded'
        results['checks']['database'] = {'status': 'down', 'error': str(e)}
        logger.error(f"SRE_HEALTH_FAIL: Database down - {e}")

    # 2. Redis Cache Signal
    try:
        cache_start = time.time()
        cache.set('sre_health_ping', 'pong', timeout=5)
        results['checks']['cache'] = {
            'status': 'up',
            'latency_ms': round((time.time() - cache_start) * 1000, 2)
        }
    except Exception as e:
        results['status'] = 'degraded'
        results['checks']['cache'] = {'status': 'down', 'error': str(e)}
        logger.warning(f"SRE_HEALTH_WARN: Cache degraded - {e}")

    # 3. System Saturation (SRE Signal)
    # Auth Check: Only allow if authenticated or special header (SRE security)
    if not request.user.is_authenticated and (not _SRE_MONITOR_KEY or request.headers.get('X-SRE-AUTH') != _SRE_MONITOR_KEY):
        results['metrics']['system'] = "Unauthorized"
    else:
        results['metrics']['system'] = {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_usage_percent': psutil.disk_usage('/').percent
        }

    # Total Latency
    results['metrics']['total_response_time_ms'] = round((time.time() - start_time) * 1000, 2)
    
    status_code = 200 if results['status'] == 'healthy' else 503
    return JsonResponse(results, status=status_code)
