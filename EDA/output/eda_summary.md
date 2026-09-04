# Prediction dataset EDA summary

Input file: `backend/prediction_dataset.csv`

## Dataset size

- Unique samples: 512
- Sample/toxin rows: 19,968
- Mycotoxin targets: 39
- Rows with detected toxin value: 337 (1.7%)
- Rows recorded as below LOD / zero / imported empty: 19,631 (98.3%)
- Rows with usable area/date context: 18,096 (90.6%)
- Rows with weather observations: 0 (0.0%)

## Training readiness signal

- Toxins with at least one detection: 29 / 39
- Toxins that roughly meet the current baseline guardrails (>=30 detected, >=30 below LOD/zero, >=60 usable context): 2

This supports the current conservative product decision: use the model for sampling prioritization, not complete safety prediction.

## Top detected toxin targets

| Toxin | Label | Measured | Detected | Detection rate | Usable context |
|---|---|---:|---:|---:|---:|
| FB1 | Fumonisin B1 | 512 | 52 | 10.2% | 90.6% |
| TRY | Tryptophol | 512 | 35 | 6.8% | 90.6% |
| FUSA | Fusaric acid | 512 | 24 | 4.7% | 90.6% |
| HT2 | HT-2 toxin | 512 | 23 | 4.5% | 90.6% |
| BEA | Beauvericin | 512 | 22 | 4.3% | 90.6% |
| TEN | Tentoxin | 512 | 16 | 3.1% | 90.6% |
| ZEA | Zearalenone | 512 | 16 | 3.1% | 90.6% |
| AME | Alternariol monomethyl ether | 512 | 15 | 2.9% | 90.6% |
| EMO | Emodin | 512 | 15 | 2.9% | 90.6% |
| MON | Moniliformin | 512 | 15 | 2.9% | 90.6% |
| FB2 | Fumonisin B2 | 512 | 13 | 2.5% | 90.6% |
| AFB1 | Aflatoxin B1 | 512 | 10 | 2.0% | 90.6% |
| DAS | Diacetoxyscirpenol | 512 | 9 | 1.8% | 90.6% |
| ENNB1 | Enniatin B1 | 512 | 9 | 1.8% | 90.6% |
| CIT | Citrinin | 512 | 8 | 1.6% | 90.6% |

## Highest below-LOD / zero / imported-empty percentages

For the provided historical CSV, empty mycotoxin cells were imported as below LOD / zero-equivalent values.

| Toxin | Label | Measured | Below LOD / zero / imported empty | Percentage | Detected |
|---|---|---:|---:|---:|---:|
| 15ADON | 15-Acetyl-Deoxynivalenol | 512 | 512 | 100.0% | 0 |
| 3ADON | 3-Acetyl-Deoxynivalenol | 512 | 512 | 100.0% | 0 |
| D3G | Deoxynivalenol-3-glucoside | 512 | 512 | 100.0% | 0 |
| NEOS | Neosolaniol | 512 | 512 | 100.0% | 0 |
| NIV | Nivalenol | 512 | 512 | 100.0% | 0 |
| OTB | Ochratoxin B | 512 | 512 | 100.0% | 0 |
| PAT | Patulin | 512 | 512 | 100.0% | 0 |
| PAX | Paxiline | 512 | 512 | 100.0% | 0 |
| PEN | Penitrem A | 512 | 512 | 100.0% | 0 |
| TMP | Trimethoprim | 512 | 512 | 100.0% | 0 |
| AFB2 | Aflatoxin B2 | 512 | 511 | 99.8% | 1 |
| AFG2 | Aflatoxin G2 | 512 | 511 | 99.8% | 1 |
| CPA | Cyclopiazonic acid | 512 | 511 | 99.8% | 1 |
| ENNA | Enniatin A | 512 | 511 | 99.8% | 1 |
| AFG1 | Aflatoxin G1 | 512 | 510 | 99.6% | 2 |

## Positive concentration distribution summary

These statistics use detected positive concentration values only.

| Toxin | Label | Positive rows | Median ug/kg | P75 ug/kg | Max ug/kg | Mean ug/kg |
|---|---|---:|---:|---:|---:|---:|
| FB1 | Fumonisin B1 | 52 | 39.22 | 63.625 | 802.22 | 97.9819 |
| TRY | Tryptophol | 35 | 15.06 | 151.51 | 447.78 | 90.7186 |
| FUSA | Fusaric acid | 24 | 10.335 | 18.2625 | 49.35 | 13.2888 |
| HT2 | HT-2 toxin | 23 | 1.37 | 4.18 | 7.46 | 2.32522 |
| BEA | Beauvericin | 22 | 3.015 | 6.5525 | 25.04 | 4.63818 |
| TEN | Tentoxin | 16 | 0.65 | 2.0325 | 3.11 | 1.07 |
| ZEA | Zearalenone | 16 | 10.5 | 40.2825 | 325.33 | 43.9637 |
| AME | Alternariol monomethyl ether | 15 | 1.05 | 2.465 | 4.11 | 1.418 |
| EMO | Emodin | 15 | 1.04 | 1.565 | 5.45 | 1.264 |
| MON | Moniliformin | 15 | 1.71 | 8.76 | 250.03 | 21.092 |
| FB2 | Fumonisin B2 | 13 | 41.18 | 85.72 | 133.02 | 52.55 |
| AFB1 | Aflatoxin B1 | 10 | 1.485 | 19.4375 | 62.55 | 15.434 |
| DAS | Diacetoxyscirpenol | 9 | 1.29 | 4.83 | 9.55 | 2.93889 |
| ENNB1 | Enniatin B1 | 9 | 0.17 | 0.39 | 2.47 | 0.45 |
| CIT | Citrinin | 8 | 0.775 | 3.5625 | 17.04 | 3.79375 |

## Spatial concentration highlights

These rows show detected province-level concentration signals only. Unknown or unspecified locations are excluded from this table.

| Toxin | Province | Measured | Detected | Detection rate | Mean positive ug/kg | Max positive ug/kg |
|---|---|---:|---:|---:|---:|---:|
| DON | Kampong Thom | 2 | 1 | 50.0% | 156.95 | 156.95 |
| FB1 | Ubon Ratchathani | 43 | 1 | 2.3% | 71.6 | 71.6 |
| DON | Ubon Ratchathani | 43 | 1 | 2.3% | 69.79 | 69.79 |
| AFB1 | Ubon Ratchathani | 43 | 1 | 2.3% | 62.55 | 62.55 |
| FB1 | Kalasin | 2 | 1 | 50.0% | 60.28 | 60.28 |
| AFB1 | Kampong Thom | 2 | 1 | 50.0% | 57.41 | 57.41 |
| FB1 | Kampong Thom | 2 | 1 | 50.0% | 53.68 | 53.68 |
| T-2 | Ubon Ratchathani | 43 | 1 | 2.3% | 51.44 | 51.44 |
| FB1 | Yala | 4 | 3 | 75.0% | 49.72 | 63.2 |
| T-2 | Kampong Thom | 2 | 1 | 50.0% | 48.68 | 48.68 |
| FB1 | Surin | 37 | 2 | 5.4% | 42.32 | 45.11 |
| FB1 | Nakhon Pathom | 32 | 6 | 18.8% | 38.81 | 74.94 |
| FB1 | Chiang Mai | 86 | 9 | 10.5% | 34.84 | 64.9 |
| FB1 | Lampang | 21 | 3 | 14.3% | 34.0467 | 46.21 |
| FB1 | Phayao | 6 | 3 | 50.0% | 28.47 | 40.79 |
| FB1 | Songkhla | 13 | 3 | 23.1% | 17.2033 | 38.77 |
| FB1 | Narathiwat | 18 | 3 | 16.7% | 13.6433 | 18.14 |
| OTA | Kampong Thom | 2 | 1 | 50.0% | 13.27 | 13.27 |
| AFB1 | Yala | 4 | 2 | 50.0% | 12.41 | 24.32 |
| OTA | Ubon Ratchathani | 43 | 1 | 2.3% | 7.55 | 7.55 |

## Top commodities by detected rows

| Commodity | Samples | Measured rows | Detected rows | Detection rate |
|---|---:|---:|---:|---:|
| chicken feed | 12 | 468 | 178 | 38.0% |
| brown rice | 135 | 5,265 | 74 | 1.4% |
| rice crackers | 14 | 546 | 52 | 9.5% |
| white rice | 351 | 13,689 | 33 | 0.2% |

## Top provinces by detected rows

| Province | Samples | Measured rows | Detected rows | Detection rate |
|---|---:|---:|---:|---:|
| Unknown | 48 | 1,872 | 290 | 15.5% |
| Chiang Mai | 86 | 3,354 | 9 | 0.3% |
| Nakhon Pathom | 32 | 1,248 | 6 | 0.5% |
| Ubon Ratchathani | 43 | 1,677 | 5 | 0.3% |
| Yala | 4 | 156 | 5 | 3.2% |
| Kampong Thom | 2 | 78 | 5 | 6.4% |
| Lampang | 21 | 819 | 3 | 0.4% |
| Narathiwat | 18 | 702 | 3 | 0.4% |
| Songkhla | 13 | 507 | 3 | 0.6% |
| Phayao | 6 | 234 | 3 | 1.3% |
| Surin | 37 | 1,443 | 2 | 0.1% |
| Siem Reap | 4 | 156 | 1 | 0.6% |
| Kalasin | 2 | 78 | 1 | 1.3% |
| Bangkok | 1 | 39 | 1 | 2.6% |
| Roi Et | 53 | 2,067 | 0 | 0.0% |

## Collection-period coverage

- First period: 2021-12
- Last period: 2026-05
- Number of periods: 3

## Presentation caution

EDA trends are historical signals. They should be used to explain data coverage, imbalance, and model feasibility. They are not lab-confirmed future predictions by themselves.
