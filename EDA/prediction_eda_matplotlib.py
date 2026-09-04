#!/usr/bin/env python3
"""Presentation-grade EDA plots for the prediction dataset.

This script uses pandas, numpy, and matplotlib to create more readable PNG
visualizations than the dependency-free SVG generator. It is intended for
professor updates, reports, and slide preparation.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.environ.setdefault("MPLCONFIGDIR", str(Path("EDA/.matplotlib-cache").resolve()))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


DEFAULT_INPUT = Path("backend/prediction_dataset.csv")
DEFAULT_OUTPUT = Path("EDA/graphs")
GFS_MAROON = "#9F1D20"
GFS_MAROON_DARK = "#7A1517"
GFS_GOLD = "#F4B41A"
GFS_CHARCOAL = "#2A3142"
GFS_MUTED = "#6B6B6B"
GFS_BG_ALT = "#FAF5EC"

THAILAND_OUTLINE_LON_LAT = [
    (98.0, 20.4),
    (99.5, 19.8),
    (100.8, 20.4),
    (101.7, 19.0),
    (102.6, 18.0),
    (104.0, 17.4),
    (105.2, 15.8),
    (105.6, 14.7),
    (104.4, 14.2),
    (103.0, 14.4),
    (102.4, 13.2),
    (101.5, 12.4),
    (100.6, 12.1),
    (100.2, 10.8),
    (99.6, 9.6),
    (99.2, 8.2),
    (99.6, 7.0),
    (100.3, 6.5),
    (101.0, 6.1),
    (101.7, 6.4),
    (101.1, 7.5),
    (100.4, 8.5),
    (99.8, 9.7),
    (99.2, 11.0),
    (98.7, 12.4),
    (98.4, 14.0),
    (98.7, 15.7),
    (98.2, 17.1),
    (97.7, 18.6),
    (98.0, 20.4),
]

THAILAND_PROVINCE_CENTROIDS = {
    "amnart charoen": ("Amnart Charoen", 15.8585, 104.6288),
    "bangkok": ("Bangkok", 13.7563, 100.5018),
    "chaiyaphum": ("Chaiyaphum", 15.8068, 102.0315),
    "chiang mai": ("Chiang Mai", 18.7883, 98.9853),
    "chiang rai": ("Chiang Rai", 19.9105, 99.8406),
    "kalasin": ("Kalasin", 16.4385, 103.5061),
    "lampang": ("Lampang", 18.2888, 99.4909),
    "mahasarakham": ("Maha Sarakham", 16.1851, 103.3026),
    "mukdahan": ("Mukdahan", 16.5453, 104.7235),
    "nakhon pathom": ("Nakhon Pathom", 13.8199, 100.0622),
    "narathiwat": ("Narathiwat", 6.4255, 101.8253),
    "pathum thani": ("Pathum Thani", 14.0208, 100.5250),
    "pha yao": ("Phayao", 19.1665, 99.9019),
    "phayao": ("Phayao", 19.1665, 99.9019),
    "phichit": ("Phichit", 16.4429, 100.3488),
    "roi et": ("Roi Et", 16.0538, 103.6520),
    "si sa ket": ("Si Sa Ket", 15.1186, 104.3220),
    "songkhla": ("Songkhla", 7.1898, 100.5951),
    "suphan buri": ("Suphan Buri", 14.4745, 100.1177),
    "surin": ("Surin", 14.8829, 103.4937),
    "ubon ratchathani": ("Ubon Ratchathani", 15.2287, 104.8564),
    "yala": ("Yala", 6.5411, 101.2804),
    "yasothon": ("Yasothon", 15.7926, 104.1453),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate pandas/numpy/matplotlib EDA graphs for prediction data.",
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help=f"Prediction dataset CSV path. Default: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT),
        help=f"Graph output directory. Default: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=20,
        help="Number of top rows shown in ranked plots. Default: 20",
    )
    parser.add_argument(
        "--toxins",
        default="FB1,TRY,FUSA,HT2,BEA,ZEA,AFB1,DON,OTA",
        help="Comma-separated toxins for individual concentration/spatial plots.",
    )
    return parser.parse_args()


def read_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise SystemExit(
            f"Input CSV not found: {path}\n"
            "Generate it first with:\n"
            "docker compose exec backend python manage.py "
            "build_prediction_dataset --include-weather --output prediction_dataset.csv"
        )

    df = pd.read_csv(path)
    numeric_columns = [
        "detected",
        "concentration_ug_kg",
        "is_below_lod",
        "usable_context",
        "collection_year",
        "collection_month",
        "weather_days_observed_90d",
    ]
    for column in numeric_columns:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0)

    for column in ["toxin_type", "toxin_label", "commodity", "province", "collection_date"]:
        if column in df.columns:
            df[column] = df[column].fillna("").astype(str)

    df["detected"] = df["detected"].astype(int)
    df["below_lod_or_zero_or_imported_empty"] = (df["concentration_ug_kg"] <= 0).astype(int)
    df["province_clean"] = df["province"].replace({"": "Unspecified area", "Unknown": "Unspecified area"})
    df["commodity_clean"] = df["commodity"].replace({"": "Unknown"})
    return df


def apply_style() -> None:
    plt.rcParams.update({
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "axes.edgecolor": "#E5DFD2",
        "axes.labelcolor": GFS_CHARCOAL,
        "axes.titlecolor": GFS_CHARCOAL,
        "xtick.color": GFS_MUTED,
        "ytick.color": GFS_MUTED,
        "font.size": 10,
        "axes.titlesize": 15,
        "axes.titleweight": "bold",
        "axes.labelsize": 10,
        "grid.color": "#E5DFD2",
        "grid.linestyle": "-",
        "grid.alpha": 0.65,
        "savefig.dpi": 180,
        "savefig.bbox": "tight",
    })


def save_current(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(path)
    plt.close()


def toxin_summary(df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        df.groupby(["toxin_type", "toxin_label"], dropna=False)
        .agg(
            measured=("sample_id", "size"),
            detected=("detected", "sum"),
            below_lod_or_zero_or_imported_empty=("below_lod_or_zero_or_imported_empty", "sum"),
            usable_context=("usable_context", "sum"),
        )
        .reset_index()
    )
    grouped["detection_rate"] = grouped["detected"] / grouped["measured"]
    grouped["below_lod_or_zero_or_imported_empty_rate"] = (
        grouped["below_lod_or_zero_or_imported_empty"] / grouped["measured"]
    )
    return grouped.sort_values(["detected", "detection_rate"], ascending=[False, False])


def concentration_summary(df: pd.DataFrame) -> pd.DataFrame:
    positive = df[df["concentration_ug_kg"] > 0].copy()
    if positive.empty:
        return pd.DataFrame()
    summary = (
        positive.groupby(["toxin_type", "toxin_label"], dropna=False)["concentration_ug_kg"]
        .agg(
            positive_rows="count",
            mean_positive="mean",
            median_positive="median",
            p75_positive=lambda values: np.percentile(values, 75),
            max_positive="max",
        )
        .reset_index()
    )
    return summary.sort_values("positive_rows", ascending=False)


def plot_horizontal_bar(
    data: pd.DataFrame,
    *,
    path: Path,
    title: str,
    x_col: str,
    y_col: str,
    x_label: str,
    value_format: str = "{:.1f}",
    color: str = GFS_MAROON,
    figsize: tuple[float, float] = (11, 7),
) -> None:
    if data.empty:
        return
    plot_data = data.iloc[::-1]
    fig, ax = plt.subplots(figsize=figsize)
    bars = ax.barh(plot_data[y_col], plot_data[x_col], color=color, alpha=0.92)
    ax.set_title(title, loc="left", pad=14)
    ax.set_xlabel(x_label)
    ax.grid(axis="x")
    ax.spines[["top", "right", "left"]].set_visible(False)
    for bar, value in zip(bars, plot_data[x_col]):
        ax.text(
            bar.get_width(),
            bar.get_y() + bar.get_height() / 2,
            f" {value_format.format(value)}",
            va="center",
            ha="left",
            fontsize=9,
            color=GFS_CHARCOAL,
        )
    save_current(path)


def plot_toxin_detection(summary: pd.DataFrame, output_dir: Path, top_n: int) -> None:
    data = summary.head(top_n).copy()
    data["label"] = data["toxin_type"] + " — " + data["toxin_label"]
    plot_horizontal_bar(
        data,
        path=output_dir / "01_toxin_detected_counts.png",
        title="Detected rows by mycotoxin",
        x_col="detected",
        y_col="label",
        x_label="Detected sample/toxin rows",
        value_format="{:.0f}",
    )

    rate_data = summary.sort_values("detection_rate", ascending=False).head(top_n).copy()
    rate_data["label"] = rate_data["toxin_type"] + " — " + rate_data["toxin_label"]
    rate_data["detection_pct"] = rate_data["detection_rate"] * 100
    plot_horizontal_bar(
        rate_data,
        path=output_dir / "02_toxin_detection_percentage.png",
        title="Detection percentage by mycotoxin",
        x_col="detection_pct",
        y_col="label",
        x_label="Detected rows (%)",
        value_format="{:.1f}%",
        color=GFS_MAROON_DARK,
    )

    missing_data = (
        summary.sort_values("below_lod_or_zero_or_imported_empty_rate", ascending=False)
        .head(top_n)
        .copy()
    )
    missing_data["label"] = missing_data["toxin_type"] + " — " + missing_data["toxin_label"]
    missing_data["below_pct"] = missing_data["below_lod_or_zero_or_imported_empty_rate"] * 100
    plot_horizontal_bar(
        missing_data,
        path=output_dir / "03_toxin_below_lod_zero_imported_empty_percentage.png",
        title="Below LOD / zero / imported-empty percentage by mycotoxin",
        x_col="below_pct",
        y_col="label",
        x_label="Below LOD / zero / imported empty (%)",
        value_format="{:.1f}%",
        color=GFS_GOLD,
    )


def plot_concentration_overview(
    df: pd.DataFrame,
    summary: pd.DataFrame,
    output_dir: Path,
    top_n: int,
) -> None:
    if summary.empty:
        return
    data = summary.head(top_n).copy()
    data["label"] = data["toxin_type"] + " — " + data["toxin_label"]
    mean_data = data.sort_values("mean_positive", ascending=False)
    plot_horizontal_bar(
        mean_data,
        path=output_dir / "04_toxin_mean_positive_concentration.png",
        title="Mean positive concentration by mycotoxin",
        x_col="mean_positive",
        y_col="label",
        x_label="Mean positive concentration (ug/kg)",
        value_format="{:.2f}",
        color=GFS_MAROON,
    )

    top_toxins = data["toxin_type"].tolist()
    positive = df[(df["concentration_ug_kg"] > 0) & (df["toxin_type"].isin(top_toxins))]
    box_data = [
        positive.loc[positive["toxin_type"] == toxin, "concentration_ug_kg"].to_numpy()
        for toxin in top_toxins
    ]
    labels = top_toxins
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.boxplot(
        box_data,
        tick_labels=labels,
        patch_artist=True,
        boxprops={"facecolor": GFS_BG_ALT, "edgecolor": GFS_MAROON},
        medianprops={"color": GFS_MAROON_DARK, "linewidth": 2},
        whiskerprops={"color": GFS_MUTED},
        capprops={"color": GFS_MUTED},
        flierprops={"marker": "o", "markersize": 3, "markerfacecolor": GFS_GOLD, "markeredgecolor": GFS_MAROON},
    )
    ax.set_title("Positive concentration distribution by mycotoxin", loc="left", pad=14)
    ax.set_ylabel("Concentration (ug/kg)")
    ax.set_yscale("symlog")
    ax.grid(axis="y")
    ax.spines[["top", "right"]].set_visible(False)
    save_current(output_dir / "05_toxin_positive_concentration_boxplot.png")


def plot_individual_toxin_distributions(df: pd.DataFrame, toxins: list[str], output_dir: Path) -> None:
    target_dir = output_dir / "individual_toxin_concentration"
    target_dir.mkdir(parents=True, exist_ok=True)
    for toxin in toxins:
        toxin_df = df[(df["toxin_type"].str.upper() == toxin.upper()) & (df["concentration_ug_kg"] > 0)]
        if toxin_df.empty:
            continue
        label = toxin_df["toxin_label"].iloc[0]
        fig, ax = plt.subplots(figsize=(9, 5.5))
        ax.hist(
            toxin_df["concentration_ug_kg"],
            bins=min(15, max(5, toxin_df.shape[0] // 2)),
            color=GFS_MAROON,
            alpha=0.88,
            edgecolor="white",
        )
        ax.axvline(
            toxin_df["concentration_ug_kg"].median(),
            color=GFS_GOLD,
            linewidth=2,
            label=f"Median {toxin_df['concentration_ug_kg'].median():.2f} ug/kg",
        )
        ax.set_title(f"{toxin} — {label}: positive concentration distribution", loc="left", pad=14)
        ax.set_xlabel("Concentration (ug/kg)")
        ax.set_ylabel("Positive rows")
        ax.grid(axis="y")
        ax.legend(frameon=False)
        ax.spines[["top", "right"]].set_visible(False)
        save_current(target_dir / f"{safe_filename(toxin)}_positive_concentration_histogram.png")


def plot_commodity_and_month(df: pd.DataFrame, output_dir: Path, top_n: int) -> None:
    commodity = (
        df.groupby("commodity_clean")
        .agg(
            measured=("sample_id", "size"),
            detected=("detected", "sum"),
            samples=("sample_id", "nunique"),
        )
        .reset_index()
    )
    commodity["detection_rate"] = commodity["detected"] / commodity["measured"]
    commodity = commodity.sort_values("detected", ascending=False).head(top_n)
    commodity["detection_pct"] = commodity["detection_rate"] * 100
    plot_horizontal_bar(
        commodity.sort_values("detection_pct", ascending=False),
        path=output_dir / "06_commodity_detection_percentage.png",
        title="Commodity detection percentage",
        x_col="detection_pct",
        y_col="commodity_clean",
        x_label="Detected rows (%)",
        value_format="{:.1f}%",
        color=GFS_MAROON_DARK,
    )

    month_df = df.copy()
    month_df["period"] = (
        month_df["collection_year"].astype(int).astype(str)
        + "-"
        + month_df["collection_month"].astype(int).astype(str).str.zfill(2)
    )
    month_summary = (
        month_df[month_df["collection_year"] > 0]
        .groupby("period")
        .agg(measured=("sample_id", "size"), detected=("detected", "sum"))
        .reset_index()
        .sort_values("period")
    )
    if not month_summary.empty:
        month_summary["detection_pct"] = month_summary["detected"] / month_summary["measured"] * 100
        fig, ax = plt.subplots(figsize=(10, 5.5))
        ax.plot(month_summary["period"], month_summary["detection_pct"], color=GFS_MAROON, marker="o", linewidth=2.5)
        ax.fill_between(
            month_summary["period"],
            month_summary["detection_pct"],
            color=GFS_MAROON,
            alpha=0.12,
        )
        ax.set_title("Monthly detection trend", loc="left", pad=14)
        ax.set_xlabel("Collection period")
        ax.set_ylabel("Detected rows (%)")
        ax.grid(axis="y")
        ax.spines[["top", "right"]].set_visible(False)
        plt.xticks(rotation=35, ha="right")
        save_current(output_dir / "07_monthly_detection_trend.png")


def plot_spatial_concentration(df: pd.DataFrame, toxins: list[str], output_dir: Path) -> None:
    target_dir = output_dir / "individual_toxin_spatial_concentration"
    target_dir.mkdir(parents=True, exist_ok=True)
    positive = df[
        (df["concentration_ug_kg"] > 0)
        & (~df["province_clean"].str.lower().isin(["unknown", "unspecified area"]))
    ].copy()
    if positive.empty:
        return

    for toxin in toxins:
        toxin_df = positive[positive["toxin_type"].str.upper() == toxin.upper()]
        if toxin_df.empty:
            continue
        label = toxin_df["toxin_label"].iloc[0]
        spatial = (
            toxin_df.groupby("province_clean")
            .agg(
                detected=("sample_id", "size"),
                mean_concentration=("concentration_ug_kg", "mean"),
                max_concentration=("concentration_ug_kg", "max"),
            )
            .reset_index()
            .sort_values(["mean_concentration", "detected"], ascending=[False, False])
            .head(15)
        )
        plot_horizontal_bar(
            spatial,
            path=target_dir / f"{safe_filename(toxin)}_province_mean_concentration.png",
            title=f"{toxin} — {label}: mean positive concentration by province",
            x_col="mean_concentration",
            y_col="province_clean",
            x_label="Mean positive concentration (ug/kg)",
            value_format="{:.2f}",
            color=GFS_MAROON,
            figsize=(10, 6),
        )


def normalize_province_key(value: str) -> str:
    return " ".join(str(value).strip().lower().replace(".", "").split())


def plot_thailand_sample_count_map(df: pd.DataFrame, output_dir: Path) -> pd.DataFrame:
    province_counts = (
        df.copy()
        .assign(province_key=lambda frame: frame["province"].map(normalize_province_key))
        .groupby("province_key")
        .agg(
            province=("province", "first"),
            unique_samples=("sample_id", "nunique"),
            toxin_result_rows=("sample_id", "size"),
            detected_rows=("detected", "sum"),
        )
        .reset_index()
    )
    province_counts = province_counts[
        ~province_counts["province_key"].isin(["", "unknown", "unspecified area"])
    ].copy()
    if province_counts.empty:
        return pd.DataFrame()

    province_counts["mapped_province"] = province_counts["province_key"].map(
        lambda key: THAILAND_PROVINCE_CENTROIDS.get(key, ("", np.nan, np.nan))[0]
    )
    province_counts["latitude"] = province_counts["province_key"].map(
        lambda key: THAILAND_PROVINCE_CENTROIDS.get(key, ("", np.nan, np.nan))[1]
    )
    province_counts["longitude"] = province_counts["province_key"].map(
        lambda key: THAILAND_PROVINCE_CENTROIDS.get(key, ("", np.nan, np.nan))[2]
    )
    province_counts["mapped_on_thailand_map"] = province_counts["mapped_province"].astype(bool)
    mapped_raw = province_counts[province_counts["mapped_on_thailand_map"]].copy()
    unmapped_raw = province_counts[~province_counts["mapped_on_thailand_map"]].copy()
    if not mapped_raw.empty:
        mapped_raw = (
            mapped_raw.groupby("mapped_province", as_index=False)
            .agg(
                province=("mapped_province", "first"),
                province_key=("mapped_province", "first"),
                unique_samples=("unique_samples", "sum"),
                toxin_result_rows=("toxin_result_rows", "sum"),
                detected_rows=("detected_rows", "sum"),
                latitude=("latitude", "first"),
                longitude=("longitude", "first"),
                mapped_on_thailand_map=("mapped_on_thailand_map", "first"),
            )
        )
        mapped_raw["province_key"] = mapped_raw["province_key"].map(normalize_province_key)
    province_counts = pd.concat([mapped_raw, unmapped_raw], ignore_index=True).sort_values(
        "unique_samples",
        ascending=False,
    )
    province_counts.to_csv(output_dir / "thailand_province_sample_counts.csv", index=False)

    mapped = province_counts[province_counts["mapped_on_thailand_map"]].copy()
    if mapped.empty:
        return province_counts

    fig, ax = plt.subplots(figsize=(8.5, 10))
    outline = np.array(THAILAND_OUTLINE_LON_LAT)
    ax.fill(
        outline[:, 0],
        outline[:, 1],
        color=GFS_BG_ALT,
        edgecolor=GFS_MAROON_DARK,
        linewidth=1.6,
        alpha=0.92,
        zorder=1,
    )
    ax.plot(outline[:, 0], outline[:, 1], color=GFS_MAROON_DARK, linewidth=1.2, zorder=2)

    max_samples = max(int(mapped["unique_samples"].max()), 1)
    sizes = 95 + (mapped["unique_samples"] / max_samples) * 850
    scatter = ax.scatter(
        mapped["longitude"],
        mapped["latitude"],
        s=sizes,
        c=mapped["unique_samples"],
        cmap="YlOrRd",
        edgecolors=GFS_MAROON_DARK,
        linewidths=0.9,
        alpha=0.88,
        zorder=4,
    )

    top_labels = mapped.head(10)
    for _, row in top_labels.iterrows():
        ax.annotate(
            f"{row['mapped_province']}\n{int(row['unique_samples'])}",
            xy=(row["longitude"], row["latitude"]),
            xytext=(4, 4),
            textcoords="offset points",
            fontsize=8,
            color=GFS_CHARCOAL,
            zorder=5,
        )

    omitted = province_counts[~province_counts["mapped_on_thailand_map"]]
    omitted_samples = int(omitted["unique_samples"].sum()) if not omitted.empty else 0
    ax.text(
        97.7,
        5.7,
        f"Mapped Thai provinces: {mapped.shape[0]}\n"
        f"Mapped samples: {int(mapped['unique_samples'].sum()):,}\n"
        f"Unmapped/non-Thai samples: {omitted_samples:,}",
        fontsize=9,
        color=GFS_CHARCOAL,
        bbox={"boxstyle": "round,pad=0.45", "facecolor": "white", "edgecolor": "#E5DFD2", "alpha": 0.92},
        zorder=6,
    )
    ax.set_title("Thailand sample count by province", loc="left", pad=16)
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_xlim(97.2, 106.0)
    ax.set_ylim(5.4, 21.0)
    ax.set_aspect("equal", adjustable="box")
    ax.grid(alpha=0.25)
    ax.spines[["top", "right"]].set_visible(False)
    colorbar = fig.colorbar(scatter, ax=ax, shrink=0.72, pad=0.03)
    colorbar.set_label("Unique samples")
    save_current(output_dir / "09_thailand_sample_count_by_province_map.png")
    return province_counts


def plot_context_coverage(df: pd.DataFrame, output_dir: Path) -> None:
    coverage = pd.DataFrame([
        {
            "metric": "Detected toxin value",
            "percentage": df["detected"].mean() * 100,
        },
        {
            "metric": "Below LOD / zero / imported empty",
            "percentage": df["below_lod_or_zero_or_imported_empty"].mean() * 100,
        },
        {
            "metric": "Usable area/date context",
            "percentage": df["usable_context"].mean() * 100,
        },
        {
            "metric": "Weather observations",
            "percentage": (df["weather_days_observed_90d"] > 0).mean() * 100,
        },
    ])
    plot_horizontal_bar(
        coverage.sort_values("percentage", ascending=False),
        path=output_dir / "08_data_coverage_overview.png",
        title="Data coverage overview",
        x_col="percentage",
        y_col="metric",
        x_label="Rows (%)",
        value_format="{:.1f}%",
        color=GFS_GOLD,
        figsize=(9, 4.8),
    )


def write_graph_summary(
    output_dir: Path,
    *,
    df: pd.DataFrame,
    toxin_stats: pd.DataFrame,
    concentration_stats: pd.DataFrame,
    province_map_stats: pd.DataFrame,
) -> None:
    detected_rows = int(df["detected"].sum())
    below_rows = int(df["below_lod_or_zero_or_imported_empty"].sum())
    weather_rows = int((df["weather_days_observed_90d"] > 0).sum())
    top_toxins = toxin_stats.head(8)
    top_concentrations = concentration_stats.head(8) if not concentration_stats.empty else pd.DataFrame()
    mapped_province_stats = (
        province_map_stats[province_map_stats["mapped_on_thailand_map"]]
        if not province_map_stats.empty
        else pd.DataFrame()
    )

    lines = [
        "# Matplotlib EDA graph summary",
        "",
        "Generated by `EDA/prediction_eda_matplotlib.py` using pandas, numpy, and matplotlib.",
        "",
        "## Dataset overview",
        "",
        f"- Unique samples: {df['sample_id'].nunique():,}",
        f"- Sample/toxin rows: {len(df):,}",
        f"- Mycotoxin targets: {df['toxin_type'].nunique():,}",
        f"- Detected toxin rows: {detected_rows:,} ({detected_rows / len(df) * 100:.1f}%)",
        f"- Below LOD / zero / imported-empty rows: {below_rows:,} ({below_rows / len(df) * 100:.1f}%)",
        f"- Rows with weather observations: {weather_rows:,} ({weather_rows / len(df) * 100:.1f}%)",
        "",
        "## Highest detected-count toxins",
        "",
        "| Toxin | Label | Detected | Detection % | Below LOD / zero / imported-empty % |",
        "|---|---|---:|---:|---:|",
    ]
    for _, row in top_toxins.iterrows():
        lines.append(
            f"| {row['toxin_type']} | {row['toxin_label']} | {int(row['detected']):,} | "
            f"{row['detection_rate'] * 100:.1f}% | "
            f"{row['below_lod_or_zero_or_imported_empty_rate'] * 100:.1f}% |"
        )

    lines.extend([
        "",
        "## Positive concentration highlights",
        "",
        "| Toxin | Label | Positive rows | Median ug/kg | Mean ug/kg | Max ug/kg |",
        "|---|---|---:|---:|---:|---:|",
    ])
    for _, row in top_concentrations.iterrows():
        lines.append(
            f"| {row['toxin_type']} | {row['toxin_label']} | {int(row['positive_rows']):,} | "
            f"{row['median_positive']:.2f} | {row['mean_positive']:.2f} | {row['max_positive']:.2f} |"
        )

    lines.extend([
        "",
        "## Thailand province sample-count map",
        "",
        "`09_thailand_sample_count_by_province_map.png` is a centroid bubble map. "
        "Bubble size and color represent the number of unique historical samples recorded for each Thai province. "
        "It is intended for EDA and presentation; it is not an administrative-boundary choropleth.",
        "",
        "| Province | Unique samples | Toxin-result rows | Detected rows |",
        "|---|---:|---:|---:|",
    ])
    for _, row in mapped_province_stats.head(10).iterrows():
        lines.append(
            f"| {row['mapped_province']} | {int(row['unique_samples']):,} | "
            f"{int(row['toxin_result_rows']):,} | {int(row['detected_rows']):,} |"
        )

    lines.extend([
        "",
        "## Graph files",
        "",
        "- `01_toxin_detected_counts.png`",
        "- `02_toxin_detection_percentage.png`",
        "- `03_toxin_below_lod_zero_imported_empty_percentage.png`",
        "- `04_toxin_mean_positive_concentration.png`",
        "- `05_toxin_positive_concentration_boxplot.png`",
        "- `06_commodity_detection_percentage.png`",
        "- `07_monthly_detection_trend.png`",
        "- `08_data_coverage_overview.png`",
        "- `09_thailand_sample_count_by_province_map.png`",
        "- `individual_toxin_concentration/*.png`",
        "- `individual_toxin_spatial_concentration/*.png`",
        "",
    ])
    (output_dir / "graph_summary.md").write_text("\n".join(lines), encoding="utf-8")


def safe_filename(value: str) -> str:
    safe = "".join(character if character.isalnum() or character in {"-", "_"} else "_" for character in value)
    return safe.strip("_") or "unknown"


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    apply_style()

    df = read_dataset(input_path)
    toxin_stats = toxin_summary(df)
    concentration_stats = concentration_summary(df)
    toxins = [item.strip() for item in args.toxins.split(",") if item.strip()]

    toxin_stats.to_csv(output_dir / "toxin_detection_missingness_summary.csv", index=False)
    if not concentration_stats.empty:
        concentration_stats.to_csv(output_dir / "toxin_positive_concentration_summary.csv", index=False)

    plot_toxin_detection(toxin_stats, output_dir, args.top_n)
    plot_concentration_overview(df, concentration_stats, output_dir, args.top_n)
    plot_individual_toxin_distributions(df, toxins, output_dir)
    plot_commodity_and_month(df, output_dir, args.top_n)
    plot_spatial_concentration(df, toxins, output_dir)
    plot_context_coverage(df, output_dir)
    province_map_stats = plot_thailand_sample_count_map(df, output_dir)
    write_graph_summary(
        output_dir,
        df=df,
        toxin_stats=toxin_stats,
        concentration_stats=concentration_stats,
        province_map_stats=province_map_stats,
    )

    print(f"Read {len(df):,} rows from {input_path}")
    print(f"Wrote matplotlib graphs to {output_dir}")


if __name__ == "__main__":
    main()
