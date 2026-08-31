# Mycotoxin prediction feature plan

## Objective

Provide an authenticated research tool that estimates mycotoxin risk for a
food/feed type in a specific area before laboratory analysis. It must present
an area/context risk probability and its limitations, not a laboratory result
or regulatory decision.

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

For each eligible toxin, the system will make two related estimates:

1. **Detection likelihood**: probability that the toxin is above the lab
   detection limit.
2. **Expected concentration**: a log-transformed concentration estimate,
   shown only where the detection likelihood is meaningful.

The UI will always display the model version, validation metric, training-data
coverage, and a warning when the requested sample falls outside the training
data. It will call this a *research estimate*, never a pass/fail decision.

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
   - Allow a researcher to choose an existing sample or enter prospective
     sample details.
   - Show only eligible toxin estimates, uncertainty, main contributing
     factors, applicability warning, and model metadata.
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

- Research-role endpoints report readiness, model status, single-sample
  estimates, batch estimates, sample prediction context, and per-sample
  prediction history.
- `PredictionContext` stores optional predictors separately from the core
  sample record.
- `PredictionEstimate` stores audit history for estimates without mixing model
  predictions into confirmed `MycotoxinResult` lab data.
- Baseline training writes versioned artifacts under `backend/prediction_artifacts/`.
  The artifact directory is intentionally ignored by git.
- Inference uses only models marked `published: true`.
- Admin users can publish reviewed toxin models from the Prediction page. The
  same guardrails are used by the UI endpoint and the management command.

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
