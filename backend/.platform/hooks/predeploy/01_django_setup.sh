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

# Load EB environment variables so Django can read SECRET_KEY, DB_*, etc.
if command -v /opt/elasticbeanstalk/bin/get-config &>/dev/null; then
    ENV_FILE=$(mktemp)
    /opt/elasticbeanstalk/bin/get-config environment \
        | python3 -c "import sys,json; [print(f'export {k}=\"{v}\"') for k,v in json.load(sys.stdin).items()]" \
        > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    rm -f "$ENV_FILE"
    echo "EB environment variables loaded."
else
    echo "WARN: get-config not found, relying on existing env."
fi

cd /var/app/staging

echo "--- collectstatic ---"
python manage.py collectstatic --noinput

echo "--- migrate ---"
python manage.py migrate --noinput

echo "=== Django setup: done ==="
