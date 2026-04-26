#!/usr/bin/env python3
"""
Run backend dependency audit with tracked temporary exceptions.

Usage:
    python backend/scripts/run_dependency_audit.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class AuditException:
    """Represents a temporary vulnerability exception for pip-audit."""

    vuln_id: str
    package: str
    status: str
    review_on: date


REPO_ROOT = Path(__file__).resolve().parents[2]
EXCEPTIONS_FILE = REPO_ROOT / "backend" / "security" / "pip_audit_exceptions.json"


def load_active_exceptions(path: Path) -> tuple[list[AuditException], list[AuditException]]:
    """Return active and expired exception lists from the baseline JSON file."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    entries = payload.get("exceptions", [])

    active: list[AuditException] = []
    expired: list[AuditException] = []
    today = date.today()

    for item in entries:
        if item.get("status") != "active":
            continue

        record = AuditException(
            vuln_id=str(item["id"]),
            package=str(item.get("package", "unknown")),
            status=str(item["status"]),
            review_on=date.fromisoformat(str(item["review_on"])),
        )

        if today > record.review_on:
            expired.append(record)
        else:
            active.append(record)

    return active, expired


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
    """Execute pip-audit with temporary ignores and return the exit code."""
    active, expired = load_active_exceptions(EXCEPTIONS_FILE)

    if expired:
        print("Dependency audit baseline has expired exceptions:")
        for record in expired:
            print(
                f"  - {record.vuln_id} ({record.package}) "
                f"review date was {record.review_on.isoformat()}"
            )
        print("Update backend/security/pip_audit_exceptions.json before continuing.")
        return 2

    try:
        executable = ensure_pip_audit_installed()
    except RuntimeError as error:
        print(error)
        return 127

    # Preserve strict-mode behavior from CI while allowing explicit temporary
    # exceptions from the tracked baseline file.
    command = [executable, "--strict"]
    for record in active:
        command.extend(["--ignore-vuln", record.vuln_id])

    print("Running dependency audit:")
    print("  " + " ".join(command))
    return subprocess.run(command, check=False).returncode


if __name__ == "__main__":
    sys.exit(run())
