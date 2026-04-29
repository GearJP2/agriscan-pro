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
        Create 30 test samples with a mix of positive and negative results.

        Returns a summary dict of the operation.
        """
        rng = random.Random(seed)
        created_ids = []
        today = timezone.now().date()

        # 20 positive, 10 negative
        counts = {"positive": 20, "negative": 10}
        total_to_create = counts["positive"] + counts["negative"]

        try:
            with transaction.atomic():
                for i in range(total_to_create):
                    is_positive = i < counts["positive"]

                    # 1. Generate Metadata
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
                        status="completed",
                        purpose="target surveillance",
                        sample_type="field",
                        processing_type="raw",
                        collected_by="Test Generator",
                        updated_by=user
                    )
                    created_ids.append(sample_id)

                    # 2. Add Process Log
                    ProcessLog.objects.create(
                        sample=sample,
                        state="completed",
                        notes="Generated for system testing.",
                        conducted_by=user.username or "System"
                    )

                    # 3. Add Result
                    toxin = rng.choice(TOXINS_WITH_DATA)
                    thresholds = EU_THRESHOLDS[toxin]

                    if is_positive:
                        # Value between 1.2x and 3.0x the low threshold to landing in High/Critical
                        value = thresholds["low"] * rng.uniform(1.2, 3.0)
                    else:
                        value = 0.0

                    # Model's save() method auto-calculates risk_level
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
                    "sample_ids": created_ids
                }
            )

            return {
                "created": total_to_create,
                "positive": counts["positive"],
                "negative": counts["negative"],
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
