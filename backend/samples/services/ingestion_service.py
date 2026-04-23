import csv
import logging
import re
from io import TextIOWrapper

from ..models import MycotoxinResult, ProcessLog, Sample

logger = logging.getLogger("agriscan.samples")

TOXIN_DEFAULTS = {
    "AFB1": {"threshold": 5.0, "unit": "ppb"},
    "AFB2": {"threshold": 5.0, "unit": "ppb"},
    "AFG1": {"threshold": 5.0, "unit": "ppb"},
    "AFG2": {"threshold": 5.0, "unit": "ppb"},
    "AFM1": {"threshold": 0.5, "unit": "ppb"},
    "AF": {"threshold": 5.0, "unit": "ppb"},
    "DON": {"threshold": 1000.0, "unit": "ppb"},
    "FB1": {"threshold": 2000.0, "unit": "ppb"},
    "T-2": {"threshold": 100.0, "unit": "ppb"},
    "ZEA": {"threshold": 200.0, "unit": "ppb"},
    "OTA": {"threshold": 5.0, "unit": "ppb"},
}

TOXIN_ALIASES = {
    "don": "DON",
    "deoxynivalenol": "DON",
    "afb1": "AFB1",
    "afb2": "AFB2",
    "afg1": "AFG1",
    "afg2": "AFG2",
    "afm1": "AFM1",
    "af": "AF",
    "aflatoxin": "AF",
    "fb1": "FB1",
    "t2": "T-2",
    "t-2": "T-2",
    "zea": "ZEA",
    "ota": "OTA",
}


def get_toxin_threshold(canonical: str | None) -> float:
    toxin_defaults = TOXIN_DEFAULTS.get(canonical or "", {})
    threshold = toxin_defaults.get("threshold", 0.0)
    return float(threshold)


def get_toxin_unit(canonical: str | None) -> str:
    toxin_defaults = TOXIN_DEFAULTS.get(canonical or "", {})
    unit = toxin_defaults.get("unit", "ppb")
    return str(unit)


class SampleIngestionService:
    @staticmethod
    def normalize_token(value):
        return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())

    @staticmethod
    def normalize_sample_id(value):
        if value is None:
            return ""
        text = str(value).strip().upper()
        text = (
            text.replace("\u2010", "-")
            .replace("\u2011", "-")
            .replace("\u2012", "-")
            .replace("\u2013", "-")
            .replace("\u2014", "-")
        )
        text = re.sub(r"\s+", "", text)
        parts = text.split("-")
        normalized_parts = [str(int(p)) if p.isdigit() else p for p in parts]
        return "-".join(normalized_parts)

    @staticmethod
    def is_datetime_like(value):
        text = str(value or "").strip()
        if not text:
            return False
        return bool(
            re.match(
                r"^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$", text
            )
            or re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", text)
        )

    @classmethod
    def looks_like_sample_id(cls, value):
        text = str(value or "").strip().upper()
        if not text:
            return False
        if cls.is_datetime_like(text):
            return False
        return bool(re.search(r"[A-Z]", text) and re.search(r"\d", text))

    @classmethod
    def get_row_value(cls, row, candidate_keys):
        normalized_map = {
            cls.normalize_token(k): v for k, v in (row or {}).items() if k is not None
        }
        for key in candidate_keys:
            if key in row:
                return row[key]
            norm_key = cls.normalize_token(key)
            if norm_key in normalized_map:
                return normalized_map[norm_key]
        return None

    @classmethod
    def extract_row_sample_id(cls, row):
        key_groups = [
            ["sample_id", "sample id", "sampleid", "sample code"],
            ["name"],
            ["sample"],
            [""],
        ]
        candidates = []

        for keys in key_groups:
            val = cls.get_row_value(row, keys)
            if not val:
                continue
            norm = cls.normalize_sample_id(val)
            if not norm or norm in {
                "NAME",
                "SAMPLE",
                "DATE",
                "DATETIME",
                "ACQDATETIME",
            }:
                continue
            candidates.append((str(val).strip(), norm))

        if not candidates:
            return "", ""

        for display, norm in candidates:
            if cls.looks_like_sample_id(display):
                return display, norm

        for display, norm in candidates:
            if not cls.is_datetime_like(display):
                return display, norm

        return candidates[0]

    @classmethod
    def extract_analyzed_datetime(cls, row):
        explicit = cls.get_row_value(
            row,
            [
                "analyzed_at",
                "analyzed at",
                "analysis_datetime",
                "analysis datetime",
                "acq. date-time",
                "acq date-time",
                "acq_datetime",
                "datetime",
            ],
        )
        if explicit and str(explicit).strip():
            return str(explicit).strip()

        # New lab layout keeps analyzed datetime in the second column.
        values = list((row or {}).values())
        if len(values) > 1 and str(values[1]).strip():
            return str(values[1]).strip()

        return ""

    @classmethod
    def resolve_toxin_name(cls, value):
        raw = str(value or "").strip().upper()
        if raw in TOXIN_DEFAULTS:
            return raw
        norm = cls.normalize_token(raw)
        if norm in TOXIN_ALIASES:
            return TOXIN_ALIASES[norm]
        for alias, canonical in TOXIN_ALIASES.items():
            if alias in norm:
                return canonical
        return None

    @staticmethod
    def clean_toxin_display_name(value):
        """Keep the toxin name but remove trailing 'Result'/'Results' from headers."""
        text = str(value or "").strip()
        if not text:
            return ""
        text = re.sub(r"\s*[-_:]*\s*results?\s*$", "", text, flags=re.IGNORECASE)
        return text.strip()

    @classmethod
    def find_existing_result(cls, sample, toxin_name):
        """Find an existing toxin row, including legacy names ending with 'Result(s)'."""
        clean_name = cls.clean_toxin_display_name(toxin_name)
        existing = sample.mycotoxin_results.filter(name__iexact=clean_name).first()
        if existing:
            return existing

        legacy_patterns = [
            f"{clean_name} Result",
            f"{clean_name} Results",
            f"{clean_name}-Result",
            f"{clean_name}-Results",
            f"{clean_name}: Result",
            f"{clean_name}: Results",
        ]
        for legacy_name in legacy_patterns:
            existing = sample.mycotoxin_results.filter(name__iexact=legacy_name).first()
            if existing:
                return existing

        return None

    @classmethod
    def cleanup_legacy_duplicates(cls, sample, toxin_name, keep_id):
        clean_name = cls.clean_toxin_display_name(toxin_name)
        for result in sample.mycotoxin_results.exclude(id=keep_id):
            if cls.clean_toxin_display_name(result.name).lower() == clean_name.lower():
                if result.name.strip().lower() != clean_name.lower():
                    result.delete()

    @staticmethod
    def parse_numeric(value):
        text = str(value or "").strip().lower()
        if text in {"nd", "bdl", "<lod", "lod", "n/a", "-", "#value!"}:
            return 0.0
        if text.startswith("<"):
            return 0.0

        normalized = text
        if "," in normalized and "." not in normalized:
            normalized = normalized.replace(",", ".")
        else:
            normalized = normalized.replace(",", "")

        match = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", normalized)
        return float(match.group(0)) if match else None

    @classmethod
    def extract_results_from_row(cls, row):
        # Backward compatible long format
        toxin_key = cls.get_row_value(
            row, ["mycotoxin", "mycotoxin_name", "toxin", "name"]
        )
        if toxin_key:
            canonical = cls.resolve_toxin_name(toxin_key)
            intensity = cls.parse_numeric(
                cls.get_row_value(
                    row, ["intensity", "value", "result", "concentration"]
                )
            )
            if intensity is None:
                return []

            threshold = get_toxin_threshold(canonical)
            unit = get_toxin_unit(canonical)
            name = cls.clean_toxin_display_name(toxin_key)
            return [
                {
                    "name": name,
                    "intensity": intensity,
                    "is_detected": intensity > 0,
                    "threshold": threshold,
                    "unit": unit,
                    "dangerous": bool(threshold and intensity > threshold),
                }
            ]

        # New wide format: A sample, B analyzed datetime, C+ result columns
        results = []
        items = list((row or {}).items())
        data_columns = items[2:] if len(items) > 2 else []

        for header, raw_value in data_columns:
            header_text = str(header or "").strip()
            if not header_text:
                continue

            intensity = cls.parse_numeric(raw_value)
            if intensity is None:
                continue

            canonical = cls.resolve_toxin_name(header_text)
            threshold = get_toxin_threshold(canonical)
            unit = get_toxin_unit(canonical)
            results.append(
                {
                    # Keep exact column name per updated requirement.
                    "name": cls.clean_toxin_display_name(header_text),
                    "intensity": intensity,
                    "is_detected": intensity > 0,
                    "threshold": threshold,
                    "unit": unit,
                    "dangerous": bool(threshold and intensity > threshold),
                }
            )

        return results

    @classmethod
    def process_csv_results(cls, uploaded_file, user):
        wrapped = TextIOWrapper(uploaded_file.file, encoding="utf-8-sig")
        rows = list(csv.DictReader(wrapped))

        csv_display_ids = set()
        normalized_ids = set()
        for row in rows:
            display_id, _ = cls.extract_row_sample_id(row)
            if display_id:
                csv_display_ids.add(display_id.strip())
                normalized_ids.add(cls.normalize_sample_id(display_id))

        sample_map = {
            cls.normalize_sample_id(s.sample_id): s
            for s in Sample._default_manager.filter(sample_id__in=csv_display_ids)
        }

        missing_norm = normalized_ids - set(sample_map.keys())
        if missing_norm:
            for sample in Sample._default_manager.all():
                norm = cls.normalize_sample_id(sample.sample_id)
                if norm in missing_norm and norm not in sample_map:
                    sample_map[norm] = sample

        created, updated = 0, 0
        touched_samples = set()
        unmatched = set()
        skipped = 0

        for row in rows:
            display_id, sid = cls.extract_row_sample_id(row)
            if not sid:
                skipped += 1
                continue

            sample = sample_map.get(sid)
            if not sample:
                unmatched.add(display_id or sid)
                continue

            results = cls.extract_results_from_row(row)
            if not results:
                skipped += 1
                continue

            for payload in results:
                existing = cls.find_existing_result(sample, payload["name"])
                if existing:
                    existing.name = cls.clean_toxin_display_name(payload["name"])
                    existing.intensity = payload["intensity"]
                    existing.threshold = payload["threshold"]
                    existing.unit = payload["unit"]
                    existing.is_detected = payload["is_detected"]
                    existing.dangerous = payload["dangerous"]
                    existing.test_method = "Imported CSV"
                    existing.save()
                    cls.cleanup_legacy_duplicates(sample, payload["name"], existing.id)
                    updated += 1
                else:
                    created_row = MycotoxinResult._default_manager.create(
                        sample=sample,
                        name=cls.clean_toxin_display_name(payload["name"]),
                        intensity=payload["intensity"],
                        threshold=payload["threshold"],
                        unit=payload["unit"],
                        is_detected=payload["is_detected"],
                        dangerous=payload["dangerous"],
                        test_method="Imported CSV",
                    )
                    cls.cleanup_legacy_duplicates(
                        sample, payload["name"], created_row.id
                    )
                    created += 1

            touched_samples.add((sample, cls.extract_analyzed_datetime(row)))

        for sample, analyzed_at in touched_samples:
            sample.status = "completed"
            sample.updated_by = user
            sample.save()

            notes = "Mycotoxin results imported from CSV."
            if analyzed_at:
                notes = f"{notes} Analyzed at: {analyzed_at}"
            ProcessLog._default_manager.create(
                sample=sample,
                state="completed",
                conducted_by=user.username,
                notes=notes,
            )

        return {
            "created": created,
            "updated": updated,
            "samples": len({sample.sample_id for sample, _ in touched_samples}),
            "rows_processed": len(rows),
            "skipped_rows": skipped,
            "unmatched_sample_ids": sorted(unmatched),
        }
