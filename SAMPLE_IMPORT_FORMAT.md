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
- **DON** - Deoxynivalenol (Threshold: 1000 ppb)
- **AFB1** - Aflatoxin B1 (Threshold: 5 ppb)
- **FB1** - Fumonisin B1 (Threshold: 2000 ppb)
- **T-2** - T-2 Toxin (Threshold: 100 ppb)
- **ZEA** - Zearalenone (Threshold: 200 ppb)
- **OTA** - Ochratoxin A (Threshold: 5 ppb)

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

- **`<LOD` values**: Treated as not detected (ignored in results)
- **`#VALUE!` errors**: Automatically filtered out
- **Empty/missing fields**: Defaults applied:
  - purpose: routine
  - sample_type: field
  - processing_type: raw
  - collected_by: Research Data Import
- **Metals/minerals data**: Automatically filtered
- **Duplicate detection**: Not currently available

### Supported File Formats:
- CSV (.csv)
- Excel (.xlsx)
- Excel (.xls)
