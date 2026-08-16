# EC2 Internal Prototype Deployment

This is the one-box path for running the Django backend and PostgreSQL on a
single EC2 instance. It is intended for an internal prototype, not high
availability production.

## Recommended Instance

- Start with `t3.medium` or `t4g.medium` if you build ARM images intentionally.
- Use at least 40 GB `gp3` EBS.
- Open inbound `80/tcp` to your allowed IP range.
- Do not open `5432/tcp`; PostgreSQL is private inside Docker.

## EC2 Setup

On Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and back in after adding the Docker group.

## Deploy

```bash
git clone <your-repo-url> agriscan-pro
cd agriscan-pro
cp .env.ec2.example .env.ec2
nano .env.ec2
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build
```

Check health:

```bash
curl http://localhost/health/
```

Expected shape:

```json
{"status":"ok","database":{"status":"ok"},"redis":{"status":"skipped"},"tasks":{"mode":"sync"}}
```

Create an admin user:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec backend python manage.py createsuperuser
```

## Operations

### GitHub Actions deployment

The main CI workflow deploys the exact tested commit through SSM. Configure:

```text
AWS_BACKEND_DEPLOY_ROLE_ARN=<GitHub OIDC deployment role ARN>
AWS_REGION=ap-southeast-7
PRODUCTION_INSTANCE_ID=<production EC2 instance ID>
BACKEND_HEALTH_URL=http://<ec2-public-ip>/health/
```

The GitHub deployment role must be allowed to call `ssm:SendCommand` for only
the production instance and the `AWS-RunShellScript` document, plus
`ssm:GetCommandInvocation`. The EC2 instance must be online in Systems Manager,
and the `ubuntu` user must belong to the `docker` group.

The deployment fails rather than overwriting tracked changes on the instance.
It fast-forwards the EC2 checkout to the workflow commit, rebuilds the Compose
services, applies migrations, runs Django checks, and then verifies the public
health endpoint.

View logs:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml logs -f backend
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml logs -f db
```

Restart after config changes:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build
```

Generate a dashboard snapshot after the snapshot stack and `.env.ec2` are
configured:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec -T backend \
  python manage.py generate_dashboard_snapshot --dry-run
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec -T backend \
  python manage.py generate_dashboard_snapshot
```

Backup PostgreSQL:

```bash
mkdir -p backups
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backups/agriscan-$(date +%F-%H%M).sql
```

Restore PostgreSQL:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backups/<backup-file>.sql
```

## Important Notes

- Keep `.env.ec2` only on the EC2 instance.
- Use EBS snapshots or scheduled `pg_dump` backups.
- If you later expose this beyond internal users, put HTTPS in front of it and
  set `JWT_REFRESH_COOKIE_SECURE=True`.
- S3 direct-upload endpoints still require `AWS_STORAGE_BUCKET_NAME`. Regular
  multipart imports work through the backend.
