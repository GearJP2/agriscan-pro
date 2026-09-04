# Prompt Presentation for NotebookLM

Use this prompt in NotebookLM to generate a professor-ready slide deck about the AgriScan Pro prediction feature.

## Prompt

Create a clear academic presentation slide deck about the **AgriScan Pro mycotoxin prediction and sampling recommendation feature**.

The audience is a professor reviewing the technical direction, data readiness, model choice, model evaluation, and scientific limitations of the system.

The presentation should explain the feature as a **research sampling-priority recommendation system**, not as a food safety decision system and not as a final laboratory result.

## Main message

The system started as a general prediction idea, but was refined into a safer research workflow:

> Use historical mycotoxin lab data, sample metadata, optional weather context, and model governance to help researchers decide what food/feed types and areas should be prioritized for future laboratory testing.

## Suggested slide structure

### Slide 1 — Title

Title:

```text
AgriScan Pro: Mycotoxin Sampling-Priority Prediction Feature
```

Subtitle:

```text
Historical data, weather context, and model governance for research surveillance planning
```

### Slide 2 — Problem

Explain:

- Mycotoxin testing resources are limited.
- Researchers need help deciding what sample types and areas should be tested next.
- Directly claiming food safety prediction would be scientifically too strong for the current dataset.
- Therefore, the feature is framed as surveillance and sampling prioritization.

### Slide 3 — Product scope clarification

Compare:

| Not the goal | Actual goal |
|---|---|
| Predict whether a food product is safe | Recommend what should be prioritized for laboratory testing |
| Replace laboratory analysis | Support research planning before lab testing |
| Make regulatory decisions | Provide surveillance-priority guidance |
| Expose every model output to researchers | Show only reviewed, published recommendations |

### Slide 4 — Data source and import workflow

Explain:

- Historical mycotoxin CSV data was imported into the system.
- Existing sample IDs are matched during import.
- Future workflow supports registering samples in the system, exporting CSV, filling lab results, then importing results back by sample ID.
- Empty mycotoxin cells in the provided CSV are treated as below LOD / zero-equivalent values based on the project rule.

### Slide 5 — Prediction dataset construction

Explain that raw Django database records are converted into model-ready rows.

Each row represents:

```text
one sample + one mycotoxin target
```

Core labels:

- `detected = 1` if concentration is greater than zero.
- `detected = 0` if below LOD / zero / imported empty.
- `concentration_ug_kg` for concentration estimation.
- `concentration_log1p` for stabilized regression target.

### Slide 6 — Feature engineering

Explain that the model uses structured tabular features:

- food/feed type
- sample subtype / commodity
- province and district
- collection month, quarter, and season
- purpose
- sample type
- processing type
- optional crop/storage/location context
- optional 90-day weather features

Explain why:

> Mycotoxin occurrence can depend on commodity, location, season, storage, processing, and environmental conditions.

### Slide 7 — Weather context

Explain:

- Weather is fetched from NASA POWER.
- For historical training samples, the weather window is the 90 days before the sample collection date.
- For recommendation, the weather window is the 90 days before the target planning/testing date.

Weather features include:

- mean temperature over 90 days
- mean relative humidity over 90 days
- total precipitation over 90 days
- mean soil temperature over 90 days
- number of observed days
- weather location label

Important limitation:

> NASA POWER usually provides historical weather coverage, but weather feature quality still depends on whether the sample date and location are specific enough. If collection dates are vague or province-only, the weather window is approximate.

### Slide 8 — Model choice

Explain the current baseline model family:

```text
scaled_logistic_regression_detection_plus_scaled_ridge_concentration
```

Detection model:

- Logistic regression
- Predicts probability that a toxin is detected.

Concentration model:

- Ridge regression
- Estimates concentration trend on positive concentration rows.

Why these models were chosen:

- Dataset is small.
- Positive detections are rare.
- Many toxin targets are imbalanced.
- Explainable baseline models are safer than complex models at this stage.
- Ridge regression is regularized linear regression, so it is more stable than ordinary linear regression when data is small and features are correlated.

### Slide 9 — Model configuration

Explain the configuration:

| Component | Configuration | Reason |
|---|---|---|
| Logistic regression | Binary detection model | Produces interpretable detection probability |
| Ridge regression | Concentration regression model | Stable regularized baseline |
| Class balancing | `class_weight="balanced"` | Reduces majority-class bias from many below-LOD rows |
| Scaling | `StandardScaler(with_mean=False)` | Stabilizes optimization with sparse one-hot encoded features |
| Encoding | `DictVectorizer` | Converts mixed categorical/numeric features into model matrix |
| Train/test split | 80/20 | Provides held-out test evaluation |
| Random state | fixed | Makes evaluation reproducible |
| Logistic max iterations | 5000 | Avoids convergence warnings |

### Slide 10 — Training guardrails

Explain:

- Not every toxin should be trained.
- A toxin must have enough measured rows, detected rows, below-LOD/zero rows, and usable context.
- This prevents unreliable models from being trained on one-sided or too-small data.

Current result:

- 39 mycotoxin targets checked.
- 2 targets trained.
- 37 targets skipped.
- 1 target published.

### Slide 11 — Evaluation result

Use this table:

| Toxin | Status | Measured rows | Detected rows | Test rows | F1 | ROC-AUC | Precision | Recall | Accuracy |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FB1 / Fumonisin B1 | Trained, unpublished | 512 | 52 | 103 | 0.5405 | 0.9237 | 0.3704 | 1.0000 | 0.8350 |
| TRY / Tryptophol | Trained, published | 512 | 35 | 103 | 0.9333 | 0.9993 | 0.8750 | 1.0000 | 0.9903 |

Interpretation:

- TRY performed strongly and was published.
- FB1 had high recall and ROC-AUC, but lower precision and F1, so it stayed unpublished.
- Most other toxins were skipped due to insufficient positive detections.

### Slide 12 — Concentration regression result

Use this table:

| Toxin | Positive test rows | MAE log1p | RMSE log1p |
|---|---:|---:|---:|
| FB1 | 11 | 0.6007 | 0.7299 |
| TRY | 7 | 0.3885 | 0.5671 |

Important interpretation:

> Concentration regression is exploratory because the number of positive test rows is small. It should be treated as an approximate signal, not a precise concentration prediction.

### Slide 13 — Recommendation scoring

Explain the surveillance priority score:

```text
priority score
= 0.50 × model detection probability
+ 0.35 × historical detection rate
+ 0.10 × historical sample-volume confidence
+ 0.05 × weather availability
```

Explain each part:

| Signal | Meaning |
|---|---|
| Model detection probability | Probability from the published ML model |
| Historical detection rate | Detected result count divided by measured result count |
| Historical sample-volume confidence | Log-scaled confidence from number of historical samples |
| Weather availability | Small bonus if weather-trained model has weather observations |

Clarify:

> The priority score is a ranking score, not a safety probability.

### Slide 14 — Example recommendation explanation

Use this example:

```text
Chicken feed in Unspecified area is ranked for TRY with a 70.9% surveillance priority score.
The published model estimates 54.5% detection risk.
Historical results show 11 detected results from 12 measured results, or 91.7%.
There are 12 historical samples.
Weather was included in the model.
```

Explain:

- 54.5% is the model detection probability.
- 91.7% is the historical detection rate.
- 70.9% is the final weighted surveillance-priority score.
- Because the area is unspecified, this should be treated as a national surveillance signal, not a province-specific target.

### Slide 15 — Model governance

Explain:

```text
Train candidate models
→ Inspect test metrics
→ Skip weak/data-poor targets
→ Admin publishes selected models
→ Researcher recommendations use only published models
```

Why:

- Prevents weak models from being exposed.
- Keeps researchers focused on operational recommendations.
- Keeps technical diagnostics and publishing tools under admin control.

### Slide 16 — Researcher vs admin view

Explain:

| Role | Main view |
|---|---|
| Researcher | Sampling recommendations and surveillance-priority outputs |
| Admin | Model status, metrics, skipped targets, publishing controls, diagnostics |

Reason:

> Researchers need actionable sampling guidance. Admins need technical model governance.

### Slide 17 — EDA outputs

Explain that exploratory data analysis was created before model training.

EDA includes:

- mycotoxin detection percentage
- below LOD / zero / imported-empty percentage
- concentration distribution
- commodity-level detection trends
- monthly detection trend
- spatial concentration by toxin
- Thailand province sample-count map
- model evaluation graphs

Suggested visuals to use:

- `EDA/graphs/02_toxin_detection_percentage.png`
- `EDA/graphs/03_toxin_below_lod_zero_imported_empty_percentage.png`
- `EDA/graphs/05_toxin_positive_concentration_boxplot.png`
- `EDA/graphs/09_thailand_sample_count_by_province_map.png`
- `EDA/model_evaluation_graphs/01_classification_test_metrics.png`
- `EDA/model_evaluation_graphs/04_model_target_readiness.png`

### Slide 18 — Current limitations

Explain:

- Dataset is small.
- Positive detections are rare.
- Many toxins cannot be responsibly trained yet.
- Concentration regression has very small positive test sets.
- Weather quality depends on date/location precision.
- Some historical rows have incomplete area information.
- Current weather scoring includes weather availability, but future improvement should compare current weather windows to historical positive weather windows.

### Slide 19 — Why not complex models yet?

Explain:

- The current system prioritized a reliable end-to-end pipeline first.
- Complex model benchmarking such as TabPFN, feedforward neural networks, random forest, or gradient boosting should be treated as an experimental next phase.
- The production-facing model should remain conservative until advanced models prove better under held-out testing and governance rules.

Suggested wording:

> We started with explainable baseline models because the dataset is small and imbalanced. Multi-model benchmarking is a planned experimental extension, but complex models should not be exposed to researchers unless they consistently outperform the baseline and pass governance checks.

### Slide 20 — Next work

Recommend these next steps:

1. Add experimental model benchmarking.
2. Compare logistic/ridge baseline against Random Forest, Gradient Boosting, TabPFN, and feedforward neural network.
3. Add PR-AUC and calibration metrics for imbalanced classification.
4. Improve weather scoring by comparing current 90-day weather windows against historical positive weather windows.
5. Add date/location precision flags.
6. Expand dataset with more positive detections.
7. Add exact Thailand province GeoJSON for choropleth mapping.

## Required tone

Use a technical but understandable academic tone.

Avoid claiming:

- The system predicts food safety.
- The system replaces laboratory testing.
- The system proves weather causes contamination.
- The current model supports every mycotoxin target.

Use cautious phrases:

- “sampling-priority recommendation”
- “research surveillance guidance”
- “historical signal”
- “published model output”
- “data-limited target”
- “exploratory concentration estimate”
- “requires further validation”

## Final one-slide summary

Use this as the final slide message:

> AgriScan Pro’s prediction feature is currently a conservative, explainable sampling-priority system. It uses historical mycotoxin data, engineered sample/location/season features, optional 90-day weather context, and admin-reviewed published models to help researchers decide what and where to test next. The current model supports TRY most strongly, while many toxin targets remain data-limited and require more positive samples before reliable modeling.
