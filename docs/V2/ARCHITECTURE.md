# AgriScan Pro V2 Architecture

V2 uses one production EC2 instance running Django and PostgreSQL with
`/home/ubuntu/agriscan-pro/docker-compose.ec2.yml`. The instance is managed
through SSM. The frontend remains in its dedicated S3 bucket behind CloudFront,
and Django publishes public-safe aggregate dashboard snapshots to a separate
private S3 bucket served by CloudFront Origin Access Control.

```text
Browser ── CloudFront ── frontend S3 bucket
   ├── dashboard snapshot CloudFront ── private snapshot S3 bucket
   └── authenticated /api/* ── EC2 Django ── local PostgreSQL

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
