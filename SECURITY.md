# Security Policy

## Supported Versions

Currently, only the `main` branch deployed to production is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| others  | :x:                |

## Reporting a Vulnerability

Security is a high priority for AgriScan Pro. If you discover a vulnerability or have a security-related concern, please **do not** open a public issue.

Instead, please send an email to the project maintainers outlining:
- The scope and nature of the vulnerability.
- Steps to reproduce the issue.
- Potential impact.

We will review reports and provide a timeline for fixes. Vulnerabilities that require coordinated disclosure will be handled privately until a patch is merged.

## Dependency Scanning

Backend dependency scans should run through:

```bash
python backend/scripts/run_dependency_audit.py
```

This script runs `pip-audit` and applies only the temporary exceptions declared in:

`backend/security/pip_audit_exceptions.json`

## Temporary Exceptions Register

| ID | Package | Status | Added On | Review On | Reason |
| --- | --- | --- | --- | --- | --- |
| `CVE-2026-3219` | `pip` `26.0.1` | Active (temporary) | 2026-04-27 | 2026-05-27 | No fixed upstream release available yet. |
