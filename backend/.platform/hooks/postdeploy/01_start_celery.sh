#!/bin/bash

# On Amazon Linux 2023, the virtualenv is usually at /var/app/venv/staging-compute-with-python-3.12
VENV_ACTIVATE=$(ls /var/app/venv/*/bin/activate 2>/dev/null | head -1)

if [ -z "$VENV_ACTIVATE" ]; then
    echo "Virtual environment not found. Skipping Celery startup."
    exit 0
fi

# Activate the venv
source "$VENV_ACTIVATE"

# Ensure we have a logs directory
mkdir -p /var/app/current/logs
touch /var/app/current/logs/celery.log
chmod 666 /var/app/current/logs/celery.log

# Kill existing celery processes to prevent duplicates
pkill -f "celery worker" || true
pkill -f "celery beat" || true

# Start Celery Worker in the background and DISOWN it
# This ensures Beanstalk doesn't wait for the child process
nohup celery -A core worker -l info --logfile=/var/app/current/logs/celery.log --detach > /dev/null 2>&1 &
disown

echo "Celery worker started and disowned successfully."
exit 0

