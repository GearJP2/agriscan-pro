from datetime import date
from django.test import TestCase
from django.utils import timezone

from ..models import Sample
from ..utils import extract_sequence_from_sample_id, generate_sequential_sample_id
from ._mixins import SampleTestMixin


class SequenceGenerationTests(SampleTestMixin, TestCase):
    """Tests for generate_sequential_sample_id and sequence extraction."""

    def test_generate_sequential_sample_id_starts_at_one(self):
        """When no samples exist for a prefix/year, sequence starts at 1."""
        sid, seq = generate_sequential_sample_id(date(2026, 5, 10), 'Rice')
        self.assertEqual(sid, 'RIC-2026-001')
        self.assertEqual(seq, 1)

    def test_generate_sequential_sample_id_increments_monotonically(self):
        """Sequence numbers must increment based on existing max sequence."""
        data1 = dict(self.sample_data)
        data1.update({
            'sample_id': 'RIC-2026-001',
            'sequence_number': 1,
            'sub_type': 'Rice',
            'collection_date': date(2026, 1, 1),
            'updated_by': self.user,
        })
        Sample.objects.create(**data1)

        data2 = dict(self.sample_data)
        data2.update({
            'sample_id': 'RIC-2026-002',
            'sequence_number': 2,
            'sub_type': 'Rice',
            'collection_date': date(2026, 1, 2),
            'updated_by': self.user,
        })
        Sample.objects.create(**data2)

        sid, seq = generate_sequential_sample_id(date(2026, 2, 1), 'Rice')
        self.assertEqual(sid, 'RIC-2026-003')
        self.assertEqual(seq, 3)

    def test_generate_sequential_sample_id_independent_per_prefix_and_year(self):
        """Different crops or years maintain independent sequences."""
        data = dict(self.sample_data)
        data.update({
            'sample_id': 'RIC-2026-001',
            'sequence_number': 1,
            'sub_type': 'Rice',
            'collection_date': date(2026, 1, 1),
            'updated_by': self.user,
        })
        Sample.objects.create(**data)

        # Different subtype: Corn -> COR-2026-001
        corn_sid, corn_seq = generate_sequential_sample_id(date(2026, 1, 1), 'Corn')
        self.assertEqual(corn_sid, 'COR-2026-001')
        self.assertEqual(corn_seq, 1)

        # Different year: 2025 -> RIC-2025-001
        y25_sid, y25_seq = generate_sequential_sample_id(date(2025, 1, 1), 'Rice')
        self.assertEqual(y25_sid, 'RIC-2025-001')
        self.assertEqual(y25_seq, 1)

    def test_generate_sequential_sample_id_legacy_fallback_when_sequence_number_is_zero(self):
        """When legacy rows exist with sequence_number=0, sequence parses from sample_id."""
        data = dict(self.sample_data)
        data.update({
            'sample_id': 'RIC-2026-042',
            'sequence_number': 0,  # Legacy row without populated sequence_number
            'sub_type': 'Rice',
            'collection_date': date(2026, 1, 1),
            'updated_by': self.user,
        })
        Sample.objects.create(**data)

        sid, seq = generate_sequential_sample_id(date(2026, 3, 1), 'Rice')
        self.assertEqual(sid, 'RIC-2026-043')
        self.assertEqual(seq, 43)

    def test_extract_sequence_from_sample_id(self):
        """extract_sequence_from_sample_id correctly parses 2-3 char prefix sample IDs."""
        self.assertEqual(extract_sequence_from_sample_id('RIC-2026-001'), 1)
        self.assertEqual(extract_sequence_from_sample_id('SAM-2026-073'), 73)
        self.assertEqual(extract_sequence_from_sample_id('CRN-2025-1000'), 1000)
        self.assertEqual(extract_sequence_from_sample_id('INVALID-ID'), 0)
        self.assertEqual(extract_sequence_from_sample_id(''), 0)
