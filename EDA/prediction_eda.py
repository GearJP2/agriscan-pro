#!/usr/bin/env python3
"""Exploratory data analysis for the prediction training dataset.

The script intentionally uses only the Python standard library so it can run in
the project environment without adding pandas/matplotlib as dependencies.
It reads the model-ready prediction CSV and writes summary tables plus simple
SVG plots for presentation/review.
"""

from __future__ import annotations

import argparse
import csv
import html
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


DEFAULT_INPUT = Path("backend/prediction_dataset.csv")
DEFAULT_OUTPUT = Path("EDA/output")
MIN_ROWS_FOR_RATE_CHART = 10
SPATIAL_TOP_N = 15
HISTOGRAM_BINS = 12


@dataclass
class ToxinSummary:
    toxin_type: str
    toxin_label: str
    measured: int
    detected: int
    below_lod_or_zero: int
    usable_context: int

    @property
    def detection_rate(self) -> float:
        return safe_divide(self.detected, self.measured)

    @property
    def usable_context_rate(self) -> float:
        return safe_divide(self.usable_context, self.measured)


@dataclass
class GroupSummary:
    name: str
    measured: int
    detected: int
    sample_count: int

    @property
    def detection_rate(self) -> float:
        return safe_divide(self.detected, self.measured)


@dataclass
class ConcentrationSummary:
    toxin_type: str
    toxin_label: str
    measured: int
    detected: int
    below_lod_or_zero: int
    min_positive: float
    p25_positive: float
    median_positive: float
    p75_positive: float
    max_positive: float
    mean_positive: float

    @property
    def below_lod_or_zero_rate(self) -> float:
        return safe_divide(self.below_lod_or_zero, self.measured)

    @property
    def detection_rate(self) -> float:
        return safe_divide(self.detected, self.measured)


@dataclass
class SpatialSummary:
    toxin_type: str
    toxin_label: str
    province: str
    measured: int
    detected: int
    mean_positive_concentration: float
    max_positive_concentration: float

    @property
    def detection_rate(self) -> float:
        return safe_divide(self.detected, self.measured)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate EDA summaries and SVG plots for prediction data.",
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help=f"Prediction dataset CSV path. Default: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT),
        help=f"Directory for generated EDA outputs. Default: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=20,
        help="Number of top rows to show in plots. Default: 20",
    )
    return parser.parse_args()


def read_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise SystemExit(
            f"Input CSV not found: {path}\n"
            "Generate it first with:\n"
            "docker compose exec backend python manage.py "
            "build_prediction_dataset --include-weather --output prediction_dataset.csv"
        )

    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def safe_int(value: str | int | None) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def safe_float(value: str | int | float | None) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def safe_divide(numerator: int | float, denominator: int | float) -> float:
    return float(numerator) / float(denominator) if denominator else 0.0


def clean_label(value: str | None, fallback: str = "Unknown") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def format_pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def pct_number(value: float) -> str:
    return f"{value * 100:.1f}"


def summarize_toxins(rows: list[dict[str, str]]) -> list[ToxinSummary]:
    grouped: dict[str, dict[str, int | str]] = {}
    for row in rows:
        toxin = clean_label(row.get("toxin_type"))
        if toxin not in grouped:
            grouped[toxin] = {
                "toxin_label": clean_label(row.get("toxin_label"), toxin),
                "measured": 0,
                "detected": 0,
                "below_lod_or_zero": 0,
                "usable_context": 0,
            }

        grouped[toxin]["measured"] = int(grouped[toxin]["measured"]) + 1
        grouped[toxin]["detected"] = int(grouped[toxin]["detected"]) + safe_int(row.get("detected"))
        grouped[toxin]["below_lod_or_zero"] = (
            int(grouped[toxin]["below_lod_or_zero"])
            + int(safe_float(row.get("concentration_ug_kg")) <= 0)
        )
        grouped[toxin]["usable_context"] = (
            int(grouped[toxin]["usable_context"])
            + safe_int(row.get("usable_context"))
        )

    summaries = [
        ToxinSummary(
            toxin_type=toxin,
            toxin_label=str(values["toxin_label"]),
            measured=int(values["measured"]),
            detected=int(values["detected"]),
            below_lod_or_zero=int(values["below_lod_or_zero"]),
            usable_context=int(values["usable_context"]),
        )
        for toxin, values in grouped.items()
    ]
    return sorted(summaries, key=lambda item: (-item.detected, item.toxin_type))


def summarize_group(rows: list[dict[str, str]], field: str) -> list[GroupSummary]:
    measured = Counter()
    detected = Counter()
    sample_ids: dict[str, set[str]] = defaultdict(set)

    for row in rows:
        name = clean_label(row.get(field))
        sample_id = clean_label(row.get("sample_id"))
        measured[name] += 1
        detected[name] += safe_int(row.get("detected"))
        sample_ids[name].add(sample_id)

    summaries = [
        GroupSummary(
            name=name,
            measured=count,
            detected=detected[name],
            sample_count=len(sample_ids[name]),
        )
        for name, count in measured.items()
    ]
    return sorted(summaries, key=lambda item: (-item.detected, -item.measured, item.name))


def percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = (len(sorted_values) - 1) * pct
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return sorted_values[int(position)]
    weight = position - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def summarize_concentrations(rows: list[dict[str, str]]) -> list[ConcentrationSummary]:
    grouped: dict[str, dict[str, object]] = {}
    for row in rows:
        toxin = clean_label(row.get("toxin_type"))
        if toxin not in grouped:
            grouped[toxin] = {
                "toxin_label": clean_label(row.get("toxin_label"), toxin),
                "measured": 0,
                "detected": 0,
                "below_lod_or_zero": 0,
                "positive_values": [],
            }

        value = safe_float(row.get("concentration_ug_kg"))
        grouped[toxin]["measured"] = int(grouped[toxin]["measured"]) + 1
        if value > 0:
            grouped[toxin]["detected"] = int(grouped[toxin]["detected"]) + 1
            positive_values = grouped[toxin]["positive_values"]
            assert isinstance(positive_values, list)
            positive_values.append(value)
        else:
            grouped[toxin]["below_lod_or_zero"] = int(grouped[toxin]["below_lod_or_zero"]) + 1

    summaries = []
    for toxin, values in grouped.items():
        positive_values = values["positive_values"]
        assert isinstance(positive_values, list)
        sorted_values = sorted(float(value) for value in positive_values)
        mean_positive = safe_divide(sum(sorted_values), len(sorted_values))
        summaries.append(
            ConcentrationSummary(
                toxin_type=toxin,
                toxin_label=str(values["toxin_label"]),
                measured=int(values["measured"]),
                detected=int(values["detected"]),
                below_lod_or_zero=int(values["below_lod_or_zero"]),
                min_positive=round(sorted_values[0], 6) if sorted_values else 0.0,
                p25_positive=round(percentile(sorted_values, 0.25), 6),
                median_positive=round(percentile(sorted_values, 0.50), 6),
                p75_positive=round(percentile(sorted_values, 0.75), 6),
                max_positive=round(sorted_values[-1], 6) if sorted_values else 0.0,
                mean_positive=round(mean_positive, 6),
            )
        )

    return sorted(summaries, key=lambda item: (-item.detected, item.toxin_type))


def summarize_spatial_concentration(rows: list[dict[str, str]]) -> list[SpatialSummary]:
    grouped: dict[tuple[str, str], dict[str, object]] = {}
    for row in rows:
        toxin = clean_label(row.get("toxin_type"))
        province = clean_label(row.get("province"), "Unspecified area")
        key = (toxin, province)
        if key not in grouped:
            grouped[key] = {
                "toxin_label": clean_label(row.get("toxin_label"), toxin),
                "measured": 0,
                "detected": 0,
                "positive_values": [],
            }

        value = safe_float(row.get("concentration_ug_kg"))
        grouped[key]["measured"] = int(grouped[key]["measured"]) + 1
        if value > 0:
            grouped[key]["detected"] = int(grouped[key]["detected"]) + 1
            positive_values = grouped[key]["positive_values"]
            assert isinstance(positive_values, list)
            positive_values.append(value)

    summaries = []
    for (toxin, province), values in grouped.items():
        positive_values = values["positive_values"]
        assert isinstance(positive_values, list)
        numeric_values = [float(value) for value in positive_values]
        summaries.append(
            SpatialSummary(
                toxin_type=toxin,
                toxin_label=str(values["toxin_label"]),
                province=province,
                measured=int(values["measured"]),
                detected=int(values["detected"]),
                mean_positive_concentration=round(safe_divide(sum(numeric_values), len(numeric_values)), 6),
                max_positive_concentration=round(max(numeric_values), 6) if numeric_values else 0.0,
            )
        )
    return sorted(
        summaries,
        key=lambda item: (
            item.toxin_type,
            -item.detected,
            -item.mean_positive_concentration,
            item.province,
        ),
    )


def summarize_months(rows: list[dict[str, str]]) -> list[dict[str, str | int | float]]:
    measured = Counter()
    detected = Counter()
    sample_ids: dict[str, set[str]] = defaultdict(set)

    for row in rows:
        year = clean_label(row.get("collection_year"), "")
        month = clean_label(row.get("collection_month"), "")
        if not year or not month:
            key = "Unknown"
        else:
            key = f"{year}-{int(float(month)):02d}"
        measured[key] += 1
        detected[key] += safe_int(row.get("detected"))
        sample_ids[key].add(clean_label(row.get("sample_id")))

    def sort_key(value: str) -> tuple[int, str]:
        return (1, value) if value == "Unknown" else (0, value)

    return [
        {
            "period": key,
            "measured": measured[key],
            "detected": detected[key],
            "sample_count": len(sample_ids[key]),
            "detection_rate": safe_divide(detected[key], measured[key]),
        }
        for key in sorted(measured, key=sort_key)
    ]


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_toxin_summary(path: Path, summaries: list[ToxinSummary]) -> None:
    write_csv(
        path,
        [
            "toxin_type",
            "toxin_label",
            "measured",
            "detected",
            "below_lod_or_zero",
            "below_lod_or_zero_rate",
            "detection_rate",
            "usable_context",
            "usable_context_rate",
        ],
        (
            {
                "toxin_type": item.toxin_type,
                "toxin_label": item.toxin_label,
                "measured": item.measured,
                "detected": item.detected,
                "below_lod_or_zero": item.below_lod_or_zero,
                "below_lod_or_zero_rate": round(safe_divide(item.below_lod_or_zero, item.measured), 6),
                "detection_rate": round(item.detection_rate, 6),
                "usable_context": item.usable_context,
                "usable_context_rate": round(item.usable_context_rate, 6),
            }
            for item in summaries
        ),
    )


def write_concentration_summary(path: Path, summaries: list[ConcentrationSummary]) -> None:
    write_csv(
        path,
        [
            "toxin_type",
            "toxin_label",
            "measured",
            "detected",
            "below_lod_or_zero",
            "below_lod_or_zero_rate",
            "detection_rate",
            "min_positive_ug_kg",
            "p25_positive_ug_kg",
            "median_positive_ug_kg",
            "p75_positive_ug_kg",
            "max_positive_ug_kg",
            "mean_positive_ug_kg",
        ],
        (
            {
                "toxin_type": item.toxin_type,
                "toxin_label": item.toxin_label,
                "measured": item.measured,
                "detected": item.detected,
                "below_lod_or_zero": item.below_lod_or_zero,
                "below_lod_or_zero_rate": round(item.below_lod_or_zero_rate, 6),
                "detection_rate": round(item.detection_rate, 6),
                "min_positive_ug_kg": item.min_positive,
                "p25_positive_ug_kg": item.p25_positive,
                "median_positive_ug_kg": item.median_positive,
                "p75_positive_ug_kg": item.p75_positive,
                "max_positive_ug_kg": item.max_positive,
                "mean_positive_ug_kg": item.mean_positive,
            }
            for item in summaries
        ),
    )


def write_spatial_summary(path: Path, summaries: list[SpatialSummary]) -> None:
    write_csv(
        path,
        [
            "toxin_type",
            "toxin_label",
            "province",
            "measured",
            "detected",
            "detection_rate",
            "mean_positive_concentration_ug_kg",
            "max_positive_concentration_ug_kg",
        ],
        (
            {
                "toxin_type": item.toxin_type,
                "toxin_label": item.toxin_label,
                "province": item.province,
                "measured": item.measured,
                "detected": item.detected,
                "detection_rate": round(item.detection_rate, 6),
                "mean_positive_concentration_ug_kg": item.mean_positive_concentration,
                "max_positive_concentration_ug_kg": item.max_positive_concentration,
            }
            for item in summaries
        ),
    )


def write_detected_spatial_summary(path: Path, summaries: list[SpatialSummary]) -> None:
    write_spatial_summary(
        path,
        sorted(
            [item for item in summaries if item.detected > 0],
            key=lambda item: (
                item.toxin_type,
                -item.mean_positive_concentration,
                -item.detected,
                item.province,
            ),
        ),
    )


def write_group_summary(path: Path, summaries: list[GroupSummary]) -> None:
    write_csv(
        path,
        ["name", "sample_count", "measured", "detected", "detection_rate"],
        (
            {
                "name": item.name,
                "sample_count": item.sample_count,
                "measured": item.measured,
                "detected": item.detected,
                "detection_rate": round(item.detection_rate, 6),
            }
            for item in summaries
        ),
    )


def write_month_summary(path: Path, rows: list[dict[str, str | int | float]]) -> None:
    write_csv(
        path,
        ["period", "sample_count", "measured", "detected", "detection_rate"],
        (
            {
                **row,
                "detection_rate": round(float(row["detection_rate"]), 6),
            }
            for row in rows
        ),
    )


def svg_bar_chart(
    path: Path,
    title: str,
    rows: list[tuple[str, float, str]],
    *,
    x_label: str,
    width: int = 1100,
    row_height: int = 34,
    margin_left: int = 260,
    margin_right: int = 120,
) -> None:
    if not rows:
        path.write_text(empty_svg(title), encoding="utf-8")
        return

    max_value = max(value for _, value, _ in rows) or 1
    chart_width = width - margin_left - margin_right
    height = 90 + len(rows) * row_height
    title_y = 34
    axis_y = height - 36
    parts = [
        svg_header(width, height),
        f'<text x="24" y="{title_y}" class="title">{html.escape(title)}</text>',
        f'<text x="{margin_left}" y="{height - 12}" class="axis">{html.escape(x_label)}</text>',
    ]

    for index, (label, value, display) in enumerate(rows):
        y = 64 + index * row_height
        bar_width = int(chart_width * safe_divide(value, max_value))
        parts.append(f'<text x="24" y="{y + 18}" class="label">{html.escape(label)}</text>')
        parts.append(
            f'<rect x="{margin_left}" y="{y}" width="{bar_width}" height="22" '
            'rx="5" class="bar" />'
        )
        parts.append(
            f'<text x="{margin_left + bar_width + 8}" y="{y + 16}" '
            f'class="value">{html.escape(display)}</text>'
        )

    parts.append(f'<line x1="{margin_left}" y1="{axis_y}" x2="{width - margin_right}" y2="{axis_y}" class="axis-line" />')
    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")


def svg_line_chart(
    path: Path,
    title: str,
    rows: list[dict[str, str | int | float]],
    *,
    width: int = 1100,
    height: int = 430,
) -> None:
    if not rows:
        path.write_text(empty_svg(title), encoding="utf-8")
        return

    margin_left = 70
    margin_right = 40
    margin_top = 70
    margin_bottom = 90
    chart_width = width - margin_left - margin_right
    chart_height = height - margin_top - margin_bottom
    max_rate = max(float(row["detection_rate"]) for row in rows) or 1
    max_rate = max(max_rate, 0.01)

    points = []
    for index, row in enumerate(rows):
        x = margin_left + chart_width * safe_divide(index, max(1, len(rows) - 1))
        y = margin_top + chart_height * (1 - safe_divide(float(row["detection_rate"]), max_rate))
        points.append((x, y, str(row["period"]), float(row["detection_rate"])))

    path_data = " ".join(
        f"{'M' if index == 0 else 'L'} {x:.1f} {y:.1f}"
        for index, (x, y, _, _) in enumerate(points)
    )

    parts = [
        svg_header(width, height),
        f'<text x="24" y="34" class="title">{html.escape(title)}</text>',
        f'<line x1="{margin_left}" y1="{margin_top}" x2="{margin_left}" y2="{height - margin_bottom}" class="axis-line" />',
        f'<line x1="{margin_left}" y1="{height - margin_bottom}" x2="{width - margin_right}" y2="{height - margin_bottom}" class="axis-line" />',
        f'<path d="{path_data}" class="line" />',
    ]

    for x, y, period, rate in points:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" class="point" />')
        parts.append(
            f'<title>{html.escape(period)}: {format_pct(rate)}</title>'
        )

    tick_count = 5
    for tick in range(tick_count + 1):
        rate = max_rate * tick / tick_count
        y = margin_top + chart_height * (1 - tick / tick_count)
        parts.append(f'<line x1="{margin_left - 4}" y1="{y:.1f}" x2="{margin_left}" y2="{y:.1f}" class="axis-line" />')
        parts.append(f'<text x="12" y="{y + 4:.1f}" class="axis">{pct_number(rate)}%</text>')

    label_step = max(1, math.ceil(len(points) / 10))
    for index, (x, _, period, _) in enumerate(points):
        if index % label_step == 0 or index == len(points) - 1:
            parts.append(
                f'<text x="{x:.1f}" y="{height - 58}" class="axis rotated" '
                f'transform="rotate(-35 {x:.1f},{height - 58})">{html.escape(period)}</text>'
            )

    parts.append('<text x="24" y="64" class="axis">Detection rate by collection period</text>')
    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")


def concentration_values_by_toxin(rows: list[dict[str, str]]) -> dict[str, dict[str, object]]:
    grouped: dict[str, dict[str, object]] = {}
    for row in rows:
        toxin = clean_label(row.get("toxin_type"))
        if toxin not in grouped:
            grouped[toxin] = {
                "toxin_label": clean_label(row.get("toxin_label"), toxin),
                "values": [],
            }
        value = safe_float(row.get("concentration_ug_kg"))
        if value > 0:
            values = grouped[toxin]["values"]
            assert isinstance(values, list)
            values.append(value)
    return grouped


def histogram_bins(values: list[float], bin_count: int = HISTOGRAM_BINS) -> list[tuple[str, int]]:
    if not values:
        return []
    minimum = min(values)
    maximum = max(values)
    if minimum == maximum:
        return [(f"{minimum:g}", len(values))]

    span = maximum - minimum
    bins = [0 for _ in range(bin_count)]
    for value in values:
        index = min(bin_count - 1, int(((value - minimum) / span) * bin_count))
        bins[index] += 1

    labels = []
    for index, count in enumerate(bins):
        start = minimum + span * index / bin_count
        end = minimum + span * (index + 1) / bin_count
        labels.append((f"{start:.2g}–{end:.2g}", count))
    return labels


def write_concentration_distribution_plots(
    output_dir: Path,
    rows: list[dict[str, str]],
    toxins: list[ToxinSummary],
) -> None:
    distribution_dir = output_dir / "concentration_distribution_by_toxin"
    distribution_dir.mkdir(parents=True, exist_ok=True)
    values_by_toxin = concentration_values_by_toxin(rows)

    for toxin in toxins:
        payload = values_by_toxin.get(toxin.toxin_type, {})
        values = payload.get("values", [])
        assert isinstance(values, list)
        bins = histogram_bins([float(value) for value in values])
        svg_bar_chart(
            distribution_dir / f"{safe_filename(toxin.toxin_type)}_concentration_distribution.svg",
            f"{toxin.toxin_type} concentration distribution",
            [
                (
                    label,
                    float(count),
                    f"{count:,} positive row(s)",
                )
                for label, count in bins
            ],
            x_label="Positive rows per concentration bin (ug/kg)",
            width=1000,
            margin_left=160,
        )


def write_spatial_plots(
    output_dir: Path,
    spatial: list[SpatialSummary],
    toxins: list[ToxinSummary],
) -> None:
    spatial_dir = output_dir / "spatial_concentration_by_toxin"
    spatial_dir.mkdir(parents=True, exist_ok=True)
    by_toxin: dict[str, list[SpatialSummary]] = defaultdict(list)
    for item in spatial:
        by_toxin[item.toxin_type].append(item)

    for toxin in toxins:
        province_rows = [
            item for item in by_toxin.get(toxin.toxin_type, [])
            if item.detected > 0 and item.province.lower() not in {"unknown", "unspecified area"}
        ][:SPATIAL_TOP_N]
        svg_bar_chart(
            spatial_dir / f"{safe_filename(toxin.toxin_type)}_province_concentration.svg",
            f"{toxin.toxin_type} mean positive concentration by province",
            [
                (
                    item.province,
                    item.mean_positive_concentration,
                    (
                        f"mean {item.mean_positive_concentration:g} ug/kg; "
                        f"max {item.max_positive_concentration:g}; "
                        f"{item.detected}/{item.measured} detected"
                    ),
                )
                for item in province_rows
            ],
            x_label="Mean positive concentration (ug/kg)",
            width=1100,
            margin_left=220,
        )


def safe_filename(value: str) -> str:
    safe = "".join(character if character.isalnum() or character in {"-", "_"} else "_" for character in value)
    return safe.strip("_") or "unknown"


def svg_header(width: int, height: int) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">
<style>
  .title {{ font: 700 22px system-ui, -apple-system, Segoe UI, sans-serif; fill: #1f1f1f; }}
  .label {{ font: 500 13px system-ui, -apple-system, Segoe UI, sans-serif; fill: #2a3142; }}
  .value {{ font: 600 13px system-ui, -apple-system, Segoe UI, sans-serif; fill: #7A1517; }}
  .axis {{ font: 12px system-ui, -apple-system, Segoe UI, sans-serif; fill: #6b6b6b; }}
  .bar {{ fill: #9F1D20; }}
  .line {{ fill: none; stroke: #9F1D20; stroke-width: 3; }}
  .point {{ fill: #F4B41A; stroke: #7A1517; stroke-width: 1.5; }}
  .axis-line {{ stroke: #e5dfd2; stroke-width: 1; }}
</style>
<rect width="100%" height="100%" fill="#ffffff" />
'''


def empty_svg(title: str) -> str:
    return (
        svg_header(900, 220)
        + f'<text x="24" y="34" class="title">{html.escape(title)}</text>\n'
        + '<text x="24" y="82" class="label">No data available.</text>\n'
        + "</svg>\n"
    )


def write_summary_markdown(
    path: Path,
    *,
    input_path: Path,
    rows: list[dict[str, str]],
    toxins: list[ToxinSummary],
    concentrations: list[ConcentrationSummary],
    spatial: list[SpatialSummary],
    commodities: list[GroupSummary],
    provinces: list[GroupSummary],
    months: list[dict[str, str | int | float]],
) -> None:
    sample_ids = {row.get("sample_id", "") for row in rows if row.get("sample_id")}
    detected_rows = sum(safe_int(row.get("detected")) for row in rows)
    usable_context_rows = sum(safe_int(row.get("usable_context")) for row in rows)
    weather_rows = sum(1 for row in rows if safe_int(row.get("weather_days_observed_90d")) > 0)
    detected_toxins = [item for item in toxins if item.detected > 0]
    high_missing_toxins = sorted(
        concentrations,
        key=lambda item: (-item.below_lod_or_zero_rate, item.toxin_type),
    )
    eligible_like = [
        item for item in toxins
        if item.detected >= 30 and item.below_lod_or_zero >= 30 and item.usable_context >= 60
    ]
    detected_spatial = sorted(
        [
            item for item in spatial
            if item.detected > 0 and item.province.lower() not in {"unknown", "unspecified area"}
        ],
        key=lambda item: (-item.mean_positive_concentration, -item.detected, item.toxin_type, item.province),
    )

    lines = [
        "# Prediction dataset EDA summary",
        "",
        f"Input file: `{input_path}`",
        "",
        "## Dataset size",
        "",
        f"- Unique samples: {len(sample_ids):,}",
        f"- Sample/toxin rows: {len(rows):,}",
        f"- Mycotoxin targets: {len(toxins):,}",
        f"- Rows with detected toxin value: {detected_rows:,} ({format_pct(safe_divide(detected_rows, len(rows)))})",
        (
            "- Rows recorded as below LOD / zero / imported empty: "
            f"{len(rows) - detected_rows:,} ({format_pct(safe_divide(len(rows) - detected_rows, len(rows)))})"
        ),
        f"- Rows with usable area/date context: {usable_context_rows:,} ({format_pct(safe_divide(usable_context_rows, len(rows)))})",
        f"- Rows with weather observations: {weather_rows:,} ({format_pct(safe_divide(weather_rows, len(rows)))})",
        "",
        "## Training readiness signal",
        "",
        (
            f"- Toxins with at least one detection: {len(detected_toxins):,} / {len(toxins):,}"
        ),
        (
            "- Toxins that roughly meet the current baseline guardrails "
            f"(>=30 detected, >=30 below LOD/zero, >=60 usable context): {len(eligible_like):,}"
        ),
        "",
        "This supports the current conservative product decision: use the model for "
        "sampling prioritization, not complete safety prediction.",
        "",
        "## Top detected toxin targets",
        "",
        "| Toxin | Label | Measured | Detected | Detection rate | Usable context |",
        "|---|---|---:|---:|---:|---:|",
    ]

    for item in toxins[:15]:
        lines.append(
            f"| {item.toxin_type} | {item.toxin_label} | {item.measured:,} | "
            f"{item.detected:,} | {format_pct(item.detection_rate)} | "
            f"{format_pct(item.usable_context_rate)} |"
        )

    lines.extend([
        "",
        "## Highest below-LOD / zero / imported-empty percentages",
        "",
        "For the provided historical CSV, empty mycotoxin cells were imported as below LOD / zero-equivalent values.",
        "",
        "| Toxin | Label | Measured | Below LOD / zero / imported empty | Percentage | Detected |",
        "|---|---|---:|---:|---:|---:|",
    ])

    for item in high_missing_toxins[:15]:
        lines.append(
            f"| {item.toxin_type} | {item.toxin_label} | {item.measured:,} | "
            f"{item.below_lod_or_zero:,} | {format_pct(item.below_lod_or_zero_rate)} | "
            f"{item.detected:,} |"
        )

    lines.extend([
        "",
        "## Positive concentration distribution summary",
        "",
        "These statistics use detected positive concentration values only.",
        "",
        "| Toxin | Label | Positive rows | Median ug/kg | P75 ug/kg | Max ug/kg | Mean ug/kg |",
        "|---|---|---:|---:|---:|---:|---:|",
    ])

    for item in concentrations[:15]:
        lines.append(
            f"| {item.toxin_type} | {item.toxin_label} | {item.detected:,} | "
            f"{item.median_positive:g} | {item.p75_positive:g} | "
            f"{item.max_positive:g} | {item.mean_positive:g} |"
        )

    lines.extend([
        "",
        "## Spatial concentration highlights",
        "",
        "These rows show detected province-level concentration signals only. Unknown or unspecified locations are excluded from this table.",
        "",
        "| Toxin | Province | Measured | Detected | Detection rate | Mean positive ug/kg | Max positive ug/kg |",
        "|---|---|---:|---:|---:|---:|---:|",
    ])

    for item in detected_spatial[:20]:
        lines.append(
            f"| {item.toxin_type} | {item.province} | {item.measured:,} | "
            f"{item.detected:,} | {format_pct(item.detection_rate)} | "
            f"{item.mean_positive_concentration:g} | {item.max_positive_concentration:g} |"
        )

    lines.extend([
        "",
        "## Top commodities by detected rows",
        "",
        "| Commodity | Samples | Measured rows | Detected rows | Detection rate |",
        "|---|---:|---:|---:|---:|",
    ])

    for item in commodities[:15]:
        lines.append(
            f"| {item.name} | {item.sample_count:,} | {item.measured:,} | "
            f"{item.detected:,} | {format_pct(item.detection_rate)} |"
        )

    lines.extend([
        "",
        "## Top provinces by detected rows",
        "",
        "| Province | Samples | Measured rows | Detected rows | Detection rate |",
        "|---|---:|---:|---:|---:|",
    ])

    for item in provinces[:15]:
        lines.append(
            f"| {item.name} | {item.sample_count:,} | {item.measured:,} | "
            f"{item.detected:,} | {format_pct(item.detection_rate)} |"
        )

    if months:
        first_period = months[0]["period"]
        last_period = months[-1]["period"]
        lines.extend([
            "",
            "## Collection-period coverage",
            "",
            f"- First period: {first_period}",
            f"- Last period: {last_period}",
            f"- Number of periods: {len(months):,}",
        ])

    lines.extend([
        "",
        "## Presentation caution",
        "",
        "EDA trends are historical signals. They should be used to explain data "
        "coverage, imbalance, and model feasibility. They are not lab-confirmed "
        "future predictions by themselves.",
        "",
    ])

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    rows = read_rows(input_path)
    toxins = summarize_toxins(rows)
    concentrations = summarize_concentrations(rows)
    spatial = summarize_spatial_concentration(rows)
    commodities = summarize_group(rows, "commodity")
    provinces = summarize_group(rows, "province")
    months = summarize_months(rows)

    write_toxin_summary(output_dir / "toxin_detection_summary.csv", toxins)
    write_concentration_summary(output_dir / "toxin_concentration_summary.csv", concentrations)
    write_spatial_summary(output_dir / "toxin_spatial_concentration_summary.csv", spatial)
    write_detected_spatial_summary(output_dir / "toxin_spatial_detected_only_summary.csv", spatial)
    write_group_summary(output_dir / "commodity_detection_summary.csv", commodities)
    write_group_summary(output_dir / "province_detection_summary.csv", provinces)
    write_month_summary(output_dir / "monthly_detection_summary.csv", months)

    top_toxins_by_rate = sorted(
        [item for item in toxins if item.measured >= MIN_ROWS_FOR_RATE_CHART],
        key=lambda item: (-item.detection_rate, -item.detected, item.toxin_type),
    )[:args.top_n]
    svg_bar_chart(
        output_dir / "top_toxin_detection_rates.svg",
        "Top toxin detection rates",
        [
            (
                f"{item.toxin_type} — {item.toxin_label}",
                item.detection_rate,
                f"{format_pct(item.detection_rate)} ({item.detected}/{item.measured})",
            )
            for item in top_toxins_by_rate
        ],
        x_label="Detection rate",
    )

    svg_bar_chart(
        output_dir / "top_toxin_detected_counts.svg",
        "Top toxin detected-row counts",
        [
            (
                f"{item.toxin_type} — {item.toxin_label}",
                float(item.detected),
                f"{item.detected:,} detected rows",
            )
            for item in toxins[:args.top_n]
        ],
        x_label="Detected rows",
    )

    top_toxins_by_below_lod = sorted(
        toxins,
        key=lambda item: (-safe_divide(item.below_lod_or_zero, item.measured), item.toxin_type),
    )[:args.top_n]
    svg_bar_chart(
        output_dir / "top_toxin_below_lod_or_empty_rates.svg",
        "Top below LOD / zero / imported-empty rates by toxin",
        [
            (
                f"{item.toxin_type} — {item.toxin_label}",
                safe_divide(item.below_lod_or_zero, item.measured),
                f"{format_pct(safe_divide(item.below_lod_or_zero, item.measured))} ({item.below_lod_or_zero}/{item.measured})",
            )
            for item in top_toxins_by_below_lod
        ],
        x_label="Below LOD / zero / imported-empty rate",
    )

    top_concentration_toxins = [
        item for item in concentrations
        if item.detected > 0
    ][:args.top_n]
    svg_bar_chart(
        output_dir / "top_toxin_mean_positive_concentrations.svg",
        "Top mean positive concentrations by toxin",
        [
            (
                f"{item.toxin_type} — {item.toxin_label}",
                item.mean_positive,
                f"mean {item.mean_positive:g} ug/kg; median {item.median_positive:g}",
            )
            for item in sorted(
                top_concentration_toxins,
                key=lambda item: (-item.mean_positive, item.toxin_type),
            )
        ],
        x_label="Mean positive concentration (ug/kg)",
    )

    top_commodities_by_rate = sorted(
        [item for item in commodities if item.sample_count >= 3],
        key=lambda item: (-item.detection_rate, -item.detected, item.name),
    )[:args.top_n]
    svg_bar_chart(
        output_dir / "top_commodity_detection_rates.svg",
        "Top commodity detection rates",
        [
            (
                item.name,
                item.detection_rate,
                f"{format_pct(item.detection_rate)} ({item.detected}/{item.measured})",
            )
            for item in top_commodities_by_rate
        ],
        x_label="Detection rate",
    )

    svg_line_chart(
        output_dir / "monthly_detection_trend.svg",
        "Monthly detection trend",
        months,
    )

    coverage_rows = [
        (
            "Usable area/date context",
            safe_divide(sum(safe_int(row.get("usable_context")) for row in rows), len(rows)),
            format_pct(safe_divide(sum(safe_int(row.get("usable_context")) for row in rows), len(rows))),
        ),
        (
            "Weather observations",
            safe_divide(sum(1 for row in rows if safe_int(row.get("weather_days_observed_90d")) > 0), len(rows)),
            format_pct(safe_divide(sum(1 for row in rows if safe_int(row.get("weather_days_observed_90d")) > 0), len(rows))),
        ),
        (
            "Exact coordinates",
            safe_divide(sum(safe_int(row.get("context_has_exact_coordinates")) for row in rows), len(rows)),
            format_pct(safe_divide(sum(safe_int(row.get("context_has_exact_coordinates")) for row in rows), len(rows))),
        ),
    ]
    svg_bar_chart(
        output_dir / "context_coverage.svg",
        "Prediction context coverage",
        coverage_rows,
        x_label="Share of sample/toxin rows",
        margin_left=260,
    )
    write_concentration_distribution_plots(output_dir, rows, toxins)
    write_spatial_plots(output_dir, spatial, toxins)

    write_summary_markdown(
        output_dir / "eda_summary.md",
        input_path=input_path,
        rows=rows,
        toxins=toxins,
        concentrations=concentrations,
        spatial=spatial,
        commodities=commodities,
        provinces=provinces,
        months=months,
    )

    print(f"Read {len(rows):,} sample/toxin rows from {input_path}")
    print(f"Wrote EDA outputs to {output_dir}")


if __name__ == "__main__":
    main()
