#!/bin/bash
# .platform/hooks/postdeploy/01_start_celery.sh
#
# Runs AFTER each deployment on Elastic Beanstalk (Amazon Linux 2 / AL2023).
# Creates a systemd unit for the Celery worker and (re)starts it.
# EB environment variables are sourced from the deployment env file so Celery
# can reach RDS, ElastiCache, and S3 without any extra config.

set -e

# ── Locate EB deployment env file ────────────────────────────────────────────
EB_ENV_FILE=/opt/elasticbeanstalk/deployment/env
if [ ! -f "$EB_ENV_FILE" ]; then
    echo "WARNING: EB env file not found at $EB_ENV_FILE" >&2
    EB_ENV_FILE=""
fi

# ── Locate virtual environment ───────────────────────────────────────────────
VENV_BIN=$(ls -d /var/app/venv/*/bin 2>/dev/null | head -1)
if [ -z "$VENV_BIN" ]; then
    echo "ERROR: Could not locate virtual environment under /var/app/venv/" >&2
    exit 1
fi
CELERY_BIN="${VENV_BIN}/celery"

echo "Using Celery binary: $CELERY_BIN"

# ── Write systemd service unit ────────────────────────────────────────────────
cat > /etc/systemd/system/celery-worker.service << UNIT
[Unit]
Description=AgriScan Pro - Celery Worker
After=network.target

[Service]
Type=simple
User=webapp
Group=webapp
WorkingDirectory=/var/app/current
$([ -n "$EB_ENV_FILE" ] && echo "EnvironmentFile=${EB_ENV_FILE}" || true)
ExecStart=${CELERY_BIN} -A core worker \\
    --loglevel=info \\
    --concurrency=2 \\
    --max-tasks-per-child=100
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=celery-worker

[Install]
WantedBy=multi-user.target
UNIT

# ── Enable and (re)start ──────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable celery-worker
systemctl restart celery-worker

echo "Celery worker service started successfully."
