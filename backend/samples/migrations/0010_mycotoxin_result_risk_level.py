from django.db import migrations, models
from django.utils import timezone


TOXIN_CHOICES = [
    ("AFB1", "Aflatoxin B1"),
    ("DON", "Deoxynivalenol"),
    ("FB1", "Fumonisin B1"),
    ("ZEA", "Zearalenone"),
    ("OTA", "Ochratoxin A"),
    ("T-2", "T-2 Toxin"),
    ("AFG1", "Aflatoxin G1"),
    ("AFG2", "Aflatoxin G2"),
    ("AFM1", "Aflatoxin M1"),
    ("UNKNOWN", "Unknown toxin"),
]

RISK_LEVEL_CHOICES = [
    ("safe", "Safe - Not detected"),
    ("detected", "Detected - Below EU low limit"),
    ("high", "High - Exceeds EU low limit"),
    ("critical", "Critical - Exceeds EU high limit"),
    ("unclassified", "Unclassified - No threshold data"),
]

UNIT_CHOICES = [
    ("ug_kg", "ug/kg"),
    ("ng_g", "ng/g"),
    ("ppb", "ppb"),
]

EU_THRESHOLDS = {
    # Frozen migration policy: keep this local copy stable even if the live
    # constants module changes later.
    "AFB1": {"low": 5, "high": 20, "has_data": True},
    "DON": {"low": 900, "high": 8000, "has_data": True},
    "FB1": {"low": 5000, "high": 60000, "has_data": True},
    "ZEA": {"low": 100, "high": 2000, "has_data": True},
    "OTA": {"low": 50, "high": 250, "has_data": True},
    "T-2": {"low": 0, "high": 0, "has_data": False},
    "AFG1": {"low": 0, "high": 0, "has_data": False},
    "AFG2": {"low": 0, "high": 0, "has_data": False},
    "AFM1": {"low": 0, "high": 0, "has_data": False},
    "UNKNOWN": {"low": 0, "high": 0, "has_data": False},
}

TOXIN_ALIASES = {
    "aflatoxinb1": "AFB1",
    "afb1": "AFB1",
    "deoxynivalenol": "DON",
    "don": "DON",
    "fumonisinb1": "FB1",
    "fb1": "FB1",
    "zearalenone": "ZEA",
    "zea": "ZEA",
    "ochratoxina": "OTA",
    "ota": "OTA",
    "t2toxin": "T-2",
    "t2": "T-2",
    "aflatoxing1": "AFG1",
    "afg1": "AFG1",
    "aflatoxing2": "AFG2",
    "afg2": "AFG2",
    "aflatoxinm1": "AFM1",
    "afm1": "AFM1",
}


def _normalize_token(value):
    return "".join(ch for ch in str(value or "").lower() if ch.isalnum())


def _resolve_toxin_type(value):
    raw = str(value or "").strip().upper()
    if raw in EU_THRESHOLDS:
        return raw

    token = _normalize_token(value)
    if token in TOXIN_ALIASES:
        return TOXIN_ALIASES[token]

    for alias, toxin_type in TOXIN_ALIASES.items():
        if alias in token:
            return toxin_type
    return None


def _risk_level(toxin_type, value):
    threshold = EU_THRESHOLDS.get(toxin_type)
    if not threshold or not threshold["has_data"] or value is None:
        return "unclassified"
    if value > threshold["high"]:
        return "critical"
    if value > threshold["low"]:
        return "high"
    if value > 0:
        return "detected"
    return "safe"


def migrate_result_data(apps, schema_editor):
    MycotoxinResult = apps.get_model("samples", "MycotoxinResult")

    seen = {}
    unresolved = []
    deduped = []
    for result in MycotoxinResult.objects.order_by("sample_id", "id"):
        original_name = getattr(result, "name", "")
        toxin_type = _resolve_toxin_type(original_name)
        value = getattr(result, "intensity", None)

        notes = ""
        if toxin_type is None:
            toxin_type = "UNKNOWN"
            notes = (
                "Migration warning: original toxin name "
                f"{original_name!r} could not be resolved."
            )
            unresolved.append((result.sample_id, result.id, original_name))

        threshold = EU_THRESHOLDS.get(toxin_type, {})
        key = (result.sample_id, toxin_type)

        existing = seen.get(key)
        if existing:
            existing_value = existing.value if existing.value is not None else -1
            current_value = value if value is not None else -1
            action = "deleted"
            if current_value > existing_value:
                existing.value = value
                existing.risk_level = _risk_level(toxin_type, value)
                existing.eu_threshold_low = threshold.get("low")
                existing.eu_threshold_high = threshold.get("high")
                existing.notes = notes
                existing.timestamp = (
                    getattr(result, "created_at", None) or timezone.now()
                )
                existing.save(
                    update_fields=[
                        "value",
                        "risk_level",
                        "eu_threshold_low",
                        "eu_threshold_high",
                        "notes",
                        "timestamp",
                    ]
                )
                action = "merged_into_kept_row"
            deduped.append(
                (
                    result.sample_id,
                    toxin_type,
                    result.id,
                    value,
                    existing.id,
                    action,
                )
            )
            result.delete()
            continue

        result.toxin_type = toxin_type
        result.value = value
        result.unit = "ug_kg"
        result.risk_level = _risk_level(toxin_type, value)
        result.eu_threshold_low = threshold.get("low")
        result.eu_threshold_high = threshold.get("high")
        result.timestamp = getattr(result, "created_at", None) or timezone.now()
        result.notes = notes
        result.save(
            update_fields=[
                "toxin_type",
                "value",
                "unit",
                "risk_level",
                "eu_threshold_low",
                "eu_threshold_high",
                "timestamp",
                "notes",
            ]
        )
        seen[key] = result

    if unresolved:
        print(
            "samples.0010 warning: unresolved toxin names were mapped to "
            "UNKNOWN:"
        )
        for sample_id, result_id, original_name in unresolved:
            print(
                "  "
                f"sample_id={sample_id!r} result_id={result_id} "
                f"original_name={original_name!r}"
            )

    if deduped:
        print("samples.0010 warning: duplicate toxin rows were deduplicated:")
        for sample_id, toxin_type, deleted_id, value, kept_id, action in deduped:
            print(
                "  "
                f"sample_id={sample_id!r} toxin_type={toxin_type!r} "
                f"deleted_id={deleted_id} deleted_value={value!r} "
                f"kept_id={kept_id} action={action}"
            )


class Migration(migrations.Migration):
    dependencies = [
        ("samples", "0009_alter_mycotoxinresult_id_alter_processlog_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="mycotoxinresult",
            name="toxin_type",
            field=models.CharField(
                choices=TOXIN_CHOICES,
                db_index=True,
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="mycotoxinresult",
            name="value",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mycotoxinresult",
            name="risk_level",
            field=models.CharField(
                choices=RISK_LEVEL_CHOICES,
                db_index=True,
                default="unclassified",
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name="mycotoxinresult",
            name="eu_threshold_low",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mycotoxinresult",
            name="eu_threshold_high",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mycotoxinresult",
            name="timestamp",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name="mycotoxinresult",
            name="notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.RunPython(migrate_result_data, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="mycotoxinresult",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="mycotoxinresult",
            name="toxin_type",
            field=models.CharField(
                choices=TOXIN_CHOICES,
                db_index=True,
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name="mycotoxinresult",
            name="timestamp",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AlterField(
            model_name="mycotoxinresult",
            name="unit",
            field=models.CharField(
                choices=UNIT_CHOICES,
                default="ug_kg",
                max_length=10,
            ),
        ),
        migrations.AlterModelOptions(
            name="mycotoxinresult",
            options={"ordering": ["-timestamp"]},
        ),
        migrations.RemoveField(model_name="mycotoxinresult", name="name"),
        migrations.RemoveField(model_name="mycotoxinresult", name="intensity"),
        migrations.RemoveField(model_name="mycotoxinresult", name="is_detected"),
        migrations.RemoveField(model_name="mycotoxinresult", name="dangerous"),
        migrations.RemoveField(model_name="mycotoxinresult", name="threshold"),
        migrations.RemoveField(model_name="mycotoxinresult", name="test_method"),
        migrations.RemoveField(model_name="mycotoxinresult", name="sop_link"),
        migrations.RemoveField(model_name="mycotoxinresult", name="created_at"),
        migrations.AlterUniqueTogether(
            name="mycotoxinresult",
            unique_together={("sample", "toxin_type")},
        ),
        migrations.AddIndex(
            model_name="mycotoxinresult",
            index=models.Index(
                fields=["toxin_type", "risk_level"],
                name="samples_myc_toxin_t_4623ed_idx",
            ),
        ),
    ]
