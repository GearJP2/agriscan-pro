from django.db import models
from django.contrib.auth import get_user_model

from .constants.mycotoxin_constants import (
    EU_THRESHOLDS,
    TOXIN_CHOICES,
    TOXIN_LABELS,
)

User = get_user_model()

class Sample(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('flagged', 'Flagged'),
    )
    
    PURPOSE_CHOICES = (
        ('routine', 'Routine'),
        ('complaint driven', 'Complaint Driven'),
        ('target surveillance', 'Target Surveillance'),
    )
    
    SAMPLE_TYPE_CHOICES = (
        ('field', 'Field'),
        ('market', 'Market'),
        ('storage', 'Storage'),
        ('export', 'Export'),
    )
    
    PROCESSING_TYPE_CHOICES = (
        ('raw', 'Raw'),
        ('dried', 'Dried'),
        ('milled', 'Milled'),
        ('processed', 'Processed'),
        ('fermented', 'Fermented'),
    )

    sample_id = models.CharField(max_length=50, unique=True, db_index=True)
    sequence_number = models.IntegerField(default=0, db_index=True)
    region = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    vegetation_variety = models.CharField(max_length=100)
    collection_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, null=True, blank=True)
    sample_type = models.CharField(max_length=20, choices=SAMPLE_TYPE_CHOICES, null=True, blank=True)
    processing_type = models.CharField(max_length=20, choices=PROCESSING_TYPE_CHOICES, null=True, blank=True)
    collected_by = models.CharField(max_length=255, null=True, blank=True)
    additional_info = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='samples_updated')

    class Meta:
        ordering = ['-collection_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['region']),
            models.Index(fields=['collection_date']),
            models.Index(fields=['region', 'status']),
            models.Index(fields=['region', 'collection_date']),
            models.Index(fields=['status', 'collection_date']),
        ]

    def __str__(self):
        return f"{self.sample_id} - {self.vegetation_variety}"


class ProcessLog(models.Model):
    PROCESS_STATE_CHOICES = (
        ('registered', 'Registered'),
        ('preparing', 'Preparing'),
        ('prepared', 'Prepared'),
        ('analyzing', 'Analyzing'),
        ('recorded', 'Recorded'),
        ('completed', 'Completed'),
    )

    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name='process_logs')
    timestamp = models.DateTimeField(auto_now_add=True)
    state = models.CharField(max_length=20, choices=PROCESS_STATE_CHOICES)
    test_id = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    conducted_by = models.CharField(max_length=255)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.sample.sample_id} - {self.state}"


RISK_LEVEL_CHOICES = [
    ('safe', 'Safe - Not detected'),
    ('detected', 'Detected - Below EU low limit'),
    ('high', 'High - Exceeds EU low limit'),
    ('critical', 'Critical - Exceeds EU high limit'),
    ('unclassified', 'Unclassified - No threshold data'),
]

UNIT_CHOICES = [
    ('ug_kg', 'ug/kg'),
    ('ng_g', 'ng/g'),
    ('ppb', 'ppb'),
]


def _calculate_risk_level(toxin_type, value, low, high):
    threshold = EU_THRESHOLDS.get(toxin_type)
    if not threshold or not threshold.get('has_data') or value is None:
        return 'unclassified'
    if high is not None and value > high:
        return 'critical'
    if low is not None and value > low:
        return 'high'
    if value > 0:
        return 'detected'
    return 'safe'


class MycotoxinResult(models.Model):
    sample = models.ForeignKey(
        Sample,
        on_delete=models.CASCADE,
        related_name='mycotoxin_results',
    )
    toxin_type = models.CharField(
        max_length=10,
        choices=TOXIN_CHOICES,
        db_index=True,
    )
    value = models.FloatField(null=True, blank=True)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='ug_kg')
    risk_level = models.CharField(
        max_length=15,
        choices=RISK_LEVEL_CHOICES,
        default='unclassified',
        db_index=True,
    )
    eu_threshold_low = models.FloatField(null=True, blank=True)
    eu_threshold_high = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-timestamp']
        unique_together = [['sample', 'toxin_type']]
        indexes = [
            models.Index(fields=['toxin_type', 'risk_level']),
        ]

    def save(self, *args, **kwargs):
        """Calculate risk and snapshot threshold metadata before saving."""
        update_fields = kwargs.get('update_fields')
        update_field_set = set(update_fields) if update_fields is not None else None
        relevant_fields = {'toxin_type', 'value'}
        should_recalculate = (
            self._state.adding
            or update_field_set is None
            or bool(update_field_set.intersection(relevant_fields))
        )

        should_snapshot = self._state.adding
        if not should_snapshot and self.pk:
            original = (
                type(self).objects
                .only('toxin_type')
                .filter(pk=self.pk)
                .first()
            )
            should_snapshot = (
                original is None
                or original.toxin_type != self.toxin_type
                or self.eu_threshold_low is None
                or self.eu_threshold_high is None
            )

        touched_fields = set()
        if should_snapshot:
            threshold = EU_THRESHOLDS.get(self.toxin_type, {})
            self.eu_threshold_low = threshold.get('low')
            self.eu_threshold_high = threshold.get('high')
            touched_fields.update({'eu_threshold_low', 'eu_threshold_high'})

        if should_recalculate:
            self.risk_level = _calculate_risk_level(
                self.toxin_type,
                self.value,
                self.eu_threshold_low,
                self.eu_threshold_high,
            )
            touched_fields.add('risk_level')

        if update_field_set is not None and touched_fields:
            kwargs['update_fields'] = list(update_field_set | touched_fields)

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.sample.sample_id} - {self.toxin_type}: "
            f"{self.value} {self.unit} [{self.risk_level}]"
        )

    # DEPRECATED: remove these aliases after the frontend uses only canonical
    # toxin_type/value/risk_level fields.
    @property
    def name(self):
        return TOXIN_LABELS.get(self.toxin_type, self.toxin_type)

    @property
    def intensity(self):
        return self.value

    @property
    def is_detected(self):
        return self.value is not None and self.value > 0

    @property
    def dangerous(self):
        return self.risk_level in ('high', 'critical')

    @property
    def threshold(self):
        return self.eu_threshold_low

    @property
    def created_at(self):
        """Python-side compatibility alias; not available in queryset filters."""
        return self.timestamp

    @property
    def exceeds_threshold(self):
        return self.risk_level in ('high', 'critical')

    @property
    def is_flagged_toxin(self):
        threshold = EU_THRESHOLDS.get(self.toxin_type, {})
        return threshold.get('flagged', True)
