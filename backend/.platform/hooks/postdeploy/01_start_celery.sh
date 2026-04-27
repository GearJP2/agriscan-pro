#!/bin/bash
set -euo pipefail

VENV=$(ls -t /var/app/venv/*/bin/activate 2>/dev/null | head -1)
if [ -z "$VENV" ]; then
    echo "No virtualenv found, skipping Celery."
    exit 0
fi
VENV_BIN=$(dirname "$VENV")
CELERY_LOG_DIR=/var/log/celery
CELERY_RUN_DIR=/var/run/celery
CELERY_LOG_FILE="$CELERY_LOG_DIR/worker.log"
CELERY_PID_FILE="$CELERY_RUN_DIR/worker.pid"

install -d -m 755 "$CELERY_LOG_DIR" "$CELERY_RUN_DIR"
chown webapp:webapp "$CELERY_LOG_DIR" "$CELERY_RUN_DIR"

runuser -u webapp -- bash -lc <<EOF
set -euo pipefail
cd /var/app/current
source "$VENV"

# Check if PID file exists before attempting to read/kill
if [[ -f "$CELERY_PID_FILE" ]]; then
    existing_pid=\$(cat "$CELERY_PID_FILE" 2>/dev/null || echo "")
    if [[ -n "\$existing_pid" ]] && kill -0 "\$existing_pid" 2>/dev/null; then
        echo "Killing existing Celery worker (PID: \$existing_pid)..."
        kill "\$existing_pid" || true
    fi
fi

# Clean up any orphan celery processes for this user
mapfile -t celery_pids < <(pgrep -u webapp -x celery || true)
if (( \${#celery_pids[@]} > 0 )); then
    echo "Cleaning up orphan Celery processes..."
    kill "\${celery_pids[@]}" || true
fi

rm -f "$CELERY_PID_FILE"
echo "Starting new Celery worker..."
nohup "\$VENV_BIN/celery" -A core worker -l info --pidfile="$CELERY_PID_FILE" --logfile="$CELERY_LOG_FILE" > /dev/null 2>&1 &
EOF

echo "Celery started."
