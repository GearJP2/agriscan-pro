# Prediction dataset EDA

This folder contains exploratory data analysis for the prediction feature.

The goal is to inspect the training data **before model training** so we can
explain what the dataset can support and where the current limitations are.

## What this EDA answers

- How many sample records and toxin-result rows are available?
- Which mycotoxins have enough detected examples?
- Which toxins are mostly below LOD / zero?
- What percentage of each toxin is below LOD / zero / imported empty?
- What is the positive concentration distribution for each mycotoxin?
- Which food/feed commodities appear most often?
- Which commodities have the highest historical detection rate?
- Which provinces show contamination concentration signals for each toxin?
- How much usable area/location context exists?
- How much weather context is available?
- What collection-year/month trends exist?

## Input

Default input:

```text
backend/prediction_dataset.csv
```

If this file does not exist, generate it first:

```bash
docker compose exec backend python manage.py build_prediction_dataset --include-weather --output prediction_dataset.csv
```

That command writes the file inside the backend container path. If needed,
copy/export it to:

```text
backend/prediction_dataset.csv
```

You can also pass any CSV path:

```bash
python EDA/prediction_eda.py --input path/to/prediction_dataset.csv
```

## Run

Dependency-free SVG/CSV EDA:

From the repository root:

```bash
python EDA/prediction_eda.py
```

Outputs are written to:

```text
EDA/output/
```

Presentation-grade pandas/numpy/matplotlib EDA:

```bash
python -m pip install -r EDA/requirements.txt
python EDA/prediction_eda_matplotlib.py
```

Matplotlib outputs are written to:

```text
EDA/graphs/
```

## Output files

- `eda_summary.md` — professor-readable summary.
- `toxin_detection_summary.csv` — measured/detected/below-LOD rows per toxin.
- `toxin_concentration_summary.csv` — per-toxin positive concentration distribution statistics.
- `toxin_spatial_concentration_summary.csv` — province-level detected count and concentration statistics by toxin.
- `toxin_spatial_detected_only_summary.csv` — province-level toxin concentration rows with at least one detection.
- `commodity_detection_summary.csv` — measured/detected rows per commodity.
- `province_detection_summary.csv` — measured/detected rows per province.
- `monthly_detection_summary.csv` — measured/detected rows by year/month.
- `top_toxin_detection_rates.svg` — toxin detection-rate plot.
- `top_toxin_below_lod_or_empty_rates.svg` — per-toxin below-LOD / zero / imported-empty percentage plot.
- `top_toxin_detected_counts.svg` — detected-row count plot.
- `top_toxin_mean_positive_concentrations.svg` — mean positive concentration plot.
- `top_commodity_detection_rates.svg` — commodity detection-rate plot.
- `monthly_detection_trend.svg` — collection-month trend plot.
- `context_coverage.svg` — usable-context/weather coverage plot.
- `concentration_distribution_by_toxin/*.svg` — individual mycotoxin positive-concentration histograms.
- `spatial_concentration_by_toxin/*.svg` — individual mycotoxin province-level concentration plots.

## Matplotlib graph files

The matplotlib workflow creates PNG graphs that are easier to use in slides:

- `graph_summary.md` — short graph-focused summary.
- `toxin_detection_missingness_summary.csv` — pandas summary of detection and below-LOD/imported-empty percentages.
- `toxin_positive_concentration_summary.csv` — pandas/numpy concentration statistics.
- `01_toxin_detected_counts.png` — detected rows by mycotoxin.
- `02_toxin_detection_percentage.png` — detection percentage by mycotoxin.
- `03_toxin_below_lod_zero_imported_empty_percentage.png` — missing/below-LOD percentage by mycotoxin.
- `04_toxin_mean_positive_concentration.png` — mean positive concentration by mycotoxin.
- `05_toxin_positive_concentration_boxplot.png` — positive concentration distribution by toxin.
- `06_commodity_detection_percentage.png` — commodity-level detection percentage.
- `07_monthly_detection_trend.png` — monthly detection trend.
- `08_data_coverage_overview.png` — detected, below-LOD, context, and weather coverage.
- `individual_toxin_concentration/*.png` — individual mycotoxin concentration histograms.
- `individual_toxin_spatial_concentration/*.png` — individual mycotoxin province concentration charts.

## How to explain this to professor

The EDA is the evidence layer before modeling.

Recommended explanation:

> Before training the model, we explored the imported historical data to check
> detection balance, below-LOD/imported-empty percentages, positive concentration
> distributions, commodity/location coverage, province-level concentration
> signals, seasonality, and weather availability. This showed that only a small
> number of toxins have enough detected examples for responsible model training,
> so the prediction feature is framed as sampling-priority recommendation instead
> of full safety prediction.

Important caution:

> High detection rate in EDA is a historical signal, not a prediction by itself.
> It helps decide whether the dataset is suitable for training and where
> researchers may want to investigate further.
