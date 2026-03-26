# Security & Monitoring Layer (Shared)

## Role
Not a standalone agent, but a security layer all agents use for access control, audit logging, and anomaly detection.

## Components

### 1. RBAC (Role-Based Access Control)
```json
{
  "roles": {
    "admin": {
      "permissions": ["read_all", "write_all", "delete_all", "user_mgmt"]
    },
    "researcher_lead": {
      "permissions": ["read_team_data", "write_team_data", "request_features"]
    },
    "researcher": {
      "permissions": ["read_own_data", "write_own_data", "export_data"]
    },
    "dev": {
      "permissions": ["read_codebase", "write_code", "review_pr", "deploy_staging"]
    },
    "devops": {
      "permissions": ["manage_infrastructure", "deploy_prod", "manage_secrets"]
    }
  }
}
```

### 2. Data Sensitivity Classification
```
Level 1 (Public): Published results, documentation
Level 2 (Internal): Research in progress, metrics
Level 3 (Restricted): Individual researcher data, experimental configs
Level 4 (Sensitive): Personal researcher info, institutional secrets
```

### 3. Audit Logging
Every agent action logged:
```json
{
  "timestamp": "2026-03-27T14:32:45Z",
  "agent": "Data Pipeline Agent",
  "action": "load_data",
  "resource": "sensor_batch_001",
  "user": "researcher_lead_rice@domain.com",
  "status": "success",
  "details": "5000 records loaded",
  "data_sensitivity": "Level 3"
}
```

### 4. Anomaly Detection
```
Alert if:
- User accesses unusual amounts of data
- Agent processes exceed time/resource limits
- Failed login attempts > 5
- Deployment outside normal hours
- Data export size > threshold
```

### 5. Encryption Standards
```
Data at Rest: AES-256
Data in Transit: TLS 1.3
Secrets Storage: Encrypted + key rotation every 90 days
Database Passwords: Separate per environment
API Tokens: Short-lived JWT (1 hour), rotate daily
```

### 6. Access Control per Agent

**Data Pipeline Agent**
- Can: Read sensor feeds, write to staging tables, access ingestion logs
- Cannot: Delete data, modify user accounts

**Dev Agent**
- Can: Read code, write code, run tests
- Cannot: Access production database, deploy without approval

**Research Collab Agent**
- Can: Read team data, process requests, send notifications
- Cannot: Access other teams' data, modify audit logs

**DevOps Agent**
- Can: Manage infrastructure, deploy, rotate secrets
- Cannot: Modify source code, delete production data

**QA Agent**
- Can: Run tests, access staging/test data
- Cannot: Deploy to production directly, modify code

**Report/Notify Agent**
- Can: Read metrics, generate reports, send notifications
- Cannot: Modify data, access raw research data

## Security Integration Points
```
Every Agent calls:
├─ check_permission(user, action, resource)
├─ log_audit(agent, action, resource, user)
├─ detect_anomaly(metrics)
└─ enforce_data_sensitivity(data_level)
```

## Incident Response
```
1. Anomaly detected → Alert Security team
2. Suspicious activity → Require MFA
3. Data breach → Rotate all secrets, notify users
4. Unauthorized access → Revoke credentials, audit logs
```

## Compliance
```
GDPR: User data can be exported/deleted
Data Residency: Must stay in specified region
Audit Trail: 2-year retention minimum
Consent: Researchers must approve data usage
```
