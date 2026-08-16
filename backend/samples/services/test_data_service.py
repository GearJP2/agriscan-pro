"""
Service layer for generating and cleaning up mock test data.

This service allows admins to populate the system with realistic-looking
samples for UI testing and analytics validation, and safely purge them
via a consistent sample_id prefix.
"""

from datetime import date, timedelta
import logging
import random
from typing import Any, Optional

from django.db import transaction
from django.utils import timezone

from notifications.models import Notification
from ..constants.mycotoxin_constants import EU_THRESHOLDS
from ..models import MycotoxinResult, ProcessLog, Sample, _calculate_risk_level

logger = logging.getLogger("agriscan.samples")

# Marker used to safely identify and delete test data
TEST_PREFIX = "TEST-"

# Standardized geographic and commodity taxonomies matching thailandLocations.ts
VARIETIES = ["Corn", "Rice", "Wheat", "Soybeans", "Cassava"]
REGIONS_PROVINCES = {
    "Northern": ["Chiang Mai", "Chiang Rai"],
    "Central": ["Bangkok", "Ayutthaya"],
    "Northeastern": ["Khon Kaen", "Nakhon Ratchasima"],
    "Southern": ["Phuket", "Songkhla"],
    "Eastern": ["Chonburi", "Rayong"],
}

# Canonical choices aligned with Sample model definitions
PURPOSES = ["routine", "complaint driven", "target surveillance"]
SAMPLE_TYPES = ["field", "market", "storage", "export"]
PROCESSING_TYPES = ["raw", "dried", "milled", "processed", "fermented"]

# Category distribution specification: (category_name, sample_status, count)
CATEGORY_SPECS = [
    ("pending", "pending", 5),
    ("in_progress", "in_progress", 5),
    ("multi_positive", "completed", 45),
    ("flagged", "flagged", 5),
    ("baseline_negative", "completed", 40),
]


def get_toxins_with_data() -> list[str]:
    """Dynamically return toxin codes that have EU threshold data."""
    return [
        code for code, data in EU_THRESHOLDS.items()
        if data.get("has_data") and data.get("low", 0) > 0
    ]


class TestDataService:
    """Orchestrates creation and deletion of marker-prefixed test samples."""

    @staticmethod
    def generate_test_samples(
        *,
        user: Optional[Any] = None,
        seed: int = 42,
        as_of: Optional[date] = None,
    ) -> dict[str, Any]:
        """
        Create 100 test samples with a balanced mix across statuses and categories:
        - 5 Pending (Negative, registered state)
        - 5 In Progress (Negative, received state)
        - 45 Multi-Toxin Positive (2-4 toxins above threshold, completed state)
        - 5 Flagged (Critical contamination, flagged state)
        - 40 Baseline Negative (Safe / 0.0 ppb or trace, completed state)

        Optimized with bulk_create to reduce database roundtrips from ~400 to 3 queries.
        Ensures atomic replacement of previous test data and notifications.
        """
        rng = random.Random(seed)
        effective_date = as_of or timezone.now().date()
        username = user.username if user and hasattr(user, "username") and user.username else "System"
        available_toxins = get_toxins_with_data()

        # Build category distribution counts
        counts = {category: count for category, _, count in CATEGORY_SPECS}
        total_to_create = sum(counts.values())

        try:
            with transaction.atomic():
                # 0. Atomic cleanup of existing test data and notifications
                Notification.objects.filter(
                    metadata__sample_display_id__startswith=TEST_PREFIX
                ).delete()
                Sample.objects.filter(sample_id__startswith=TEST_PREFIX).delete()

                sample_specs = []
                sample_instances = []
                created_ids = []
                sample_counter = 1

                # 1. Prepare Sample instances in memory
                for category, status, count in CATEGORY_SPECS:
                    for _ in range(count):
                        region = rng.choice(list(REGIONS_PROVINCES.keys()))
                        province = rng.choice(REGIONS_PROVINCES[region])
                        variety = rng.choice(VARIETIES)
                        purpose = rng.choice(PURPOSES)
                        sample_type = rng.choice(SAMPLE_TYPES)
                        processing_type = rng.choice(PROCESSING_TYPES)

                        collection_date = effective_date - timedelta(days=rng.randint(0, 90))
                        sample_id = f"{TEST_PREFIX}{collection_date:%Y%m%d}-{sample_counter:04d}"
                        sample_counter += 1

                        sample = Sample(
                            sample_id=sample_id,
                            region=region,
                            province=province,
                            district="Test District",
                            vegetation_variety=variety,
                            collection_date=collection_date,
                            status=status,
                            purpose=purpose,
                            sample_type=sample_type,
                            processing_type=processing_type,
                            collected_by="Test Generator",
                            updated_by=user,
                        )
                        sample_instances.append(sample)
                        sample_specs.append((sample, category, status))
                        created_ids.append(sample_id)

                # 2. Bulk insert all Sample rows
                created_samples = Sample.objects.bulk_create(sample_instances)

                # Map created sample instances for foreign key association
                logs_to_create = []
                results_to_create = []

                for sample, (_, category, status) in zip(created_samples, sample_specs):
                    # 3. Build ProcessLog records
                    logs_to_create.append(
                        ProcessLog(
                            sample=sample,
                            state="registered",
                            notes=f"Generated for {category} testing.",
                            conducted_by=username,
                        )
                    )

                    if status in ("in_progress", "completed", "flagged"):
                        logs_to_create.append(
                            ProcessLog(
                                sample=sample,
                                state="received",
                                notes="Sample received in test laboratory.",
                                conducted_by=username,
                            )
                        )

                    if status == "completed":
                        logs_to_create.append(
                            ProcessLog(
                                sample=sample,
                                state="completed",
                                notes="Analysis finalized and results recorded.",
                                conducted_by=username,
                            )
                        )
                    elif status == "flagged":
                        logs_to_create.append(
                            ProcessLog(
                                sample=sample,
                                state="flagged",
                                notes="High contamination detected - flagged for review.",
                                conducted_by=username,
                            )
                        )

                    # 4. Build MycotoxinResult records
                    if category in ("multi_positive", "flagged") and available_toxins:
                        desired_toxins = (
                            rng.randint(2, 4) if category == "multi_positive" else rng.randint(1, 3)
                        )
                        num_toxins = min(desired_toxins, len(available_toxins))
                        chosen_toxins = rng.sample(available_toxins, num_toxins)

                        for toxin in chosen_toxins:
                            thresholds = EU_THRESHOLDS[toxin]
                            multiplier = (
                                rng.uniform(1.1, 3.5) if category == "multi_positive"
                                else rng.uniform(2.5, 6.0)
                            )
                            rounded_value = round(thresholds["low"] * multiplier, 2)
                            low = thresholds["low"]
                            high = thresholds["high"]
                            results_to_create.append(
                                MycotoxinResult(
                                    sample=sample,
                                    toxin_type=toxin,
                                    value=rounded_value,
                                    unit="ug_kg",
                                    eu_threshold_low=low,
                                    eu_threshold_high=high,
                                    risk_level=_calculate_risk_level(
                                        toxin, rounded_value, low, high,
                                    ),
                                )
                            )
                    elif category == "baseline_negative" and available_toxins:
                        toxin = rng.choice(available_toxins)
                        thresholds = EU_THRESHOLDS[toxin]

                        # 80% Zero, 20% Very Low (Trace)
                        if rng.random() > 0.8:
                            value = thresholds["low"] * rng.uniform(0.01, 0.3)
                        else:
                            value = 0.0

                        rounded_value = round(value, 2)
                        low = thresholds["low"]
                        high = thresholds["high"]
                        results_to_create.append(
                            MycotoxinResult(
                                sample=sample,
                                toxin_type=toxin,
                                value=rounded_value,
                                unit="ug_kg",
                                eu_threshold_low=low,
                                eu_threshold_high=high,
                                risk_level=_calculate_risk_level(
                                    toxin, rounded_value, low, high,
                                ),
                            )
                        )

                # 5. Bulk insert child rows
                if logs_to_create:
                    ProcessLog.objects.bulk_create(logs_to_create)
                if results_to_create:
                    MycotoxinResult.objects.bulk_create(results_to_create)

            logger.warning(
                "sample.test_data_generated",
                extra={
                    "user": username,
                    "count": total_to_create,
                    "categories": counts,
                    "sample_ids": created_ids,
                },
            )

            positive_total = counts["multi_positive"] + counts["flagged"]
            negative_total = counts["pending"] + counts["in_progress"] + counts["baseline_negative"]

            return {
                "created": total_to_create,
                "categories": counts,
                "positive": positive_total,
                "negative": negative_total,
                "sample_ids": created_ids,
            }

        except Exception as exc:
            logger.error("Failed to generate test data: %s", exc, exc_info=True)
            raise

    @staticmethod
    def delete_test_samples(*, user: Optional[Any] = None) -> dict[str, Any]:
        """
        Remove all samples starting with the TEST- prefix and associated notifications.

        Returns a summary of the deleted count and IDs.
        """
        username = user.username if user and hasattr(user, "username") and user.username else "System"
        try:
            with transaction.atomic():
                Notification.objects.filter(
                    metadata__sample_display_id__startswith=TEST_PREFIX
                ).delete()

                test_samples = Sample.objects.filter(sample_id__startswith=TEST_PREFIX)
                deleted_ids = list(test_samples.values_list("sample_id", flat=True))
                count = test_samples.count()

                test_samples.delete()

            logger.warning(
                "sample.test_data_deleted",
                extra={
                    "user": username,
                    "count": count,
                    "sample_ids": deleted_ids,
                },
            )

            return {
                "deleted": count,
                "sample_ids": deleted_ids,
            }

        except Exception as exc:
            logger.error("Failed to delete test data: %s", exc, exc_info=True)
            raise
