# AgriScan Pro V2 Architecture

V2 uses one production EC2 instance running Django and PostgreSQL with
`/home/ubuntu/agriscan-pro/docker-compose.ec2.yml`. The instance is managed
through SSM. The frontend remains in its dedicated S3 bucket behind CloudFront,
and Django publishes public-safe aggregate dashboard snapshots to a separate
private S3 bucket served by CloudFront Origin Access Control.

```text
Browser ── main CloudFront
   ├── default /* ── frontend S3 bucket
   ├── /api/* ── EC2 Elastic IP/DNS ── Django ── local PostgreSQL
   └── /health* ── EC2 Elastic IP/DNS ── Django health endpoint

Dashboard UI ── snapshot CloudFront ── private snapshot S3 bucket

GitHub Actions ── OIDC ── SSM Run Command ── EC2 management command ── S3
```

The static baseline contains aggregates only. Authenticated advanced filters,
threshold simulation, and province-specific NASA requests use Django's shared
dashboard payload service. Redis and Celery are not required by this feature.

## Separate prerequisites

- Keep the frontend and dashboard snapshots in separate S3 buckets so frontend
  deployment cleanup cannot delete snapshots.
- Back up RDS, restore PostgreSQL on the VM, and rehearse recovery.
- Configure `/home/ubuntu/agriscan-pro`, SSM Agent, the instance role, production
  container environment, TLS/routing, and monitoring.
- Remove Redis/Celery only after all remaining workloads have replacements.

These prerequisites are independent work. Static dashboard implementation does
not perform or automate them.

## Production network and stable addressing

The production EC2 network identity is:

| Setting | Value |
|---|---|
| Instance ID | `i-00d57bf6d54db1428` |
| Private IPv4 | `172.31.40.180` |
| Elastic IPv4 | `43.211.57.163` |
| Public DNS | `ec2-43-211-57-163.ap-southeast-7.compute.amazonaws.com` |
| Main CloudFront | `d3s961c8cl4lgn.cloudfront.net` |

The Elastic IP must remain associated with the production instance. An
automatically assigned EC2 public address is released on stop and replaced on
start, which leaves the CloudFront origin pointing at an unreachable host.
Using the associated Elastic IP keeps the public DNS and origin stable across
normal stop/start operations. Do not release or disassociate it during routine
shutdowns.

The main CloudFront distribution has two origin responsibilities:

- Its default behavior serves the React application from the frontend S3
  bucket.
- `/api/*` and `/health*` use the EC2 public DNS custom origin with an HTTP-only
  origin connection on port 80. Viewer connections remain HTTPS.

The EC2 security group must permit port 80 from CloudFront origin-facing
addresses. Django `ALLOWED_HOSTS` must include the Elastic IP, EC2 public DNS,
main CloudFront hostname, `localhost`, and `127.0.0.1`. GitHub post-deployment
validation uses `https://d3s961c8cl4lgn.cloudfront.net/health/`; it must not
depend on direct EC2 public-IP access.

If the Elastic IP is deliberately replaced:

1. Associate the replacement address with `i-00d57bf6d54db1428`.
2. Update the main CloudFront EC2 origin to the resulting public DNS name.
3. Update `.env.ec2` `ALLOWED_HOSTS` and recreate the backend container.
4. Wait for CloudFront deployment and verify `/health/` through CloudFront.

SSM automation uses the instance ID rather than the public address, so
`PRODUCTION_INSTANCE_ID`, the SSM document, and snapshot URLs do not change.

## Snapshot deployment contract

Deploy `infrastructure/dashboard-snapshots.yaml`, attach its publisher policy to
the production EC2 role, and configure the workflow from the stack outputs:

- `CloudFrontBaseUrl` → `DASHBOARD_SNAPSHOT_URL` and
  `VITE_DASHBOARD_SNAPSHOT_URL`
- `GitHubSchedulerRoleArn` → `AWS_DASHBOARD_SNAPSHOT_ROLE_ARN`
- `SnapshotCommandDocumentName` → `DASHBOARD_SNAPSHOT_SSM_DOCUMENT`
- production EC2 instance ID → `PRODUCTION_INSTANCE_ID`

The stack-owned SSM document contains the fixed Docker Compose management
command using `.env.ec2` and `docker-compose.ec2.yml`. The GitHub role cannot
invoke the generic shell-command document.
CloudFront permits cross-origin public reads of validated aggregate JSON while
the S3 bucket remains private.
