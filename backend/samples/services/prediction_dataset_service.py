"""Build model-ready rows from stored sample and mycotoxin result data."""

import csv
import math
import re
from typing import Iterable, TextIO

from ..constants.mycotoxin_constants import TOXIN_LABELS
from ..models import MycotoxinResult


class PredictionDatasetService:
    """Export a flat training table without mutating source sample data."""

    FIELDNAMES = [
        'sample_id',
        'toxin_type',
        'toxin_label',
        'detected',
        'concentration_ug_kg',
        'concentration_log1p',
        'is_below_lod',
        'usable_context',
        'food_feed_type',
        'sub_type',
        'commodity',
        'region',
        'province',
        'district',
        'collection_date',
        'collection_year',
        'collection_month',
        'collection_quarter',
        'collection_season_thailand',
        'purpose',
        'sample_type',
        'processing_type',
        'recorded_by_username',
    ]

    @classmethod
    def get_queryset(cls):
        return (
            MycotoxinResult.objects.select_related('sample', 'sample__recorded_by')
            .filter(value__isnull=False)
            .order_by('sample__sample_id', 'toxin_type')
        )

    @classmethod
    def iter_rows(cls, queryset=None) -> Iterable[dict]:
        results = queryset if queryset is not None else cls.get_queryset()
        for result in results:
            yield cls.build_row(result)

    @classmethod
    def write_csv(cls, output: TextIO, queryset=None) -> int:
        writer = csv.DictWriter(output, fieldnames=cls.FIELDNAMES)
        writer.writeheader()
        count = 0
        for row in cls.iter_rows(queryset=queryset):
            writer.writerow(row)
            count += 1
        return count

    @classmethod
    def build_row(cls, result: MycotoxinResult) -> dict:
        sample = result.sample
        value = float(result.value or 0)
        detected = value > 0
        collection_date = sample.collection_date
        commodity = sample.sub_type or sample.vegetation_variety

        return {
            'sample_id': sample.sample_id,
            'toxin_type': result.toxin_type,
            'toxin_label': TOXIN_LABELS.get(result.toxin_type, result.toxin_type),
            'detected': int(detected),
            'concentration_ug_kg': value,
            'concentration_log1p': round(math.log1p(value), 8) if detected else 0,
            'is_below_lod': int(result.is_below_lod),
            'usable_context': int(cls.has_usable_context(sample)),
            'food_feed_type': cls.clean_category(sample.food_feed_type),
            'sub_type': cls.clean_category(sample.sub_type),
            'commodity': cls.clean_category(commodity),
            'region': cls.clean_category(sample.region),
            'province': cls.clean_location(sample.province),
            'district': cls.clean_location(sample.district),
            'collection_date': collection_date.isoformat() if collection_date else '',
            'collection_year': collection_date.year if collection_date else '',
            'collection_month': collection_date.month if collection_date else '',
            'collection_quarter': cls.quarter(collection_date.month) if collection_date else '',
            'collection_season_thailand': cls.thailand_season(collection_date.month) if collection_date else '',
            'purpose': cls.clean_category(sample.purpose),
            'sample_type': cls.clean_category(sample.sample_type),
            'processing_type': cls.clean_category(sample.processing_type),
            'recorded_by_username': sample.recorded_by.username if sample.recorded_by else '',
        }

    @staticmethod
    def clean_category(value) -> str:
        text = str(value or '').strip().lower()
        text = re.sub(r'\s+', ' ', text)
        return text

    @classmethod
    def clean_location(cls, value) -> str:
        text = cls.clean_category(value)
        if text in {'', 'unknown', 'n/a', 'na', '-'}:
            return ''
        return text.title()

    @staticmethod
    def has_usable_context(sample) -> bool:
        province = str(sample.province or '').strip().lower()
        return bool(sample.collection_date and province and province not in {'unknown', 'n/a', 'na', '-'})

    @staticmethod
    def quarter(month: int) -> int:
        return ((month - 1) // 3) + 1

    @staticmethod
    def thailand_season(month: int) -> str:
        if month in {11, 12, 1, 2}:
            return 'cool'
        if month in {3, 4, 5}:
            return 'hot'
        return 'rainy'
