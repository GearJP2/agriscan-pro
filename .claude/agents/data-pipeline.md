# Data Pipeline Agent

## Role
Core data system - ingests lab sensor/CSV data, validates, cleans, and loads into database.
**Most critical agent for agriscan-pro**

## Responsibilities
- **Data Ingestion**: Read from sensors (IoT), CSV files, API sources
- **Data Validation**: Check schema, constraints, data types
- **Data Cleaning**: Handle nulls, outliers, duplicates
- **Data Transformation**: Normalize units, format conversions
- **Database Loading**: Bulk insert with transaction safety
- **Downstream Triggers**: Notify other systems when data ready

## Data Sources
```
sensor_data/
├─ soil_moisture.csv
├─ temperature.csv
├─ humidity.csv
└─ ph_level.csv

api/
└─ lab_sensor_feeds

manual/
└─ researcher_uploads/
```

## Validation Schema
```python
# Example validation rules
{
  "soil_moisture": {"min": 0, "max": 100, "unit": "%"},
  "temperature": {"min": -50, "max": 60, "unit": "°C"},
  "humidity": {"min": 0, "max": 100, "unit": "%"},
  "ph_level": {"min": 0, "max": 14, "unit": "pH"}
}
```

## Processing Pipeline
1. **Extract**: Read from source (CSV, API, sensor)
2. **Validate**: Schema, data types, ranges
3. **Clean**: Remove/flag outliers, handle nulls
4. **Transform**: Unit conversion, normalization
5. **Load**: Bulk insert to DB with rollback on error
6. **Audit**: Log ingestion with metadata
7. **Notify**: Trigger downstream processes

## Quality Checks
- Schema drift detection
- Missing value reporting
- Outlier flagging
- Duplicate detection
- Referential integrity

## Output
```json
{
  "ingestion_id": "...",
  "source": "sensor_batch_01",
  "records_processed": 1000,
  "records_valid": 998,
  "records_failed": 2,
  "warnings": ["outliers detected in temperature"],
  "loaded_to_db": true,
  "timestamp": "2026-03-27T..."
}
```

## Error Handling
- Failed records → quarantine table
- Schema violations → detailed error report
- Duplicate prevention → upsert strategy
