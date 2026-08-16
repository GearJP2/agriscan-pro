#!/usr/bin/env python3
"""
Run the backend dependency audit.

Usage:
    python backend/scripts/run_dependency_audit.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys


def ensure_pip_audit_installed() -> str:
    """Return executable path for pip-audit or raise a user-friendly error."""
    executable = shutil.which("pip-audit")
    if executable:
        return executable

    raise RuntimeError(
        "pip-audit is not installed in the current environment. "
        "Install it first: `python -m pip install pip-audit`."
    )


def run() -> int:
    """Execute pip-audit in strict mode and return the exit code."""
    try:
        executable = ensure_pip_audit_installed()
    except RuntimeError as error:
        print(error)
        return 127

    command = [executable, "--strict"]

    print("Running dependency audit:")
    print("  " + " ".join(command))
    return subprocess.run(command, check=False).returncode


if __name__ == "__main__":
    sys.exit(run())
