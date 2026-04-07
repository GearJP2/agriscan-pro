#!/bin/bash
# Runs after pip install, before app starts. Output goes to /var/log/eb-hooks.log

set -e

echo "=== Django setup: starting ==="

VENV=$(ls -t /var/app/venv/*/bin/activate 2>/dev/null | head -1)
echo "Venv: $VENV"

if [ -z "$VENV" ]; then
    echo "ERROR: No virtualenv found at /var/app/venv/"
    exit 1
fi

source "$VENV"
echo "Python: $(which python) $(python --version)"
cd /var/app/staging

echo "--- collectstatic ---"
python manage.py collectstatic --noinput

echo "--- migrate ---"
python manage.py migrate --noinput

echo "=== Django setup: done ==="
