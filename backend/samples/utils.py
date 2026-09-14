import hashlib
import re

from django.db import connection, models, transaction
from django.utils import timezone

from .models import Sample


def extract_sequence_from_sample_id(sample_id, year=None):
    if not sample_id:
        return 0
    # IDs use the first three alphabetic characters of the subtype, e.g.
    # RIC-2026-001 for Rice. SAM remains accepted for historical records.
    pattern = rf'^[A-Z]{{2,3}}-{year}-(\d+)$' if year else r'^[A-Z]{2,3}-\d{4}-(\d+)$'
    match = re.match(pattern, str(sample_id).strip().upper())
    if not match:
        return 0
    return int(match.group(1))


def _sub_type_prefix(sub_type):
    letters = re.sub(r'[^A-Za-z]', '', str(sub_type or '')).upper()
    return letters[:3] if len(letters) >= 2 else 'SAM'


def generate_sequential_sample_ids(count=1, collection_date=None, sub_type=None):
    if count <= 0:
        return []
    target_year = (collection_date.year if collection_date else timezone.now().year)
    prefix = f'{_sub_type_prefix(sub_type)}-{target_year}-'

    with transaction.atomic():
        if connection.vendor == 'postgresql':
            # Lock the namespace even when it has no rows; callers insert in this transaction.
            lock_key = int.from_bytes(hashlib.sha256(prefix.encode()).digest()[:8], 'big', signed=True)
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', [lock_key])

        # Fast aggregate query using database index (O(1) in-memory)
        max_seq = (
            Sample.objects.filter(sample_id__startswith=prefix)
            .aggregate(max_val=models.Max('sequence_number'))['max_val']
            or 0
        )

        # Fallback only for unmigrated legacy rows where sequence_number == 0
        legacy_zero_seqs = Sample.objects.filter(
            sample_id__startswith=prefix, sequence_number=0
        ).values_list('sample_id', flat=True)
        for sid in legacy_zero_seqs:
            parsed = extract_sequence_from_sample_id(sid, target_year)
            if parsed > max_seq:
                max_seq = parsed

        results = []
        for i in range(1, count + 1):
            next_seq = max_seq + i
            results.append((f'{prefix}{next_seq:03d}', next_seq))
        return results


def generate_sequential_sample_id(collection_date=None, sub_type=None):
    return generate_sequential_sample_ids(1, collection_date, sub_type)[0]
