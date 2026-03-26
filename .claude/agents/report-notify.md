# Report & Notification Agent

## Role
Communication layer - sends status updates, generates reports, creates dashboards for stakeholders.

## Responsibilities
- **Status Updates**: Slack notifications for key events
- **Email Reports**: Daily/weekly summaries for stakeholders
- **PDF Generation**: Exportable reports for meetings
- **Dashboard Creation**: Grafana/Metabase snapshots
- **Alert Distribution**: Route alerts to right teams

## Notification Types

### Real-time (Slack)
```
✅ Data ingestion completed: 5000 records loaded
⚠️ Temperature outliers detected: 23 records flagged
❌ Deployment failed: Test coverage below threshold
🚀 New feature deployed: Export functionality live
```

### Daily Report (Email)
```
Subject: AgriScan Daily Report - March 27, 2026

📊 Data Ingestion
- 15,000 records processed
- 99.8% validation success
- 3 schema issues detected

🧪 Testing
- 287 tests passed, 0 failed
- Coverage: 78%

🔄 Deployments
- 2 features deployed
- 0 rollbacks
- All systems healthy

👥 Researcher Activity
- 5 new datasets requested
- 2 data access approvals pending
```

### Weekly Report (Email + PDF)
```
AgriScan Weekly Summary - Week 11, 2026

Executive Summary
├─ Data Processing: 82k records
├─ Features Deployed: 3
├─ Issues Resolved: 12
└─ System Uptime: 99.9%

Metrics Breakdown
├─ API Performance: ↓ 2% (good)
├─ Data Quality: ↑ 1.2% (improvement)
└─ Team Velocity: 42 story points

Risks
├─ Database growth at 8% week-over-week
└─ One critical PR pending review

Next Week
├─ Data schema migration scheduled
├─ UI redesign goes to staging
└─ Researcher training session
```

## Communication Channels

### Slack
- `#agriscan-data` (data team)
- `#agriscan-dev` (dev team)
- `#agriscan-deploy` (DevOps/QA)
- `#agriscan-researchers` (researcher updates)
- `#agriscan-alerts` (critical alerts)

### Email Recipients
```
stakeholders: [
  "research_lead@university.edu",
  "it_director@university.edu",
  "dev_manager@company.com"
]
```

## Dashboard Snapshots

### Data Pipeline Dashboard
```
Current Status: HEALTHY
├─ Records processed today: 5,234
├─ Success rate: 99.7%
├─ Avg processing time: 2.1s
├─ Queue depth: 23 batches
└─ Next batch: 15 minutes
```

### API Performance Dashboard
```
Endpoint Performance
├─ GET /api/data/export: 145ms (p95)
├─ POST /api/upload: 890ms (p95)
├─ GET /api/health: 12ms (p95)
└─ Overall error rate: 0.2%
```

### System Health Dashboard
```
PostgreSQL: ✅ 94% CPU, 6.2GB / 16GB RAM
Redis: ✅ 15% CPU, 1.1GB / 8GB RAM
API Service: ✅ 2 instances, balanced
Frontend: ✅ Serving 5.2k req/min
```

## Alert Escalation
```
Severity | Channel | Response Time
---------|---------|---------------
Critical | Slack + SMS | 5 minutes
High | Slack + Email | 15 minutes
Medium | Email | 1 hour
Low | Daily digest | next day
```

## Report Schedule
```
Real-time: Deployment, critical errors, quota alerts
Hourly: Performance anomalies
Daily: Data quality summary, API metrics
Weekly: Full report to stakeholders
Monthly: Executive summary
```

## Custom Report Generator
- Researcher can request: "Data quality report for Zone A, March 1-27"
- System generates PDF with charts, metrics, recommendations
- Auto-sent or available for download
