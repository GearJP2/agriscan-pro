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

# Dump EB environment variables to a JSON file (avoids shell quoting issues
# that occur when values contain $, ", \, or newlines).
EB_ENV_JSON=$(mktemp)
if command -v /opt/elasticbeanstalk/bin/get-config &>/dev/null; then
    /opt/elasticbeanstalk/bin/get-config environment > "$EB_ENV_JSON"
    echo "EB env vars loaded ($(wc -c < "$EB_ENV_JSON") bytes)."
else
    echo '{}' > "$EB_ENV_JSON"
    echo "WARN: get-config not found, using empty env override."
fi

cd /var/app/staging

# Use Python to merge EB env vars with the current shell environment and
# invoke manage.py — this is safe regardless of special characters in values.
python - <<PYEOF
import json, os, subprocess, sys

with open("$EB_ENV_JSON") as f:
    eb_env = json.load(f)

# Merge: EB vars override existing shell env (EB takes precedence)
env = {**os.environ, **eb_env}

print("--- collectstatic ---", flush=True)
r = subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"],
                   env=env)
if r.returncode != 0:
    sys.exit(r.returncode)

print("--- migrate ---", flush=True)
r = subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"],
                   env=env)
if r.returncode != 0:
    sys.exit(r.returncode)

print("=== Django setup: done ===", flush=True)
PYEOF

rm -f "$EB_ENV_JSON"
