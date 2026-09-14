"""
Service layer for sample creation and lifecycle operations.

Keeps view code thin by encapsulating the orchestration logic for
bulk-creating samples with auto-generated IDs, default fields, and
initial process logs.
"""

from collections import defaultdict
from datetime import date
import logging

from django.db import IntegrityError, transaction

from core.exceptions import SampleAlreadyExists

from ..models import ProcessLog, Sample
from ..utils import (
    extract_sequence_from_sample_id,
    generate_sequential_sample_id,
    generate_sequential_sample_ids,
)

logger = logging.getLogger("agriscan.samples")

# Default field values applied when bulk-importing samples that lack them.
_BULK_DEFAULTS: dict[str, str] = {
    "additional_info": "",
}


class SampleService:
    """Encapsulates sample lifecycle operations that go beyond simple CRUD."""

    @staticmethod
    def finalize_results(sample, user, *, notes='Mycotoxin result(s) recorded and finalized.'):
        previous_status = sample.status
        if sample.status in {'pending', 'in_progress'}:
            sample.status = 'completed'
        sample.updated_by = user
        sample.save(update_fields=['status', 'updated_by', 'updated_at'])
        latest = sample.process_logs.order_by('-timestamp', '-pk').first()
        if sample.status == 'completed' and (not latest or latest.state != 'completed'):
            ProcessLog.objects.create(
                sample=sample, state='completed',
                notes=f'{notes} Status: {previous_status} -> {sample.status}.',
                conducted_by=user.username if user else 'System',
            )

    @classmethod
    def bulk_create_samples(cls, validated_items: list[dict], *, user, batch_size: int) -> list[Sample]:
        """Create multiple samples inside a single atomic transaction.

        For each item the method:
        1. Auto-generates a ``sample_id`` when the caller omits one.
        2. Fills in sensible defaults for optional fields.
        3. Creates an initial ``ProcessLog`` entry.

        Returns the list of created ``Sample`` instances.  If any ID
        collides with an existing row, the entire batch is rolled back
        and a ``SampleAlreadyExists`` exception is raised.
        """
        samples: list[Sample] = []

        try:
            with transaction.atomic():
                for item in validated_items:
                    sample_id = (item.get("sample_id") or "").strip()
                    collection_date = item.get("collection_date")

                    # Backward-compatible imports may only provide the old
                    # vegetation column. Treat it as the requested subtype.
                    item.setdefault("food_feed_type", "food")
                    item.setdefault("sub_type", item.get("vegetation_variety"))
                    item["vegetation_variety"] = item["sub_type"]

                # --- batch allocate sample_ids for items lacking one ---
                unassigned_groups: dict[tuple, list[dict]] = defaultdict(list)
                for item in validated_items:
                    if not (item.get("sample_id") or "").strip():
                        c_date = item.get("collection_date")
                        target_year = c_date.year if c_date else None
                        unassigned_groups[(target_year, item.get("sub_type"))].append(item)

                for (target_year, sub_type), items_group in unassigned_groups.items():
                    sample_date = date(target_year, 1, 1) if target_year else None
                    allocated = generate_sequential_sample_ids(
                        count=len(items_group),
                        collection_date=sample_date,
                        sub_type=sub_type,
                    )
                    for item, (generated_id, seq) in zip(items_group, allocated):
                        item["sample_id"] = generated_id
                        item["sequence_number"] = seq

                for item in validated_items:
                    sample_id = (item.get("sample_id") or "").strip()
                    collection_date = item.get("collection_date")

                    if "sequence_number" not in item:
                        seq = extract_sequence_from_sample_id(
                            sample_id,
                            collection_date.year if collection_date else None,
                        )
                        if seq > 0:
                            item["sequence_number"] = seq

                    # --- apply bulk-import defaults ---
                    for field, default in _BULK_DEFAULTS.items():
                        if not item.get(field):
                            item[field] = default

                    # --- persist sample ---
                    try:
                        sample = Sample.objects.create(
                            **item,
                            updated_by=user,
                            recorded_by=user,
                            collected_by=user.username,
                        )
                    except IntegrityError:
                        raise SampleAlreadyExists(
                            detail=f"Sample ID '{item.get('sample_id')}' already exists."
                        )
                    samples.append(sample)

                    # --- initial process log ---
                    initial_state = "completed" if sample.status == "completed" else "registered"
                    initial_note = (
                        "Bulk imported with recorded results."
                        if initial_state == "completed"
                        else f"Bulk imported - {batch_size} samples"
                    )
                    ProcessLog.objects.create(
                        sample=sample,
                        state=initial_state,
                        notes=initial_note,
                        conducted_by=user.username or "System",
                    )
        except SampleAlreadyExists:
            # Re-raise so the view returns a 409; the atomic block has
            # already been rolled back at this point.
            raise

        return samples
