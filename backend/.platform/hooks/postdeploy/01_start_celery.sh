#!/bin/bash

# Extract the virtualenv path
VENV_PATH=$(ls -d /var/app/venv/*/bin/activate | head -1)
source $VENV_PATH

# Kill existing celery processes (if any) to prevent duplicates
pkill -f "celery worker" || true
pkill -f "celery beat" || true

# Start Celery Worker in the background
# Output logs to /var/log/celery.log
nohup celery -A core worker -l info > /var/log/celery.log 2>&1 &

# Start Celery Beat in the background (if needed)
# Ensure only one instance runs beat (using leader_only or a single instance env)
# For shared instances, we might want to check if this is the leader
# But for now, we'll assume a single instance or manually manage beat
# nohup celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler > /var/log/celery-beat.log 2>&1 &

echo "Celery worker started successfully."
