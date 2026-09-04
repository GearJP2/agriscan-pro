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
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
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
                "detection_rate": round(item.detection_rate, 6),
                "usable_context": item.usable_context,
                "usable_context_rate": round(item.usable_context_rate, 6),
            }
            for item in summaries
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
    commodities: list[GroupSummary],
    provinces: list[GroupSummary],
    months: list[dict[str, str | int | float]],
) -> None:
    sample_ids = {row.get("sample_id", "") for row in rows if row.get("sample_id")}
    detected_rows = sum(safe_int(row.get("detected")) for row in rows)
    usable_context_rows = sum(safe_int(row.get("usable_context")) for row in rows)
    weather_rows = sum(1 for row in rows if safe_int(row.get("weather_days_observed_90d")) > 0)
    detected_toxins = [item for item in toxins if item.detected > 0]
    eligible_like = [
        item for item in toxins
        if item.detected >= 30 and item.below_lod_or_zero >= 30 and item.usable_context >= 60
    ]

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
    commodities = summarize_group(rows, "commodity")
    provinces = summarize_group(rows, "province")
    months = summarize_months(rows)

    write_toxin_summary(output_dir / "toxin_detection_summary.csv", toxins)
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

    write_summary_markdown(
        output_dir / "eda_summary.md",
        input_path=input_path,
        rows=rows,
        toxins=toxins,
        commodities=commodities,
        provinces=provinces,
        months=months,
    )

    print(f"Read {len(rows):,} sample/toxin rows from {input_path}")
    print(f"Wrote EDA outputs to {output_dir}")


if __name__ == "__main__":
    main()
