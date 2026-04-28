# Sample Import Formats

## Using the Import Button

Click the **"Import Samples"** button in the Sample List to import your data. The unified import tool works with both simple sample lists and complex research data with mycotoxin results.

---

## Standard Format (Simple Sample List)

Your import file should have the following columns (column names are flexible with aliases):

### Required Columns:
- **region** (aliases: regions) - Geographic region
- **province** - Province/State name
- **district** - District name  
- **vegetation_variety** (aliases: variety, varieties, crops) - Crop/plant variety

### Optional Columns:
- **collection_date** (aliases: date, crop_year, year) - Date in format YYYY-MM-DD or D/M/YYYY
- **purpose** - routine, complaint driven, target surveillance
- **sample_type** - field, market, storage, export
- **processing_type** - raw, dried, milled, processed, fermented
- **collected_by** (aliases: collector) - Name of person who collected sample
- **additional_info** (aliases: notes, sample_name) - Any additional information

### Example CSV:
```csv
province,district,vegetation_variety,collection_date,purpose,sample_type
Northeastern,Nongkhai,Wheat,2026-03-09,routine,field
Central,Bangkok,Rice,2026-03-08,target surveillance,market
Southern,Songkhla,Corn,03/09/2026,complaint driven,storage
```

---

## Research Data Format (With Mycotoxin Results)

For research datasets with mycotoxin test results, the same **"Import Samples"** button automatically detects and imports them.

Imported mycotoxin results are stored with the canonical backend fields:

- **toxin_type** - Canonical toxin code such as `AFB1`, `DON`, or `OTA`
- **value** - Lab concentration value
- **unit** - Canonical unit is `ug_kg`
- **risk_level** - Calculated by the backend as `safe`, `detected`, `high`, `critical`, or `unclassified`
- **eu_threshold_low / eu_threshold_high** - Threshold snapshot captured when the result is saved
- **notes** - Import context such as the source CSV column

### Supported Columns:

#### Sample Information:
- **Regions** - Geographic region
- **Provinces** - Province name
- **Districts** - District name
- **Crops** / **Varieties** - Vegetation variety
- **Processing type** - raw, dried, milled, processed, fermented
- **Sample names** - Sample identifier
- **Positive/Negative** - Test result status

#### Mycotoxin Results (Auto-Detected):
The system automatically detects and imports these mycotoxins:

| Header / Code | Label | EU Low | EU High | Notes |
|---------------|-------|--------|---------|-------|
| **AFB1** | Aflatoxin B1 | 5 ug/kg | 20 ug/kg | EU maximum level |
| **DON** | Deoxynivalenol | 900 ug/kg | 8000 ug/kg | EU guidance value |
| **FB1** | Fumonisin B1 | 0 ug/kg | 0 ug/kg | Adjusted to 0 for strict surveillance |
| **ZEA** | Zearalenone | 100 ug/kg | 2000 ug/kg | EU guidance value |
| **OTA** | Ochratoxin A | 50 ug/kg | 250 ug/kg | EU guidance value |
| **T-2** | T-2 Toxin | N/A | N/A | Flagged: no supported threshold in the selected source table |
| **AFG1** | Aflatoxin G1 | N/A | N/A | Flagged: no supported threshold in the selected source table |
| **AFG2** | Aflatoxin G2 | N/A | N/A | Flagged: no supported threshold in the selected source table |
| **AFM1** | Aflatoxin M1 | N/A | N/A | Flagged: no supported threshold in the selected source table |

Unknown legacy toxin names are migrated as **UNKNOWN** and marked `unclassified` for operator review.

#### Auto-Ignored Columns:
The system automatically ignores:
- Metals and minerals data (Mg, Al, P, K, etc.)
- Isotope ratios (δ13C, δ15N, δ18O)
- Invalid values (#VALUE!, NA, <LOD), etc.)

### Example Research Data:
```csv
Regions,Crops,Processing type,Varieties,Provinces,Districts,Sample names,DON,AFB1,FB1,T-2,ZEA,OTA,Mg,Al,P,...
Esan,2022,White rice,Thai Hom mali,Mukdahan,Muang,TINT1,<LOD,<LOD,<LOD,<LOD,<LOD,<LOD,513.58,#VALUE!,1986.63,...
Esan,2022,White rice,Thai Hom mali,Mukdahan,Muang,TINT2,150,2.5,<LOD,<LOD,25,1.5,612.42,#VALUE!,2358.64,...
```

### How to Use:

1. Click **"Import Samples"** button in the Sample List
2. Upload your CSV or Excel file
3. Review the preview:
   - **Summary tab**: Shows total samples, samples with results, total results count
   - **Details tab**: Shows parsed sample locations, varieties, and detected mycotoxin results
4. Click **"Import N Samples"** to add all samples with their test results
5. All samples appear in the list with Status and risk indicators

### Data Handling:

- **`<LOD`, `ND`, `BDL`, `LOD`, `N/A`, `-` values**: Imported as `0.0`, which calculates as `safe` for toxins with threshold data
- **`#VALUE!` errors**: Automatically skipped
- **Empty/missing fields**: Defaults applied:
  - purpose: routine
  - sample_type: field
  - processing_type: raw
  - collected_by: Research Data Import
- **Metals/minerals data**: Automatically filtered
- **Duplicate result rows**: Existing `(sample, toxin_type)` rows are updated instead of duplicated
- **Sample ID normalization**: IDs with missing leading zeros can still match existing samples
- **Import response keys**: `rows_processed`, `matched_samples`, `results_created`, `results_updated`, `skipped_rows`, `unmatched_sample_ids`, `failed_rows`
- **Row-level failures**: `failed_rows` reports rows that failed after parsing while preserving successfully imported rows

### Supported File Formats:
- CSV (.csv)
- Excel (.xlsx)
- Excel (.xls)

---

## Related Review Follow-ups

These items are tracked in **CODE_REVIEW.md** and are associated with this import/API format:

- [x] **MR-M4** - Per-row savepoints and row-level `failed_rows` reporting for large CSV imports.
- [x] **MR-M5** - Frontend `MycotoxinForm` submits canonical fields and no longer exposes dropped fields.
- [x] **MR-MN2** - Transitional `method: null` serializer alias is documented as deprecated.
- [x] **MR-MN6** - Migration tests cover `UNKNOWN` mapping and duplicate deduplication.
- [x] **Nice-to-have** - React Query cleanup completed for `frontend/src/features/users/components/UserManagement.tsx`.
