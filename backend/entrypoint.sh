#!/bin/sh
set -e

echo "=== PORT: $PORT ==="
echo "=== DB_ENGINE: $DB_ENGINE ==="
echo "=== ALLOWED_HOSTS: $ALLOWED_HOSTS ==="

echo "=== Collecting static files ==="
python manage.py collectstatic --noinput

echo "=== Running migrate ==="
python manage.py migrate --noinput

echo "=== Starting gunicorn on port $PORT with ${WEB_WORKERS:-2} workers ==="
exec gunicorn core.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --timeout 120 \
    --log-level info \
    --access-logfile -
