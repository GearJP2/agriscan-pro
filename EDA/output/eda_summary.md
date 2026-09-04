# Prediction dataset EDA summary

Input file: `backend/prediction_dataset.csv`

## Dataset size

- Unique samples: 512
- Sample/toxin rows: 19,968
- Mycotoxin targets: 39
- Rows with detected toxin value: 337 (1.7%)
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
