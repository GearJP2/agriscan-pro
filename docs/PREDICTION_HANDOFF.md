# Prediction feature handoff

This document summarizes the current prediction/recommendation work on the
`prediction-feature` branch.

## Current product intent

The feature is a research planning aid. Its main purpose is to help researchers
decide **where and what to sample next** for laboratory testing.

It must not be presented as:

- a complete mycotoxin screening system;
- a replacement for laboratory analysis;
- a safety/pass/fail decision;
- proof that a food/feed item is safe when a toxin is not predicted.

Recommended wording in the UI is:

- "sampling recommendation";
- "priority score";
- "model detection estimate";
- "area-specific target";
- "national surveillance signal".

Avoid broad wording such as "this area is safe" or "all toxin risk is covered".

## Current ML approach

No language model is used for prediction or recommendation decisions.

The implemented pipeline is classical ML plus deterministic scoring:

1. Import sample and lab-result records into Django.
2. Build model-ready rows from `Sample`, `MycotoxinResult`, optional
   `PredictionContext`, and optional cached weather data.
3. Engineer tabular predictors:
   - food/feed type;
   - sub-type / commodity;
   - region, province, district;
   - collection month, quarter, and Thailand season;
   - purpose, sample type, processing type;
   - optional coordinates and area/crop/storage/soil fields;
   - optional 90-day NASA POWER weather window.
4. Train one model pair per eligible toxin:
   - logistic regression for detection probability;
   - ridge regression for concentration estimate using `log1p(value)`.
5. Inspect metrics and skipped targets.
6. Admin publishes only reviewed toxin models.
7. Researcher recommendation workflow uses only published models.

Current model family:

```text
scaled_logistic_regression_detection_plus_scaled_ridge_concentration
```

Model artifacts are written under:

```text
backend/prediction_artifacts/<model-version>/
```

These artifacts are runtime/generated files and are ignored by git.

## Recommendation scoring

Sampling recommendations are ranked by a deterministic priority score:

```text
priority score =
  50% published model detection probability
  + 35% historical detection rate
  + 10% historical sample-volume confidence
  + 5% weather availability bonus
```

Each recommendation includes a score breakdown so users can see why it was
ranked. The explanation text is generated from fixed templates, not from an LLM.

The API separates output into:

- `areaSpecificRecommendations`: records with usable province/district context;
- `nationalSurveillanceSignals`: records where historical signal exists but
  source records do not contain usable location data.

This distinction is important. Area-specific rows answer "where should we test?"
National signal rows answer "what food/feed may deserve surveillance, but the
original location data is incomplete?"

## Current role split

Frontend behavior:

- `researcher`: sees the operational sampling recommendation workflow.
- `head_researcher`: sees researcher workflow plus diagnostics and advanced
  estimate tools.
- `admin`: sees head researcher tools plus model publishing and role-viewpoint
  preview.

Backend behavior:

- `prediction/recommendations/`: admin, head researcher, researcher.
- advanced estimate, registered sample estimate, batch estimate, prediction
  history, prediction context, model readiness, and model status: admin and head
  researcher.
- model publishing: admin only.

## Main commands

Run these from the repository root with Docker services running.

Check migrations:

```bash
docker compose exec backend python manage.py migrate
```

Build prediction dataset:

```bash
docker compose exec backend python manage.py build_prediction_dataset --include-weather --output prediction_dataset.csv
```

Train weather-aware models:

```bash
docker compose exec backend python manage.py train_prediction_models --include-weather
```

Inspect a model version:

```bash
docker compose exec backend python manage.py inspect_prediction_models --model-version <version> --show-skipped
```

Publish reviewed toxin models:

```bash
docker compose exec backend python manage.py publish_prediction_models --model-version <version> --toxins <comma-separated-toxins>
```

Run validation:

```bash
docker compose exec backend python manage.py test
cd frontend
npm run build
```

## Current known model limitation

With the imported dataset used during development, only a small number of toxin
targets met training guardrails. At the time of implementation, the useful
published target was mainly:

```text
TRY = Tryptophol
```

This is why the system must not claim full mycotoxin coverage. More positive
examples and stronger context data are needed before additional toxin models can
be responsibly published.

## Imported-data handling

The CSV importer upserts mycotoxin results by matching sample ID and toxin code.
This supports the future workflow where samples registered in the system can be
exported, filled with lab results, and imported back with matching IDs.

For the provided historical CSV, empty cells in mycotoxin columns were recorded
as below LOD / zero-equivalent values because that matched the requested import
behavior for this dataset.

For future lab import formats, consider separating:

- unmeasured toxin;
- measured below LOD;
- measured numeric concentration.

That distinction would improve model quality and reporting correctness.

## Untracked local files at handoff time

These files were intentionally left untracked:

```text
Dashboard - Results.csv
Dashboard.xlsx
Irish-oats_mycotoxin-predicting-model (1).pdf
backend/prediction_dataset.csv
docs/V2_UPGRADE_ARCHITECTURE.md
```

Recommended handling before merge:

- commit docs only if they are meant to be shared;
- do not commit generated `backend/prediction_dataset.csv` unless the team
  explicitly wants a checked-in training snapshot;
- keep raw spreadsheet/PDF files outside git or add them only if the repository
  is meant to store source research/reference files.

## Suggested pre-merge checklist

- Confirm backend tests pass in Docker.
- Confirm frontend build passes.
- Review researcher/head/admin screens manually in the browser.
- Confirm no generated artifacts or raw local data files are accidentally added.
- Merge `prediction-feature` into `frontend-coegfs-style` only after the role
  split and wording are accepted.
