# Prediction model evaluation summary

- Model version: `v20260831170003`
- Created at: 2026-08-31T17:01:03.924826+00:00
- Model family: `scaled_logistic_regression_detection_plus_scaled_ridge_concentration`
- Include weather: True
- Fetch weather during training: True
- Train/test split: 80%/20%
- Logistic max iterations: 5000
- Preprocessing: DictVectorizer plus sparse-safe StandardScaler

## Trained model test metrics

| Toxin | State | Measured | Detected | Test rows | F1 | ROC-AUC | Precision | Recall | Accuracy |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FB1 | Unpublished | 512 | 52 | 103 | 0.5405 | 0.9237 | 0.3704 | 1.0000 | 0.8350 |
| TRY | Published | 512 | 35 | 103 | 0.9333 | 0.9993 | 0.8750 | 1.0000 | 0.9903 |

## Concentration regression test metrics

| Toxin | Test rows | MAE log1p | RMSE log1p |
|---|---:|---:|---:|
| FB1 | 11 | 0.6007 | 0.7299 |
| TRY | 7 | 0.3885 | 0.5671 |

## Target readiness

- Trained targets: 2
- Published targets: 1
- Skipped targets: 37

## Graph files

- `01_classification_test_metrics.png`
- `02_training_label_balance.png`
- `03_concentration_regression_error.png`
- `04_model_target_readiness.png`
- `05_skipped_target_data_balance.png`

## Why each model-improvement step was needed

| Step | Why it was needed | Model impact |
|---|---|---|
| Historical CSV import | The ML pipeline needs enough past sample/result records to learn contamination patterns. | Converts external lab history into usable training evidence. |
| Sample ID matching | Imported result rows must update the correct registered samples instead of creating disconnected data. | Keeps future export/import workflows consistent and prevents duplicate labels. |
| Empty toxin-cell handling | Empty toxin cells in the historical CSV were treated as below LOD / zero-equivalent rows based on the project rule. | Preserves complete negative examples needed for binary detection training. |
| Dataset builder | Raw Django records are not directly suitable for model training. | Produces one consistent row per sample-toxin target with labels and features. |
| Feature engineering | Mycotoxin occurrence depends on sample type, commodity, location, season, processing, storage, and environmental context. | Gives the model structured predictors instead of only toxin labels. |
| Weather features | Temperature, humidity, precipitation, and soil temperature can affect fungal growth and toxin formation. | Adds environmental signals for sampling-priority estimation when weather-trained artifacts are used. |
| Eligibility guardrails | Many toxins have too few detections or only negative examples. | Prevents training misleading models for targets without enough positive/negative evidence. |
| Logistic regression detection model | The first question is whether a toxin is likely detected or not. | Produces an interpretable detection probability for each published toxin. |
| Balanced class weights | The dataset is highly imbalanced: most rows are below LOD / zero. | Reduces majority-class bias so detected rows are not ignored. |
| Ridge concentration model | Researchers also need approximate concentration signal after detection. | Estimates concentration trend for positive rows, while remaining simpler than high-variance models. |
| `log1p` concentration target | Concentrations are skewed and can have large outliers. | Stabilizes regression by compressing extreme values. |
| Feature scaling | Numeric features use different units and ranges. | Improves optimization stability and prevents large-scale numeric features from dominating. |
| Increased logistic iterations | Earlier training showed convergence warnings. | Gives the optimizer enough iterations to settle more reliably. |
| Versioned artifacts | Model outputs must be reproducible and reviewable. | Stores each trained model version for inspection, publishing, rollback, and comparison. |
| Inspection command | Metrics must be reviewed before researcher use. | Makes trained/skipped targets and performance visible to admin/head researcher. |
| Admin publish step | Not every trained model should be active. | Exposes only reviewed models to researcher-facing recommendations. |
| Sampling recommendation scoring | Researchers need an operational decision: what and where to test next. | Combines model risk, historical detection signal, sample volume, and location completeness into a prioritization score. |
| Role separation | Researchers should not need low-level model diagnostics during routine use. | Keeps researcher UI focused while preserving technical controls for admins. |

## Interpretation

- `TRY` is the only currently published model.
- `FB1` was trained but kept unpublished because its F1/precision are weaker, despite high recall and ROC-AUC.
- Most toxin targets were skipped because the dataset has too few positive detections for responsible training.
- Concentration regression metrics should be treated cautiously because positive test rows are small.
