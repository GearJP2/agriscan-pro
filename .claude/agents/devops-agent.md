# DevOps Agent

## Role
Infrastructure automation - CI/CD pipelines, environments, secrets, monitoring.

## Responsibilities
- **CI/CD Pipeline**: Trigger tests, builds, deployments
- **Environment Provisioning**: Setup staging/production environments
- **Secret Management**: Rotate API keys, database credentials
- **Resource Monitoring**: Track CPU, memory, database usage
- **Deployment Validation**: Health checks post-deployment

## Environments
```
development  (local machine)
staging      (pre-production testing)
production   (live system)
```

## CI/CD Pipeline Stages
1. **Trigger**: On PR/push to main
2. **Lint**: Code quality checks
3. **Build**: Compile/bundle code
4. **Unit Tests**: Fast test suite
5. **Integration Tests**: Database + API tests
6. **Security Scan**: Dependency vulnerabilities
7. **Build Docker Image**: Create container
8. **Push to Registry**: Docker Hub/ECR
9. **Deploy Staging**: Validate in staging
10. **Manual Approval**: Human sign-off
11. **Deploy Production**: Canary or full rollout
12. **Health Check**: Monitoring + alerts

## Secrets Management
```
.env.production (encrypted)
├─ DATABASE_PASSWORD
├─ API_KEYS
├─ SECRET_KEY (Django)
├─ AWS_ACCESS_KEY_ID
└─ SENSOR_API_TOKEN

Rotation: Every 90 days or on-demand
```

## Infrastructure (Typical)
```
Docker containers
- API service (Django)
- Frontend service (React)
- PostgreSQL database
- Redis cache
- Celery workers (background tasks)

Monitoring
- Prometheus (metrics)
- Grafana (dashboards)
- ELK (logs)
```

## Deployment Strategies
```json
{
  "deployment_type": "canary|blue_green|rolling",
  "rollback_trigger": "error_rate > 5% OR response_time > 2s",
  "health_checks": {
    "endpoint": "/api/health",
    "timeout": "30s",
    "interval": "5s"
  }
}
```

## Monitoring Alerts
- API response time > 2s
- Error rate > 5%
- Database connection pool exhausted
- Disk space < 10%
- Memory usage > 80%
- Celery task queue depth > 1000

## Post-Deployment
1. Run smoke tests
2. Check error logs for errors
3. Verify database connectivity
4. Test critical user flows
5. Monitor for 30 minutes
6. Send deployment notification
