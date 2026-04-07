from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator

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


class MycotoxinResult(models.Model):
    sample = models.ForeignKey(Sample, on_delete=models.CASCADE, related_name='mycotoxin_results')
    name = models.CharField(max_length=100)
    intensity = models.FloatField(validators=[MinValueValidator(0)])
    is_detected = models.BooleanField(default=True)
    dangerous = models.BooleanField(default=False)
    threshold = models.FloatField()
    unit = models.CharField(max_length=50)
    test_method = models.CharField(max_length=100, null=True, blank=True)
    sop_link = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.sample.sample_id} - {self.name}"
