"""
Service layer for generating and cleaning up mock test data.

This service allows admins to populate the system with realistic-looking
samples for UI testing and analytics validation, and safely purge them
via a consistent sample_id prefix.
"""

import random
from datetime import timedelta
import logging

from django.db import transaction
from django.utils import timezone


from ..models import Sample, MycotoxinResult, ProcessLog
from ..constants.mycotoxin_constants import EU_THRESHOLDS

logger = logging.getLogger("agriscan.samples")

# Marker used to safely identify and delete test data
TEST_PREFIX = "TEST-"

# Mock data pools for variety
VARIETIES = ["Corn", "Rice", "Wheat", "Soybeans", "Cassava"]
REGIONS_PROVINCES = {
    "North": ["Chiang Mai", "Chiang Rai"],
    "Central": ["Bangkok", "Ayutthaya"],
    "Northeast": ["Khon Kaen", "Nakhon Ratchasima"],
    "South": ["Phuket", "Songkhla"],
    "East": ["Chon Buri", "Rayong"],
}

# Only use toxins that have reliable EU threshold data in the system
TOXINS_WITH_DATA = [
    code for code, data in EU_THRESHOLDS.items()
    if data.get("has_data") and data.get("low") > 0
]


class TestDataService:
    """Orchestrates creation and deletion of marker-prefixed test samples."""

    @staticmethod
    def generate_test_samples(*, user, seed: int = 42) -> dict:
        """
        Create 100 test samples with a balanced mix (approx 50/50 Positive/Negative):
        - 5 Incomplete (Pending) - Negative
        - 50 Multi-Toxin Positive (2-4 toxins) - Positive
        - 45 Baseline (Negative / Safe) - Negative

        Returns a summary dict of the operation.
        """
        rng = random.Random(seed)
        created_ids = []
        today = timezone.now().date()

        # Categorized counts for 50/50 split
        counts = {
            "pending": 5,
            "multi_positive": 50,
            "baseline_negative": 45
        }
        total_to_create = sum(counts.values())

        try:
            with transaction.atomic():
                for i in range(total_to_create):
                    # 1. Determine Category and Status
                    if i < counts["pending"]:
                        category = "pending"
                        status = "pending"
                    elif i < counts["pending"] + counts["multi_positive"]:
                        category = "multi_positive"
                        status = "completed"
                    else:
                        category = "baseline_negative"
                        status = "completed"

                    # 2. Generate Metadata
                    region = rng.choice(list(REGIONS_PROVINCES.keys()))
                    province = rng.choice(REGIONS_PROVINCES[region])
                    variety = rng.choice(VARIETIES)
                    # Random date in the last 3 months
                    collection_date = today - timedelta(days=rng.randint(0, 90))

                    sample_id = f"{TEST_PREFIX}{collection_date:%Y%m%d}-{i + 1:03d}"

                    sample = Sample.objects.create(
                        sample_id=sample_id,
                        region=region,
                        province=province,
                        district="Test District",
                        vegetation_variety=variety,
                        collection_date=collection_date,
                        status=status,
                        purpose="target surveillance",
                        sample_type="field",
                        processing_type="raw",
                        collected_by="Test Generator",
                        updated_by=user
                    )
                    created_ids.append(sample_id)

                    # 3. Process Logic
                    if status == "completed":
                        ProcessLog.objects.create(
                            sample=sample,
                            state="completed",
                            notes=f"Generated for {category} testing.",
                            conducted_by=user.username or "System"
                        )

                        # 4. Add Results based on Category
                        if category == "multi_positive":
                            # Pick 2-4 random toxins
                            num_toxins = rng.randint(2, 4)
                            chosen_toxins = rng.sample(TOXINS_WITH_DATA, num_toxins)
                            for toxin in chosen_toxins:
                                thresholds = EU_THRESHOLDS[toxin]
                                value = thresholds["low"] * rng.uniform(1.1, 4.0)
                                MycotoxinResult.objects.create(
                                    sample=sample,
                                    toxin_type=toxin,
                                    value=round(value, 2),
                                    unit=thresholds.get("unit", "ug/kg"),
                                    eu_threshold_low=thresholds["low"],
                                    eu_threshold_high=thresholds["high"]
                                )
                        elif category == "baseline_negative":
                            # Pure Negative / Safe (Value 0 or very low)
                            toxin = rng.choice(TOXINS_WITH_DATA)
                            thresholds = EU_THRESHOLDS[toxin]

                            # 80% Zero, 20% Very Low (Trace)
                            if rng.random() > 0.8:
                                value = thresholds["low"] * rng.uniform(0.01, 0.3)
                            else:
                                value = 0.0

                            MycotoxinResult.objects.create(
                                sample=sample,
                                toxin_type=toxin,
                                value=round(value, 2),
                                unit=thresholds.get("unit", "ug/kg"),
                                eu_threshold_low=thresholds["low"],
                                eu_threshold_high=thresholds["high"]
                            )

            logger.warning(
                "sample.test_data_generated",
                extra={
                    "user": user.username,
                    "count": total_to_create,
                    "categories": counts,
                    "sample_ids": created_ids
                }
            )

            return {
                "created": total_to_create,
                "categories": counts,
                "positive": counts["multi_positive"],
                "negative": counts["pending"] + counts["baseline_negative"],
                "sample_ids": created_ids
            }

        except Exception as e:
            logger.error(f"Failed to generate test data: {str(e)}", exc_info=True)
            raise

    @staticmethod
    def delete_test_samples(*, user) -> dict:
        """
        Remove all samples starting with the TEST- prefix.

        Returns a summary of the deleted count and IDs.
        """
        try:
            with transaction.atomic():
                test_samples = Sample.objects.filter(sample_id__startswith=TEST_PREFIX)
                deleted_ids = list(test_samples.values_list("sample_id", flat=True))
                count = test_samples.count()

                test_samples.delete()

            logger.warning(
                "sample.test_data_deleted",
                extra={
                    "user": user.username,
                    "count": count,
                    "sample_ids": deleted_ids
                }
            )

            return {
                "deleted": count,
                "sample_ids": deleted_ids
            }

        except Exception as e:
            logger.error(f"Failed to delete test data: {str(e)}", exc_info=True)
            raise
