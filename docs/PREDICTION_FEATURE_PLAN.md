# Mycotoxin prediction feature plan

## Objective

Provide an authenticated research tool that helps researchers prioritize where
and what to sample next for mycotoxin surveillance. The main workflow is a
sampling recommendation system, not a complete toxin-screening tool. It must
present model estimates and historical signals with their limitations, not a
laboratory result or regulatory decision.

The design is informed by *Predicting Mycotoxin Contamination in Irish Oats
Using Deep and Transfer Learning* (Inglis et al., 2025), while being adapted
to the data Agriscan has today.

## What the current data can support

`Dashboard - Results.csv` contains 548 rows. It is valuable historical
outcome data, but it is not yet equivalent to the Irish oats study:

| Data item | Current import | Irish oats study |
| --- | --- | --- |
| Samples | 548 rows | About 300 samples |
| Sample material | Food/feed, mostly white and brown rice | Oats |
| Location | Province-level; 83 rows blank | Farm latitude/longitude |
| Date | 282 supplied collection dates; others infer a date from the lab ID | Harvest date |
| Lab outcomes | 39 toxin columns; blank cells recorded as below LOD | 24 selected toxins, with below-LOQ and unmeasured results distinguished |
| Predictors | Food/feed type, subtype, province, collection date | Weather, soil, crop, management, geography and harvest data |

The positive measurements are sparse (the largest single toxin has 68
positives). A v0 model must therefore train only on a toxin with sufficient
positive observations and complete predictor coverage. It must not pretend a
blank or inferred value is richer evidence than it is.

## Prediction contract

For each eligible, reviewed, and published toxin model, the system can make two
related estimates:

1. **Detection likelihood**: probability that the toxin is above the lab
   detection limit.
2. **Expected concentration**: a log-transformed concentration estimate,
   shown only where the detection likelihood is meaningful.

The UI will always display the model version and a warning that the result is
research prioritization guidance. Technical model metrics and training-data
coverage are shown only to admin/head-researcher users, not to standard
researchers. The system calls predictions *research estimates*, never pass/fail
decisions.

## Input features, in delivery order

### V0: use data already available

- food/feed type and subtype
- province (mapped to a documented provincial centroid when exact coordinates
  are unavailable)
- collection date, with calendar season encoded as sine/cosine values
- 90 days of historical NASA POWER weather before the collection date:
  temperature, relative humidity, precipitation and soil temperature

Because collection date is not necessarily harvest date, v0 will label its
weather feature window as **pre-collection weather**. It must not be presented
as pre-harvest weather.

### V1: capture optional sample context going forward

Add a structured `PredictionContext` record linked to a sample. These fields
will be optional, so registration remains quick:

- exact latitude/longitude and whether location is farm, market or storage
- harvest date and sowing date
- crop variety, crop season and storage duration
- moisture, soil type and soil pH
- crop rotation, fertiliser and fungicide details

These are the high-value predictors used in the paper. When present, exact
coordinates and harvest date replace province-centroid/pre-collection
approximations.

## Lab-result handling

- `value = 0` and `is_below_lod = true` means an observed result below the
  detection limit. It is a valid negative class label.
- A future importer must represent an unmeasured toxin separately; it must not
  convert it to below LOD. Unmeasured outcomes are excluded only for that
  toxin's training target.
- Concentration training uses `log1p(value)`. Detection training uses
  `value > 0`.
- The imported CSV is retained as the source data; results continue to upsert
  by sample ID, so future re-exports update the same training records.

## Model and validation strategy

1. Build a repeatable training dataset from `Sample`, `MycotoxinResult`, and
   cached historical weather. Persist the exact feature schema and source
   sample IDs for every model version.
2. Select only toxins satisfying minimum data rules: at least 30 detected,
   30 below-LOD observations, and acceptable date/location coverage. The
   actual thresholds and counts are returned in a data-readiness report.
3. Start with an explainable regularised tabular baseline, not a neural network.
   With this dataset size and sparse labels, a calibrated logistic regression
   for detection plus a regularised regression model for detected
   concentrations is safer than an MLP/transformer.
4. Validate using grouped splits by province and date where possible. Never
   randomly split duplicate or near-identical location/time records across
   train and test sets. Report ROC-AUC, F1, precision/recall, calibration and
   regression MAE/RMSE per toxin.
5. Compare the baseline with TabPFN only after the baseline and its grouped
   validation are stable. The paper found TabPFN strong on small tabular data,
   but that is not a reason to skip validation on Thai food/feed data.

No model is published unless it clears the data rules and its held-out results
beat a prevalence-only baseline. Otherwise the feature reports that more
labelled samples are needed.

## Delivery phases

1. **Data readiness and schema**
   - Add a research-role endpoint and page showing each toxin's measured,
     below-LOD, detected, dated and located counts.
   - Add the optional `PredictionContext` model and historical-weather cache.
2. **V0 training pipeline**
   - Add a management command to build the feature set, train eligible toxin
     models, validate them, and store versioned model metadata/artifacts.
3. **Research prediction page**
   - Prioritize future sampling targets from historical food/feed, location,
     mycotoxin-result, and weather context.
   - Split recommendations into area-specific targets and national signals
     from incomplete location data.
   - Keep registered-sample estimates and model diagnostics as advanced
     admin/head-researcher views.
4. **V1 richer predictors and retraining**
   - Capture harvest/agronomic fields during registration.
   - Re-train only on approval, with an audit record and comparison to the
     previously published model.

## First implementation decision

The first deliverable will be the data-readiness endpoint/page and optional
prediction-context schema. It makes the existing data immediately visible and
sets the guardrails for training, without producing an unreliable prediction
from sparse labels.

## Current implementation notes

The first baseline implementation is now in place:

- Research-role endpoints support readiness, model status, single-sample
  estimates, batch estimates, sample prediction context, per-sample prediction
  history, and sampling recommendations.
- `PredictionContext` stores optional predictors separately from the core
  sample record.
- `PredictionEstimate` stores audit history for estimates without mixing model
  predictions into confirmed `MycotoxinResult` lab data.
- Baseline training writes versioned artifacts under `backend/prediction_artifacts/`.
  The artifact directory is intentionally ignored by git.
- Inference uses only models marked `published: true`.
- Admin users can publish reviewed toxin models from the Prediction page. The
  same guardrails are used by the UI endpoint and the management command.
- Standard researcher users see the operational sampling-recommendation
  workflow. Admin/head-researcher users see model diagnostics and advanced
  registered-sample estimate tools. Only admins can publish models.

## Current ML pipeline

The prediction system is classical machine learning plus deterministic scoring.
It does **not** use an LLM to make prediction or recommendation decisions.

```text
Imported sample/lab data
        ↓
Django training dataset builder
        ↓
Feature engineering
        ↓
Eligibility guardrails per toxin
        ↓
Train one detection model and one concentration model per eligible toxin
        ↓
Inspect model metrics and skipped toxin targets
        ↓
Admin publishes reviewed toxin models
        ↓
Researcher sampling recommendation API uses published models only
        ↓
Frontend shows area-specific targets and national incomplete-location signals
```

### 1. Source data

The training data comes from Django records:

- `Sample`: food/feed type, subtype, region, province, district, collection
  date, purpose, sample type, processing type, and optional registered context.
- `MycotoxinResult`: toxin code, concentration value, unit, risk level, and
  below-LOD flag.
- `ExternalDataCache` / NASA POWER service: optional 90-day weather summaries
  before the target date.

The importer upserts future mycotoxin results by sample ID and toxin code. This
means if a sample is registered in the system first and results are imported
later, the imported result updates the matching sample record instead of
creating a disconnected training row.

Empty cells in the provided mycotoxin CSV are recorded as below LOD for that
given historical dataset. Future importers should distinguish truly unmeasured
toxins from below-LOD observed toxins when that information is available.

### 2. Feature engineering

`PredictionDatasetService` converts each sample/result pair into tabular model
features:

- food/feed type and subtype
- commodity name
- region, province, and district
- collection month, quarter, and Thai season
- purpose, sample type, and processing type
- optional prediction context such as coordinates, harvest/sowing dates,
  storage duration, moisture, soil, crop rotation, fertiliser, and fungicide
  details
- optional weather features:
  - 90-day mean temperature
  - 90-day mean humidity
  - 90-day total precipitation
  - 90-day mean soil temperature
  - weather observation count
  - weather location label

Weather features are deterministic summaries. If exact coordinates are missing,
the service falls back to the best available location, currently province or
Thailand centroid depending on data quality.

### 3. Training

`train_prediction_models` trains one pair of models per eligible toxin:

- detection model: scaled logistic regression
- concentration model: scaled ridge regression on `log1p(value)`

The current model family is:

```text
scaled_logistic_regression_detection_plus_scaled_ridge_concentration
```

Training creates versioned artifacts under:

```text
backend/prediction_artifacts/<model-version>/
```

The artifact directory is ignored by git because artifacts are generated
runtime outputs, not source code.

### 4. Eligibility guardrails

Each toxin is evaluated independently before training. A toxin can be skipped
when it does not have enough usable data, for example:

- too few detected rows
- too few below-LOD/zero rows
- insufficient usable context
- failed metric guardrails

This is why not every mycotoxin appears in predictions. Absence from prediction
results means "no reviewed published model is available", not "no risk exists".

At the current checkpoint, the published model is mainly useful for
`Tryptophol (TRY)`. Other toxins may be trained or skipped depending on data
balance and review decisions.

### 5. Inspection and publishing

Admins/head researchers inspect models with:

```bash
python manage.py inspect_prediction_models --model-version <version> --show-skipped
```

Admins publish reviewed models with:

```bash
python manage.py publish_prediction_models --model-version <version> --toxins <approved-toxins>
```

Publishing is required because researcher-facing inference loads only models
marked `published: true`. This prevents low-quality or unreviewed models from
appearing in operational recommendations.

### 6. Inference

`PredictionInferenceService.estimate()` loads the latest published metadata and
uses only published toxin models. For each published toxin model it returns:

- toxin code and label
- detection probability
- risk band
- estimated concentration, where applicable
- model version and model family
- feature provenance
- warning text

This estimate is an intermediate building block. It is not the primary
researcher workflow anymore.

### 7. Sampling recommendations

`PredictionInferenceService.recommend_sampling()` is the primary researcher
workflow. It builds candidate food/feed-location groups from historical samples,
runs the published model on each candidate, then calculates a deterministic
surveillance priority score.

Priority score:

```text
priority score =
  50% published model detection probability
+ 35% historical detection rate for the same toxin/food-feed/location group
+ 10% historical sample-volume confidence
+  5% weather availability bonus
```

Each recommendation includes a `scoreBreakdown` object showing the exact
contribution from each component. The frontend explanation panel uses fixed
template phrases filled with these computed values. No LLM writes or decides
the recommendation.

The API separates recommendations into:

- `areaSpecificRecommendations`: rows with usable province/district context.
  These answer "where should researchers test next?"
- `nationalSurveillanceSignals`: rows where historical signal exists but the
  imported location is incomplete, shown as `Unspecified area`. These answer
  "what sample type looks important nationally, but location records need
  improvement?"

The request supports recommendation modes:

- `all`
- `area_specific`
- `national_signal`

### 8. Current UI access model

- `researcher`: operational sampling recommendations and cautious published
  model estimate only.
- `head_researcher`: researcher workflows plus model diagnostics and advanced
  registered-sample estimate tools.
- `admin`: all head-researcher views plus model publishing and top-right
  role-viewpoint preview.

The admin role preview is frontend-only. It helps admins inspect how the page
looks to different roles without changing the real backend account role.

Operational command flow:

```bash
python manage.py migrate
python manage.py build_prediction_dataset --include-weather --output prediction_dataset.csv
python manage.py train_prediction_models --include-weather
python manage.py inspect_prediction_models --show-skipped
python manage.py publish_prediction_models --model-version <version> --toxins <approved-toxins>
```

`publish_prediction_models` enforces metric guardrails by default
(`--min-f1 0.50`, `--min-roc-auc 0.60` when ROC-AUC exists). Use `--force`
only when a researcher intentionally approves publishing a lower-metric model.
