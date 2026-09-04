# Prediction Feature Model Milestone

This document summarizes the prediction feature development timeline for professor review.

## Milestone timeline

| Milestone | What changed | Why we improved it |
|---|---|---|
| 1. Initial prediction concept | Started with a prediction page that estimates mycotoxin risk from sample metadata. | To explore whether historical lab data could support ML-assisted research decisions. |
| 2. Clarified product scope | Reframed the feature from “predict sample safety” to “recommend sampling priorities.” | Predicting safety would overclaim. The available data is better suited for helping researchers decide where and what to test next. |
| 3. Added historical CSV import | Imported the provided mycotoxin CSV data into the system. | The model needs historical sample/result data before it can learn useful contamination patterns. |
| 4. Matched existing sample IDs | Import now updates results by matching sample ID and toxin code. | Future workflow: lab registers samples in the system, exports CSV, fills lab results, then imports back with matching sample IDs. |
| 5. Expanded mycotoxin storage | Added support for more mycotoxin columns from the CSV. | The original system did not store all toxin columns needed for broader mycotoxin analysis. |
| 6. Handled empty toxin cells | Empty cells in the provided CSV are recorded as below LOD / zero-equivalent values. | This matched the agreed interpretation for the historical CSV and keeps model rows complete. |
| 7. Added prediction dataset builder | Created a backend pipeline to convert sample/result data into model-ready rows. | ML training needs consistent tabular features instead of raw Django records. |
| 8. Added feature engineering | Added commodity, food/feed type, province, district, season, purpose, sample type, processing type, optional context, and weather features. | Mycotoxin occurrence depends on commodity, location, season, storage/processing, and environment. |
| 9. Added weather support | Integrated optional 90-day NASA POWER weather features. | Weather affects fungal growth and toxin production, so environmental context can improve sampling prioritization. |
| 10. Added eligibility guardrails | Toxins need enough detected rows, below-LOD rows, and usable context before training. | This prevents unreliable models from being trained on too little data or one-sided data. |
| 11. Chose baseline ML models | Used logistic regression for detection and ridge regression for concentration. | The dataset is small and imbalanced, so stable explainable models are safer than complex models. |
| 12. Added class balancing | Logistic regression uses balanced class weights. | Most toxins have many below-LOD rows and few detections, so class balancing reduces majority-class bias. |
| 13. Added feature scaling | Added `StandardScaler(with_mean=False)` to both logistic regression and ridge regression pipelines. | Scaling improves training stability and prevents numeric features from dominating because of unit size. |
| 14. Increased logistic iterations | Increased logistic regression maximum iterations. | Training previously showed convergence warnings, so more iterations made optimization more stable. |
| 15. Added model artifacts | Training writes versioned artifacts under `prediction_artifacts/<version>/`. | This allows repeatable inspection, publishing, and rollback by model version. |
| 16. Added model inspection command | Added a command to inspect trained/skipped toxins and metrics. | Admin or head researcher can review model quality before exposing it to researchers. |
| 17. Added admin publish step | Models are not active until admin publishes selected toxins. | This prevents unreviewed or low-quality models from being used in researcher recommendations. |
| 18. Added metric guardrails for publishing | Low-metric models are blocked unless force-publish is explicitly used. | This reduces the chance of exposing weak models without deliberate admin review. |
| 19. Added sampling recommendation scoring | Added a recommendation workflow that ranks food/feed and area combinations using model output plus historical signals. | The system should guide research planning: what sample type and area should be considered for testing next. |
| 20. Separated area-specific and national signals | Split recommendations with real province/district data from incomplete-location national signals. | This avoids mixing precise “where to test” guidance with historical rows that do not have enough location detail. |
| 21. Added role-based access separation | Researchers see operational sampling recommendations; admins see technical diagnostics and model publishing. | This keeps researcher workflow simple while preserving governance tools for admins. |
| 22. Removed registered-sample prediction shortcuts | Removed researcher-facing shortcuts that predicted already registered samples. | The intended workflow is to recommend where to collect samples, not to predict samples that are already in the lab workflow. |
| 23. Added EDA workflow | Added separate EDA scripts and graph outputs for data exploration before model training. | This provides evidence for model feasibility, data gaps, toxin imbalance, concentration distribution, and spatial coverage. |
| 24. Added spatial province sample map | Added a Thailand centroid bubble map showing how many historical samples occur in each province. | This helps explain spatial sample coverage and where the dataset is concentrated. |
| 25. Added handoff documentation | Created prediction handoff and ML pipeline documentation. | This makes the work understandable for professor review and for the next developer. |
| 26. Added validation | Backend and frontend validation were run during development. | This confirms the current implementation is stable before merge or presentation. |

## Short narrative version

We started with a general prediction idea, but improved it step by step into a safer research workflow.

Because the dataset is small and imbalanced, we used explainable baseline models instead of complex ML. We added data import, feature engineering, weather context, scaling, model guardrails, admin publishing, and recommendation scoring.

Finally, we separated researcher-facing sampling recommendations from technical diagnostics so the system supports research planning without overclaiming laboratory results, regulatory compliance, or food safety decisions.

## Current technical position

- The feature should be described as **sampling-priority recommendation**, not final contamination prediction.
- Published models currently depend on toxins with enough usable detections.
- Logistic regression estimates detection probability.
- Ridge regression estimates concentration for detected/positive values.
- Weather features are optional and can be included when a weather-trained model version is published.
- Admin review is required before trained models become active for researcher-facing recommendations.
- EDA outputs should be used to explain data limitations before discussing model performance.
