# Architecture Index

AgriScan Pro architecture is versioned so the deployed system and target system
are not confused.

- [V1 architecture](V1/ARCHITECTURE.md) — historical Elastic Beanstalk, RDS,
  optional Redis/Celery, S3, and CloudFront deployment.
- [V2 architecture](V2/ARCHITECTURE.md) — current EC2 Docker Compose backend,
  local PostgreSQL, S3/CloudFront frontend, and static dashboard snapshots.

Supporting V1 operational documents are grouped in [`V1/`](V1/README.md).
