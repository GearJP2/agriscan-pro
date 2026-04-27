import csv
import logging
import math
import re
from io import StringIO, TextIOWrapper
from typing import Iterator

from django.db import transaction

from ..constants.mycotoxin_constants import resolve_toxin_type
from ..models import MycotoxinResult, ProcessLog, Sample

logger = logging.getLogger("agriscan.samples")


class SampleIngestionService:
    RESULT_METADATA_HEADERS = {
        "",
        "sample",
        "sampleid",
        "samplecode",
        "name",
        "datetime",
        "analysisdatetime",
        "analyzedat",
        "analysedtime",
        "analysedatetime",
        "acqdatetime",
        "acqdate",
        "time",
        "date",
        "finalconc",
    }

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
            if not norm:
                continue
            normalized_token = cls.normalize_token(val)
            if normalized_token in {
                "name",
                "sample",
                "date",
                "time",
                "datetime",
                "acqdatetime",
                "acqdate",
                "finalconc",
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

        # All remaining candidates are datetime-like; no valid sample ID found.
        return "", ""

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
        return resolve_toxin_type(value)

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
        """Find an existing result by canonical toxin type."""
        toxin_type = cls.resolve_toxin_name(toxin_name)
        if not toxin_type:
            return None
        return sample.mycotoxin_results.filter(toxin_type=toxin_type).first()

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
        if match:
            try:
                val = float(match.group(0))
                if not math.isfinite(val):
                    return None
                return val
            except (ValueError, OverflowError):
                return None
        return None

    @staticmethod
    def iter_csv_rows(uploaded_file) -> Iterator[dict[str, str]]:
        """
        Iterate CSV rows without materializing the entire file in memory.

        The uploaded file is rewound for each pass so callers can do a cheap
        ID-discovery pass followed by a processing pass.

        Duplicate column headers are made unique by appending _2, _3, …
        so that csv.DictReader does not silently overwrite earlier column
        values with later ones (e.g. two columns both named "Sample").
        """
        uploaded_file.file.seek(0)
        wrapped = TextIOWrapper(uploaded_file.file, encoding="utf-8-sig", newline="")
        try:
            reader = csv.reader(wrapped)
            raw_headers = next(reader, None)
            if raw_headers is None:
                return

            # Deduplicate headers: second "Sample" becomes "Sample_2", etc.
            seen: dict[str, int] = {}
            headers: list[str] = []
            for h in raw_headers:
                key = h if h is not None else ""
                if key in seen:
                    seen[key] += 1
                    headers.append(f"{key}_{seen[key]}")
                else:
                    seen[key] = 1
                    headers.append(key)

            for row_values in reader:
                yield dict(zip(headers, row_values))
        finally:
            wrapped.detach()

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

            if canonical is None:
                return []

            return [
                {
                    "toxin_type": canonical,
                    "value": intensity,
                    "unit": "ug_kg",
                    "notes": "Imported CSV",
                }
            ]

        # Wide format: include any column whose header resolves to a toxin name.
        results = {}
        for header, raw_value in (row or {}).items():
            header_text = str(header or "").strip()
            if not header_text:
                continue
            if cls.normalize_token(header_text) in cls.RESULT_METADATA_HEADERS:
                continue

            canonical = cls.resolve_toxin_name(header_text)
            if canonical is None:
                continue

            intensity = cls.parse_numeric(raw_value)
            if intensity is None:
                continue

            # Deduplicate by toxin_type, keeping the highest value
            if canonical not in results or intensity > results[canonical]["value"]:
                results[canonical] = {
                    "toxin_type": canonical,
                    "value": intensity,
                    "unit": "ug_kg",
                    "notes": f"Imported CSV column: {header_text}",
                }

        return list(results.values())

    @classmethod
    def process_csv_results(cls, uploaded_file, user):
        csv_display_ids = set()
        normalized_ids = set()
        rows_processed = 0
        for row in cls.iter_csv_rows(uploaded_file):
            rows_processed += 1
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
        failed_rows = []

        for row_number, row in enumerate(cls.iter_csv_rows(uploaded_file), start=1):
            display_id, sid = cls.extract_row_sample_id(row)
            if not sid:
                skipped += 1
                continue

            sample = sample_map.get(sid)
            if not sample:
                unmatched.add(display_id or sid)
                failed_rows.append(
                    {
                        "row_number": row_number,
                        "sample_id": display_id or sid,
                        "error": "Sample ID not found in system.",
                        "row_data": row,
                    }
                )
                skipped += 1
                continue

            results = cls.extract_results_from_row(row)
            if not results:
                skipped += 1
                continue

            try:
                with transaction.atomic():
                    # Lock the sample to prevent concurrent modifications
                    sample = Sample.objects.select_for_update().get(pk=sample.pk)
                    created_for_row, updated_for_row = 0, 0
                    analyzed_at = cls.extract_analyzed_datetime(row)

                    # Keep each source row isolated so one failed row does not
                    # roll back successfully imported rows from the same file.
                    # See SAMPLE_IMPORT_FORMAT.md for the response contract.
                    sample.status = "completed"
                    sample.updated_by = user
                    sample.save()

                    notes = "Mycotoxin results imported from CSV."
                    if analyzed_at:
                        notes = f"{notes} Analyzed at: {analyzed_at}"
                    # Avoid creating duplicate completed logs
                    if not sample.process_logs.filter(state='completed').exists():
                        ProcessLog._default_manager.create(
                            sample=sample,
                            state="completed",
                            conducted_by=user.username,
                            notes=notes,
                        )

                    for payload in results:
                        existing = sample.mycotoxin_results.filter(
                            toxin_type=payload["toxin_type"]
                        ).first()
                        if existing:
                            existing.value = payload["value"]
                            existing.unit = payload["unit"]
                            existing.notes = payload["notes"]
                            existing.save()
                            updated_for_row += 1
                        else:
                            MycotoxinResult._default_manager.create(
                                sample=sample,
                                toxin_type=payload["toxin_type"],
                                value=payload["value"],
                                unit=payload["unit"],
                                notes=payload["notes"],
                            )
                            created_for_row += 1

                    touched_samples.add(sample.sample_id)
                    created += created_for_row
                    updated += updated_for_row
            except Exception as exc:
                skipped += 1
                failed_rows.append(
                    {
                        "row_number": row_number,
                        "sample_id": display_id or sid,
                        "error": str(exc),
                        "row_data": row,  # Store the raw dictionary for potential CSV export
                    }
                )
                logger.warning(
                    "sample.bulk_import_results.row_failed",
                    extra={
                        "row": row_number,
                        "sample_id": display_id or sid,
                        "error": str(exc),
                    },
                )

        return {
            "created": created,
            "updated": updated,
            "samples": len(touched_samples),
            "rows_processed": rows_processed,
            "skipped_rows": skipped,
            "unmatched_sample_ids": sorted(unmatched),
            "failed_rows": failed_rows,
        }

    @staticmethod
    def generate_failed_rows_csv(failed_rows: list[dict]) -> str:
        """
        Convert failed_rows metadata back into a CSV string.
        Includes an extra 'import_error' column for context.
        """
        if not failed_rows:
            return ""

        # Collect all headers from original row data
        fieldnames = set()
        for entry in failed_rows:
            if "row_data" in entry:
                fieldnames.update(entry["row_data"].keys())

        # Sort fieldnames but keep 'import_error' and 'row_number' as first columns
        header = ["row_number", "import_error"] + sorted(list(fieldnames))
        
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=header)
        writer.writeheader()
        
        for entry in failed_rows:
            row_to_write = {
                "row_number": entry.get("row_number"),
                "import_error": entry.get("error"),
            }
            # Spread the original row data
            row_to_write.update(entry.get("row_data", {}))
            writer.writerow(row_to_write)
            
        return output.getvalue()
