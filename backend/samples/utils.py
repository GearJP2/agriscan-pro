import re
from django.db import transaction
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


def generate_sequential_sample_id(collection_date=None, sub_type=None):
    target_year = (collection_date.year if collection_date else timezone.now().year)
    prefix = f'{_sub_type_prefix(sub_type)}-{target_year}-'

    with transaction.atomic():
        existing = list(
            Sample.objects.select_for_update()
            .filter(sample_id__startswith=prefix)
            .values_list('sample_id', 'sequence_number')
        )

        max_seq = 0
        for sample_id, seq in existing:
            if seq and int(seq) > max_seq:
                max_seq = int(seq)
            parsed = extract_sequence_from_sample_id(sample_id, target_year)
            if parsed > max_seq:
                max_seq = parsed

        next_seq = max_seq + 1
        return f'{prefix}{next_seq:03d}', next_seq
