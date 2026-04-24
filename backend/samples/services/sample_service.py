"""
Service layer for sample creation and lifecycle operations.

Keeps view code thin by encapsulating the orchestration logic for
bulk-creating samples with auto-generated IDs, default fields, and
initial process logs.
"""

import logging

from django.db import IntegrityError, transaction

from core.exceptions import SampleAlreadyExists

from ..models import ProcessLog, Sample
from ..utils import extract_sequence_from_sample_id, generate_sequential_sample_id

logger = logging.getLogger("agriscan.samples")

# Default field values applied when bulk-importing samples that lack them.
_BULK_DEFAULTS: dict[str, str] = {
    "purpose": "routine",
    "sample_type": "field",
    "processing_type": "raw",
    "collected_by": "Imported",
    "additional_info": "",
}


class SampleService:
    """Encapsulates sample lifecycle operations that go beyond simple CRUD."""

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

                    # --- auto-generate sample_id when not provided ---
                    if not sample_id:
                        generated_id, seq = generate_sequential_sample_id(collection_date)
                        item["sample_id"] = generated_id
                        item["sequence_number"] = seq
                    else:
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
                        sample = Sample.objects.create(**item, updated_by=user)
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
