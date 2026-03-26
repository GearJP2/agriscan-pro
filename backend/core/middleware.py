import logging
import time
from datetime import datetime, date, timezone
from django.core.cache import cache
from django.conf import settings
from django.http import JsonResponse
from accounts.models import User

logger = logging.getLogger('agriscan.middleware')

class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/') and not getattr(settings, 'IS_TESTING', False):
            user_id = request.user.id if request.user.is_authenticated else self.get_client_ip(request)
            minute = int(time.time() // 60)
            
            # Rate limit key
            req_key = f"rate_limit_{user_id}_{minute}"
            requests = cache.get(req_key, 0)
            
            if requests >= 100:
                if request.user.is_authenticated:
                    logger.warning('ratelimit.exceeded', extra={'user': request.user.username, 'path': request.path})
                    self.handle_violation(request.user)
                else:
                    logger.warning('ratelimit.exceeded', extra={'ip': user_id, 'path': request.path})
                return JsonResponse({
                    'error': {
                        'code': 'rate_limit_exceeded',
                        'message': 'Rate limit exceeded. Try again later.',
                    },
                    'status': 'error',
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                }, status=429)

            cache.set(req_key, requests + 1, 60)

        response = self.get_response(request)
        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
        
    def handle_violation(self, user):
        today = date.today().isoformat()
        violation_key = f"violations_{user.id}_{today}"
        violations = cache.get(violation_key, 0)
        
        # We only increment a violation once per minute (since we block all subsequent requests in that minute)
        # To avoid incrementing violations 50 times in the same minute of being blocked, we can add a flag
        minute = int(time.time() // 60)
        violated_this_minute_key = f"violated_{user.id}_{minute}"
        if not cache.get(violated_this_minute_key):
            violations += 1
            cache.set(violation_key, violations, 86400) # 24 hours
            cache.set(violated_this_minute_key, True, 60)
            
            if violations >= 3:
                try:
                    db_user = User.objects.get(id=user.id)
                    db_user.is_active = False
                    db_user.save()
                    logger.error('ratelimit.account_deactivated', extra={'user': db_user.username, 'violation_count': violations})
                except User.DoesNotExist:
                    pass
