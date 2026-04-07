#!/bin/bash
set -e

VENV=$(ls -t /var/app/venv/*/bin/activate 2>/dev/null | head -1)
if [ -z "$VENV" ]; then
    echo "No virtualenv found, skipping Celery."
    exit 0
fi
source "$VENV"

pkill -f "celery worker" || true
pkill -f "celery beat"   || true

mkdir -p /var/log/celery
nohup celery -A core worker -l info --logfile=/var/log/celery/worker.log > /dev/null 2>&1 &
disown

echo "Celery started."
