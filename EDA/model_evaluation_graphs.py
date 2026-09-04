#!/usr/bin/env python3
"""Generate model evaluation graphs from prediction artifact metadata.

This script reads a saved prediction model `metadata.json` file and creates
professor-ready charts for test metrics and model readiness.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.environ.setdefault("MPLCONFIGDIR", str(Path("EDA/.matplotlib-cache").resolve()))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


DEFAULT_ARTIFACT_ROOT = Path("backend/prediction_artifacts")
DEFAULT_OUTPUT = Path("EDA/model_evaluation_graphs")
GFS_MAROON = "#9F1D20"
GFS_MAROON_DARK = "#7A1517"
GFS_GOLD = "#F4B41A"
GFS_CHARCOAL = "#2A3142"
GFS_MUTED = "#6B6B6B"
GFS_BG_ALT = "#FAF5EC"
GFS_BORDER = "#E5DFD2"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate prediction model evaluation metric graphs.",
    )
    parser.add_argument(
        "--metadata",
        default="",
        help="Path to prediction artifact metadata.json. Defaults to the latest version.",
    )
    parser.add_argument(
        "--artifact-root",
        default=str(DEFAULT_ARTIFACT_ROOT),
        help=f"Prediction artifact root. Default: {DEFAULT_ARTIFACT_ROOT}",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT),
        help=f"Graph output directory. Default: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def apply_style() -> None:
    plt.rcParams.update({
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "axes.edgecolor": GFS_BORDER,
        "axes.labelcolor": GFS_CHARCOAL,
        "axes.titlecolor": GFS_CHARCOAL,
        "xtick.color": GFS_MUTED,
        "ytick.color": GFS_MUTED,
        "font.size": 10,
        "axes.titlesize": 15,
        "axes.titleweight": "bold",
        "axes.labelsize": 10,
        "grid.color": GFS_BORDER,
        "grid.linestyle": "-",
        "grid.alpha": 0.65,
        "savefig.dpi": 180,
        "savefig.bbox": "tight",
    })


def latest_metadata_path(artifact_root: Path) -> Path:
    candidates = sorted(artifact_root.glob("*/metadata.json"))
    if not candidates:
        raise SystemExit(f"No metadata.json files found under {artifact_root}")
    return candidates[-1]


def load_metadata(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"Metadata file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_current(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


def build_trained_table(metadata: dict) -> pd.DataFrame:
    rows = []
    for model in metadata.get("trained_models", []):
        classification = model.get("classification_metrics", {})
        regression = model.get("regression_metrics", {})
        rows.append({
            "toxin_type": model.get("toxin_type", ""),
            "published": bool(model.get("published")),
            "measured": int(model.get("measured", 0)),
            "detected": int(model.get("detected", 0)),
            "below_lod_or_zero": int(model.get("below_lod_or_zero", 0)),
            "usable_context": int(model.get("usable_context", 0)),
            "accuracy": classification.get("accuracy", np.nan),
            "f1": classification.get("f1", np.nan),
            "precision": classification.get("precision", np.nan),
            "recall": classification.get("recall", np.nan),
            "roc_auc": classification.get("roc_auc", np.nan),
            "prevalence": classification.get("prevalence", np.nan),
            "classification_test_rows": classification.get("test_rows", np.nan),
            "mae_log1p": regression.get("mae_log1p", np.nan),
            "rmse_log1p": regression.get("rmse_log1p", np.nan),
            "regression_test_rows": regression.get("test_rows", np.nan),
        })
    return pd.DataFrame(rows)


def build_skipped_table(metadata: dict) -> pd.DataFrame:
    rows = []
    for target in metadata.get("skipped_targets", []):
        rows.append({
            "toxin_type": target.get("toxin_type", ""),
            "measured": int(target.get("measured", 0)),
            "detected": int(target.get("detected", 0)),
            "below_lod_or_zero": int(target.get("below_lod_or_zero", 0)),
            "usable_context": int(target.get("usable_context", 0)),
            "eligible": bool(target.get("eligible")),
        })
    return pd.DataFrame(rows)


def plot_classification_metrics(trained: pd.DataFrame, output_dir: Path) -> None:
    if trained.empty:
        return
    metrics = ["accuracy", "f1", "precision", "recall", "roc_auc"]
    data = trained.set_index("toxin_type")[metrics].astype(float)

    fig, ax = plt.subplots(figsize=(10, 5.8))
    x = np.arange(len(data.index))
    width = 0.15
    colors = [GFS_MAROON, GFS_GOLD, GFS_MAROON_DARK, "#D95F02", "#7570B3"]
    for index, metric in enumerate(metrics):
        bars = ax.bar(
            x + (index - 2) * width,
            data[metric],
            width,
            label=metric.replace("_", " ").upper(),
            color=colors[index],
            alpha=0.9,
        )
        for bar, value in zip(bars, data[metric]):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                min(float(value) + 0.018, 1.04),
                f"{float(value):.2f}",
                ha="center",
                va="bottom",
                fontsize=7,
                rotation=90,
                color=GFS_MUTED,
            )

    ax.set_title("Classification test metrics by trained mycotoxin model", loc="left", pad=14)
    ax.set_ylabel("Score")
    ax.set_ylim(0, 1.16)
    ax.set_xticks(x)
    ax.set_xticklabels(data.index)
    ax.grid(axis="y")
    ax.legend(frameon=False, ncol=5, loc="upper center", bbox_to_anchor=(0.5, 1.02), fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)

    for model_index, toxin in enumerate(data.index):
        status = "Published" if bool(trained.loc[trained["toxin_type"] == toxin, "published"].iloc[0]) else "Unpublished"
        ax.text(model_index, 1.105, status, ha="center", va="bottom", fontsize=8, color=GFS_MUTED)

    save_current(output_dir / "01_classification_test_metrics.png")


def plot_data_balance(trained: pd.DataFrame, output_dir: Path) -> None:
    if trained.empty:
        return
    data = trained.sort_values("detected", ascending=False)
    fig, ax = plt.subplots(figsize=(9, 5.5))
    x = np.arange(len(data))
    ax.bar(x, data["detected"], label="Detected", color=GFS_MAROON, alpha=0.9)
    ax.bar(
        x,
        data["below_lod_or_zero"],
        bottom=data["detected"],
        label="Below LOD / zero",
        color=GFS_BG_ALT,
        edgecolor=GFS_MAROON_DARK,
        alpha=0.95,
    )
    ax.set_title("Training label balance for eligible toxin models", loc="left", pad=14)
    ax.set_ylabel("Rows")
    ax.set_xticks(x)
    ax.set_xticklabels(data["toxin_type"])
    ax.grid(axis="y")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    for index, row in enumerate(data.itertuples()):
        ax.text(index, row.measured + 8, f"{row.detected}/{row.measured}", ha="center", fontsize=9)
    save_current(output_dir / "02_training_label_balance.png")


def plot_regression_metrics(trained: pd.DataFrame, output_dir: Path) -> None:
    data = trained.dropna(subset=["mae_log1p", "rmse_log1p"]).copy()
    if data.empty:
        return
    fig, ax = plt.subplots(figsize=(8.5, 5.2))
    x = np.arange(len(data))
    width = 0.32
    ax.bar(x - width / 2, data["mae_log1p"], width, label="MAE log1p", color=GFS_MAROON)
    ax.bar(x + width / 2, data["rmse_log1p"], width, label="RMSE log1p", color=GFS_GOLD)
    ax.set_title("Concentration regression test error", loc="left", pad=14)
    ax.set_ylabel("Error on log1p concentration")
    ax.set_xticks(x)
    ax.set_xticklabels(data["toxin_type"])
    ax.grid(axis="y")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    for index, row in enumerate(data.itertuples()):
        ax.text(index, max(row.mae_log1p, row.rmse_log1p) + 0.03, f"n={int(row.regression_test_rows)}", ha="center", fontsize=9)
    save_current(output_dir / "03_concentration_regression_error.png")


def plot_target_readiness(trained: pd.DataFrame, skipped: pd.DataFrame, output_dir: Path) -> None:
    trained_count = int(trained.shape[0])
    published_count = int(trained["published"].sum()) if not trained.empty else 0
    unpublished_count = trained_count - published_count
    skipped_count = int(skipped.shape[0])

    labels = ["Published", "Trained not published", "Skipped"]
    values = [published_count, unpublished_count, skipped_count]
    colors = [GFS_MAROON, GFS_GOLD, GFS_BG_ALT]

    fig, ax = plt.subplots(figsize=(8, 5.4))
    bars = ax.bar(labels, values, color=colors, edgecolor=GFS_MAROON_DARK, linewidth=1)
    ax.set_title("Model target readiness", loc="left", pad=14)
    ax.set_ylabel("Mycotoxin targets")
    ax.grid(axis="y")
    ax.spines[["top", "right"]].set_visible(False)
    for bar, value in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.5, str(value), ha="center", fontsize=11)
    save_current(output_dir / "04_model_target_readiness.png")


def plot_skipped_targets(skipped: pd.DataFrame, output_dir: Path, top_n: int = 15) -> None:
    if skipped.empty:
        return
    data = skipped.sort_values(["detected", "measured"], ascending=[False, False]).head(top_n).iloc[::-1]
    fig, ax = plt.subplots(figsize=(10, 6.2))
    ax.barh(data["toxin_type"], data["detected"], color=GFS_MAROON, label="Detected")
    ax.barh(
        data["toxin_type"],
        data["below_lod_or_zero"],
        left=data["detected"],
        color=GFS_BG_ALT,
        edgecolor=GFS_MAROON_DARK,
        label="Below LOD / zero",
    )
    ax.set_title("Skipped targets with highest detected counts", loc="left", pad=14)
    ax.set_xlabel("Rows")
    ax.grid(axis="x")
    ax.legend(frameon=False)
    ax.spines[["top", "right", "left"]].set_visible(False)
    save_current(output_dir / "05_skipped_target_data_balance.png")


def write_summary(metadata: dict, trained: pd.DataFrame, skipped: pd.DataFrame, output_dir: Path) -> None:
    version = metadata.get("version", "unknown")
    config = metadata.get("training_config", {})
    lines = [
        "# Prediction model evaluation summary",
        "",
        f"- Model version: `{version}`",
        f"- Created at: {metadata.get('created_at', 'unknown')}",
        f"- Model family: `{metadata.get('model_family', 'unknown')}`",
        f"- Include weather: {config.get('include_weather', 'unknown')}",
        f"- Fetch weather during training: {config.get('fetch_weather', 'unknown')}",
        f"- Train/test split: {1 - float(config.get('test_size', 0.2)):.0%}/{float(config.get('test_size', 0.2)):.0%}",
        f"- Logistic max iterations: {config.get('logistic_max_iter', 'unknown')}",
        f"- Preprocessing: {config.get('preprocessing', 'unknown')}",
        "",
        "## Trained model test metrics",
        "",
        "| Toxin | State | Measured | Detected | Test rows | F1 | ROC-AUC | Precision | Recall | Accuracy |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in trained.itertuples():
        state = "Published" if row.published else "Unpublished"
        lines.append(
            f"| {row.toxin_type} | {state} | {int(row.measured):,} | {int(row.detected):,} | "
            f"{int(row.classification_test_rows):,} | {row.f1:.4f} | {row.roc_auc:.4f} | "
            f"{row.precision:.4f} | {row.recall:.4f} | {row.accuracy:.4f} |"
        )

    lines.extend([
        "",
        "## Concentration regression test metrics",
        "",
        "| Toxin | Test rows | MAE log1p | RMSE log1p |",
        "|---|---:|---:|---:|",
    ])
    for row in trained.dropna(subset=["mae_log1p", "rmse_log1p"]).itertuples():
        lines.append(
            f"| {row.toxin_type} | {int(row.regression_test_rows):,} | "
            f"{row.mae_log1p:.4f} | {row.rmse_log1p:.4f} |"
        )

    lines.extend([
        "",
        "## Target readiness",
        "",
        f"- Trained targets: {trained.shape[0]:,}",
        f"- Published targets: {int(trained['published'].sum()) if not trained.empty else 0:,}",
        f"- Skipped targets: {skipped.shape[0]:,}",
        "",
        "## Graph files",
        "",
        "- `01_classification_test_metrics.png`",
        "- `02_training_label_balance.png`",
        "- `03_concentration_regression_error.png`",
        "- `04_model_target_readiness.png`",
        "- `05_skipped_target_data_balance.png`",
        "",
        "## Why each model-improvement step was needed",
        "",
        "| Step | Why it was needed | Model impact |",
        "|---|---|---|",
        "| Historical CSV import | The ML pipeline needs enough past sample/result records to learn contamination patterns. | Converts external lab history into usable training evidence. |",
        "| Sample ID matching | Imported result rows must update the correct registered samples instead of creating disconnected data. | Keeps future export/import workflows consistent and prevents duplicate labels. |",
        "| Empty toxin-cell handling | Empty toxin cells in the historical CSV were treated as below LOD / zero-equivalent rows based on the project rule. | Preserves complete negative examples needed for binary detection training. |",
        "| Dataset builder | Raw Django records are not directly suitable for model training. | Produces one consistent row per sample-toxin target with labels and features. |",
        "| Feature engineering | Mycotoxin occurrence depends on sample type, commodity, location, season, processing, storage, and environmental context. | Gives the model structured predictors instead of only toxin labels. |",
        "| Weather features | Temperature, humidity, precipitation, and soil temperature can affect fungal growth and toxin formation. | Adds environmental signals for sampling-priority estimation when weather-trained artifacts are used. |",
        "| Eligibility guardrails | Many toxins have too few detections or only negative examples. | Prevents training misleading models for targets without enough positive/negative evidence. |",
        "| Logistic regression detection model | The first question is whether a toxin is likely detected or not. | Produces an interpretable detection probability for each published toxin. |",
        "| Balanced class weights | The dataset is highly imbalanced: most rows are below LOD / zero. | Reduces majority-class bias so detected rows are not ignored. |",
        "| Ridge concentration model | Researchers also need approximate concentration signal after detection. | Estimates concentration trend for positive rows, while remaining simpler than high-variance models. |",
        "| `log1p` concentration target | Concentrations are skewed and can have large outliers. | Stabilizes regression by compressing extreme values. |",
        "| Feature scaling | Numeric features use different units and ranges. | Improves optimization stability and prevents large-scale numeric features from dominating. |",
        "| Increased logistic iterations | Earlier training showed convergence warnings. | Gives the optimizer enough iterations to settle more reliably. |",
        "| Versioned artifacts | Model outputs must be reproducible and reviewable. | Stores each trained model version for inspection, publishing, rollback, and comparison. |",
        "| Inspection command | Metrics must be reviewed before researcher use. | Makes trained/skipped targets and performance visible to admin/head researcher. |",
        "| Admin publish step | Not every trained model should be active. | Exposes only reviewed models to researcher-facing recommendations. |",
        "| Sampling recommendation scoring | Researchers need an operational decision: what and where to test next. | Combines model risk, historical detection signal, sample volume, and location completeness into a prioritization score. |",
        "| Role separation | Researchers should not need low-level model diagnostics during routine use. | Keeps researcher UI focused while preserving technical controls for admins. |",
        "",
        "## Interpretation",
        "",
        "- `TRY` is the only currently published model.",
        "- `FB1` was trained but kept unpublished because its F1/precision are weaker, despite high recall and ROC-AUC.",
        "- Most toxin targets were skipped because the dataset has too few positive detections for responsible training.",
        "- Concentration regression metrics should be treated cautiously because positive test rows are small.",
        "",
    ])
    (output_dir / "model_evaluation_summary.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    metadata_path = Path(args.metadata) if args.metadata else latest_metadata_path(Path(args.artifact_root))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    apply_style()

    metadata = load_metadata(metadata_path)
    trained = build_trained_table(metadata)
    skipped = build_skipped_table(metadata)
    if trained.empty:
        raise SystemExit(f"No trained models found in {metadata_path}")

    trained.to_csv(output_dir / "model_classification_regression_metrics.csv", index=False)
    skipped.to_csv(output_dir / "model_skipped_target_metrics.csv", index=False)

    plot_classification_metrics(trained, output_dir)
    plot_data_balance(trained, output_dir)
    plot_regression_metrics(trained, output_dir)
    plot_target_readiness(trained, skipped, output_dir)
    plot_skipped_targets(skipped, output_dir)
    write_summary(metadata, trained, skipped, output_dir)

    print(f"Read model metadata from {metadata_path}")
    print(f"Wrote model evaluation graphs to {output_dir}")


if __name__ == "__main__":
    main()
