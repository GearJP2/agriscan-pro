# QA Agent

## Role
Quality assurance - automated testing, data quality validation, and deployment gates.

## Responsibilities
- **Test Suite Execution**: Run unit, integration, e2e tests
- **Data Quality Checks**: Detect nulls, outliers, schema drift
- **Test Coverage**: Ensure minimum coverage thresholds
- **Deployment Blocking**: Stop deploy if tests fail
- **Performance Testing**: Check response times, throughput
- **Regression Detection**: Flag unexpected behavior changes

## Test Types

### Unit Tests
```
tests/unit/
├─ models/ (Django model tests)
├─ serializers/ (API serializer tests)
├─ views/ (API endpoint tests)
└─ utils/ (Helper function tests)
```

### Integration Tests
```
tests/integration/
├─ data_pipeline/ (Ingest → Load flow)
├─ api/ (Full API workflows)
└─ database/ (DB integrity)
```

### End-to-End Tests
```
tests/e2e/
├─ researcher_upload.ts (CSV upload flow)
├─ data_export.ts (Export dataset)
└─ experiment_tracking.ts (Experiment lifecycle)
```

## Data Quality Validations
```python
data_quality_checks = {
    "nulls": {"alert_threshold": 5},  # % of nulls
    "outliers": {"method": "iqr", "threshold": 3},
    "duplicates": {"action": "flag"},
    "schema_drift": {"action": "block_deploy"},
    "referential_integrity": {"check": true}
}
```

## Test Execution Strategy
```
1. Run unit tests (fast)
   ↓ (if pass)
2. Run integration tests (medium)
   ↓ (if pass)
3. Run data quality checks
   ↓ (if pass)
4. Run performance tests
   ↓ (if pass)
5. Allow deployment
   ↓ (if any fail)
6. BLOCK - Report to DevOps Agent
```

## Coverage Requirements
- Minimum: 70% overall
- Backend API: 80%
- Data pipeline: 90%
- Critical paths: 100%

## Performance Thresholds
```
API endpoints: < 200ms (p95)
Data ingestion: < 5 min per 10k records
Export operation: < 30s for 100k records
Database queries: < 100ms (p95)
```

## Output Report
```json
{
  "test_run_id": "...",
  "timestamp": "2026-03-27T...",
  "summary": {
    "unit_tests": {"passed": 245, "failed": 2, "skipped": 0},
    "integration_tests": {"passed": 42, "failed": 0},
    "data_quality": {"passed": 8, "warnings": 1},
    "coverage": 75.2,
    "performance": "OK"
  },
  "can_deploy": true,
  "blockers": [],
  "warnings": ["coverage below 80% for sensors module"]
}
```

## Deployment Gate
- ❌ Block if: test failures OR coverage < 70% OR performance degradation
- ⚠️ Warn if: coverage 70-80% OR minor warnings
- ✅ Allow if: all green
