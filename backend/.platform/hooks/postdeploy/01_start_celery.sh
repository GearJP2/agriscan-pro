#!/bin/bash
set -e

VENV=$(ls -t /var/app/venv/*/bin/activate 2>/dev/null | head -1)
if [ -z "$VENV" ]; then
    echo "No virtualenv found, skipping Celery."
    exit 0
fi
VENV_BIN=$(dirname "$VENV")

mkdir -p /var/log/celery

runuser -u webapp -- bash -lc "
cd /var/app/current
source \"$VENV\"
pkill -f \"celery -A core worker\" || true
pkill -f \"celery beat\" || true
nohup \"$VENV_BIN/celery\" -A core worker -l info --logfile=/var/log/celery/worker.log > /dev/null 2>&1 &
disown
"

echo "Celery started."
