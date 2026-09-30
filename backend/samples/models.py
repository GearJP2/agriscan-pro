from django.db import models
from django.contrib.auth import get_user_model

from .constants.mycotoxin_constants import (
    EU_THRESHOLDS,
    TOXIN_CHOICES,
    TOXIN_LABELS,
)

User = get_user_model()


class DashboardImport(models.Model):
    """A dashboard-result file uploaded directly to S3 and processed by a worker."""

    STATUS_CHOICES = (
        ('awaiting_upload', 'Awaiting upload'),
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dashboard_imports')
    s3_key = models.CharField(max_length=512, unique=True)
    task_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='awaiting_upload')
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    result = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class Sample(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('flagged', 'Flagged'),
    )

    PURPOSE_CHOICES = (
        ('research', 'Research'),
        ('customer', 'Customer'),
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

    FOOD_FEED_TYPE_CHOICES = (
        ('food', 'Food'),
        ('feed', 'Feed'),
    )

    sample_id = models.CharField(max_length=50, unique=True, db_index=True)
    sequence_number = models.IntegerField(default=0, db_default=0, db_index=True)
    region = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    vegetation_variety = models.CharField(max_length=100)
    # New public taxonomy. vegetation_variety is retained temporarily so
    # historical analytics and imports continue to work during migration.
    food_feed_type = models.CharField(max_length=10, choices=FOOD_FEED_TYPE_CHOICES, null=True, blank=True)
    sub_type = models.CharField(max_length=100, null=True, blank=True)
    collection_date = models.DateField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    screening_result = models.CharField(
        max_length=8, choices=(('positive', 'Positive'), ('negative', 'Negative')),
        null=True, blank=True,
    )
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, null=True, blank=True)
    sample_type = models.CharField(max_length=20, choices=SAMPLE_TYPE_CHOICES, null=True, blank=True)
    processing_type = models.CharField(max_length=20, choices=PROCESSING_TYPE_CHOICES, null=True, blank=True)
    collected_by = models.CharField(max_length=255, null=True, blank=True)
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="samples_recorded"
    )
    additional_info = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="samples_updated"
    )

    class Meta:
        ordering = ['-collection_date']
        constraints = [models.CheckConstraint(
            condition=(
                models.Q(sub_type__isnull=True)
                | models.Q(sub_type='')
                | models.Q(vegetation_variety=models.F('sub_type'))
            ),
            name='sample_taxonomy_consistent',
        )]
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['region']),
            models.Index(fields=['province']),
            models.Index(fields=['vegetation_variety']),
            models.Index(fields=['collection_date']),
            models.Index(fields=['region', 'status']),
            models.Index(fields=['region', 'collection_date']),
            models.Index(fields=['status', 'collection_date']),
        ]

    def __str__(self):
        return f"{self.sample_id} - {self.sub_type or self.vegetation_variety}"

    def save(self, *args, **kwargs):
        fields = kwargs.get('update_fields')
        if fields is None or 'sub_type' in fields:
            if self.sub_type:
                self.vegetation_variety = self.sub_type
                if fields is not None:
                    kwargs['update_fields'] = set(fields) | {'vegetation_variety'}
        super().save(*args, **kwargs)


class PredictionContext(models.Model):
    LOCATION_TYPE_CHOICES = (
        ('farm', 'Farm'),
        ('market', 'Market'),
        ('storage', 'Storage'),
        ('unknown', 'Unknown'),
    )

    sample = models.OneToOneField(
        Sample,
        on_delete=models.CASCADE,
        related_name='prediction_context',
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    location_type = models.CharField(
        max_length=20,
        choices=LOCATION_TYPE_CHOICES,
        default='unknown',
    )
    harvest_date = models.DateField(null=True, blank=True)
    sowing_date = models.DateField(null=True, blank=True)
    crop_variety = models.CharField(max_length=120, blank=True)
    crop_season = models.CharField(max_length=80, blank=True)
    storage_duration_days = models.PositiveIntegerField(null=True, blank=True)
    moisture_pct = models.FloatField(null=True, blank=True)
    soil_type = models.CharField(max_length=120, blank=True)
    soil_ph = models.FloatField(null=True, blank=True)
    crop_rotation = models.TextField(blank=True)
    fertiliser_details = models.TextField(blank=True)
    fungicide_details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(latitude__isnull=True, longitude__isnull=True) | (
                    models.Q(latitude__isnull=False, longitude__isnull=False)
                    & models.Q(latitude__gte=-90, latitude__lte=90, longitude__gte=-180, longitude__lte=180)
                ), name='prediction_coordinates_valid',
            ),
            models.CheckConstraint(
                condition=models.Q(moisture_pct__isnull=True) | models.Q(moisture_pct__gte=0, moisture_pct__lte=100),
                name='prediction_moisture_valid',
            ),
            models.CheckConstraint(
                condition=models.Q(soil_ph__isnull=True) | models.Q(soil_ph__gte=0, soil_ph__lte=14),
                name='prediction_soil_ph_valid',
            ),
        ]
        indexes = [
            models.Index(fields=['location_type'], name='samples_pre_locatio_a83c8e_idx'),
            models.Index(fields=['harvest_date'], name='samples_pre_harvest_774036_idx'),
        ]

    def __str__(self):
        return f"Prediction context for {self.sample.sample_id}"


class PredictionEstimate(models.Model):
    sample = models.ForeignKey(
        Sample,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='prediction_estimates',
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='prediction_estimates_requested',
    )
    model_version = models.CharField(max_length=80)
    model_family = models.CharField(max_length=80, blank=True)
    uses_weather_features = models.BooleanField(default=False)
    input_payload = models.JSONField(default=dict)
    predictions_payload = models.JSONField(default=list)
    warning = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sample', 'created_at'], name='samples_pre_sample__45462b_idx'),
            models.Index(fields=['model_version'], name='samples_pre_model_v_0b1d29_idx'),
            models.Index(fields=['requested_by', 'created_at'], name='samples_pre_request_6d88ac_idx'),
        ]

    def __str__(self):
        sample_id = self.sample.sample_id if self.sample else 'manual'
        return f"Prediction estimate {sample_id} @ {self.model_version}"


class ExternalDataCache(models.Model):
    source = models.CharField(max_length=50, db_index=True)
    cache_key = models.CharField(max_length=255)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['source', 'cache_key'], name='external_cache_source_key_unique')]
        indexes = [
            models.Index(fields=['source', 'expires_at']),
        ]

    def __str__(self):
        return f"{self.source}:{self.cache_key}"


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
    # Stored limits are the policy for this measurement, even after catalog edits.
    if value is None or low is None or high is None:
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
    is_below_lod = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-timestamp']
        unique_together = [['sample', 'toxin_type']]
        indexes = [
            models.Index(fields=['toxin_type', 'risk_level']),
        ]

    def prepare_risk(self, *, toxin_changed=False):
        """Keep the original policy; a changed compound starts a new snapshot."""
        if self._state.adding or toxin_changed:
            threshold = EU_THRESHOLDS.get(self.toxin_type, {})
            self.eu_threshold_low = threshold.get('low') if threshold.get('has_data') else None
            self.eu_threshold_high = threshold.get('high') if threshold.get('has_data') else None
        self.risk_level = _calculate_risk_level(
            self.toxin_type, self.value, self.eu_threshold_low, self.eu_threshold_high,
        )

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

        needs_previous = bool(
            self.pk
            and (
                should_recalculate
                or (update_field_set is not None and 'risk_level' in update_field_set)
            )
        )
        previous = (
            type(self).objects.filter(pk=self.pk).values('toxin_type', 'risk_level').first()
            if needs_previous else None
        )
        # ponytail: metadata-only saves skip the previous-row query; add no
        # cache or extra state until profiling shows this path needs it.
        self._previous_risk = (
            previous['risk_level'] if previous else (self.risk_level if self.pk else None)
        )
        touched_fields = set()
        if should_recalculate:
            self.prepare_risk(toxin_changed=bool(previous and previous['toxin_type'] != self.toxin_type))
            touched_fields.update({'risk_level', 'eu_threshold_low', 'eu_threshold_high'})

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
