from rest_framework import serializers
from django.db import transaction
from .constants.mycotoxin_constants import (
    TOXIN_LABELS,
    resolve_toxin_type,
)
from .models import MycotoxinResult, PredictionContext, PredictionEstimate, ProcessLog, Sample
from .utils import generate_sequential_sample_id, extract_sequence_from_sample_id


class MycotoxinResultSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    intensity = serializers.SerializerMethodField()
    is_detected = serializers.SerializerMethodField()
    dangerous = serializers.SerializerMethodField()
    threshold = serializers.SerializerMethodField()
    method = serializers.SerializerMethodField()
    is_flagged = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = MycotoxinResult
        fields = (
            'id',
            'toxin_type',
            'value',
            'unit',
            'risk_level',
            'eu_threshold_low',
            'eu_threshold_high',
            'is_below_lod',
            'is_flagged',
            'timestamp',
            'notes',
            # Transitional response aliases for the current frontend.
            'name',
            'intensity',
            'is_detected',
            'dangerous',
            'threshold',
            'method',
            'created_at',
        )
        read_only_fields = (
            'id',
            'risk_level',
            'eu_threshold_low',
            'eu_threshold_high',
            'is_below_lod',
            'is_flagged',
            'timestamp',
            'name',
            'intensity',
            'is_detected',
            'dangerous',
            'threshold',
            'method',
            'created_at',
        )

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)

        if not data.get('toxin_type') and data.get('name'):
            toxin_type = resolve_toxin_type(data.get('name'))
            if toxin_type:
                data['toxin_type'] = toxin_type

        if 'value' not in data and 'intensity' in data:
            data['value'] = data.get('intensity')

        return super().to_internal_value(data)

    def validate_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Value must be zero or greater.')
        return value

    def validate_toxin_type(self, value):
        toxin_type = resolve_toxin_type(value)
        if not toxin_type:
            raise serializers.ValidationError('Unknown toxin type.')
        return toxin_type

    def get_name(self, obj):
        return TOXIN_LABELS.get(obj.toxin_type, obj.toxin_type)

    def get_intensity(self, obj):
        return obj.value

    def get_is_detected(self, obj):
        return obj.is_detected

    def get_dangerous(self, obj):
        return obj.dangerous

    def get_threshold(self, obj):
        return obj.eu_threshold_low

    def get_is_flagged(self, obj):
        return obj.is_flagged_toxin

    def get_method(self, obj):
        # DEPRECATED: retained as a null compatibility alias until the
        # frontend stops reading legacy method metadata.
        return None

    def get_created_at(self, obj):
        return obj.timestamp


class ProcessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessLog
        fields = ('id', 'timestamp', 'state', 'test_id', 'notes', 'conducted_by')


class PredictionEstimateRequestSerializer(serializers.Serializer):
    food_feed_type = serializers.ChoiceField(choices=['food', 'feed'])
    sub_type = serializers.CharField(max_length=100, trim_whitespace=True)
    province = serializers.CharField(max_length=100, trim_whitespace=True)
    collection_date = serializers.DateField()
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    location_type = serializers.ChoiceField(
        choices=['farm', 'market', 'storage', 'unknown'],
        required=False,
        allow_blank=True,
    )
    harvest_date = serializers.DateField(required=False, allow_null=True)
    sowing_date = serializers.DateField(required=False, allow_null=True)
    crop_variety = serializers.CharField(max_length=120, required=False, allow_blank=True, trim_whitespace=True)
    crop_season = serializers.CharField(max_length=80, required=False, allow_blank=True, trim_whitespace=True)
    storage_duration_days = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    moisture_pct = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=100)
    soil_type = serializers.CharField(max_length=120, required=False, allow_blank=True, trim_whitespace=True)
    soil_ph = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=14)
    crop_rotation = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    fertiliser_details = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    fungicide_details = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    region = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    district = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    purpose = serializers.ChoiceField(choices=['research', 'customer'], required=False, allow_blank=True)
    sample_type = serializers.ChoiceField(
        choices=['field', 'market', 'storage', 'export'],
        required=False,
        allow_blank=True,
    )
    processing_type = serializers.ChoiceField(
        choices=['raw', 'dried', 'milled', 'processed', 'fermented'],
        required=False,
        allow_blank=True,
    )

    def validate_sub_type(self, value):
        if not value.strip():
            raise serializers.ValidationError('Sub-type is required.')
        return value.strip()

    def validate_province(self, value):
        if not value.strip():
            raise serializers.ValidationError('Province is required.')
        return value.strip()

    def validate(self, attrs):
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')
        if (latitude is None) ^ (longitude is None):
            raise serializers.ValidationError('Latitude and longitude must be provided together.')
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
        return attrs


class PredictionBatchEstimateRequestSerializer(serializers.Serializer):
    sample_ids = serializers.ListField(
        child=serializers.CharField(max_length=50, trim_whitespace=True),
        allow_empty=False,
        max_length=100,
    )

    def validate_sample_ids(self, value):
        cleaned = []
        seen = set()
        for sample_id in value:
            sample_id = sample_id.strip()
            if not sample_id:
                continue
            if sample_id in seen:
                continue
            seen.add(sample_id)
            cleaned.append(sample_id)
        if not cleaned:
            raise serializers.ValidationError('At least one sample ID is required.')
        return cleaned


class PredictionContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = PredictionContext
        fields = (
            'latitude',
            'longitude',
            'location_type',
            'harvest_date',
            'sowing_date',
            'crop_variety',
            'crop_season',
            'storage_duration_days',
            'moisture_pct',
            'soil_type',
            'soil_ph',
            'crop_rotation',
            'fertiliser_details',
            'fungicide_details',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')

    def validate(self, attrs):
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')
        if (latitude is None) ^ (longitude is None):
            raise serializers.ValidationError('Latitude and longitude must be provided together.')
        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
        return attrs


class PredictionEstimateSerializer(serializers.ModelSerializer):
    sample_id = serializers.CharField(source='sample.sample_id', read_only=True, allow_null=True)
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True, allow_null=True)

    class Meta:
        model = PredictionEstimate
        fields = (
            'id',
            'sample_id',
            'requested_by_username',
            'model_version',
            'model_family',
            'uses_weather_features',
            'input_payload',
            'predictions_payload',
            'warning',
            'created_at',
        )
        read_only_fields = fields


class SampleSerializer(serializers.ModelSerializer):
    process_logs = ProcessLogSerializer(many=True, read_only=True)
    mycotoxin_results = MycotoxinResultSerializer(many=True, read_only=True)
    recorded_by = serializers.CharField(source='recorded_by.username', read_only=True)
    prediction_context = PredictionContextSerializer(read_only=True)

    class Meta:
        model = Sample
        fields = (
            'id',
            'sample_id',
            'region',
            'province',
            'district',
            'food_feed_type',
            'sub_type',
            # Deprecated response alias retained so existing analytics clients
            # continue working while they migrate to `sub_type`.
            'vegetation_variety',
            'collection_date',
            'received_at',
            'status',
            'purpose',
            'sample_type',
            'processing_type',
            'recorded_by',
            'additional_info',
            'prediction_context',
            'process_logs',
            'mycotoxin_results',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'received_at', 'recorded_by', 'created_at', 'updated_at')


class SampleCreateUpdateSerializer(serializers.ModelSerializer):
    recorded_by = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = Sample
        fields = (
            'sample_id',
            'region',
            'province',
            'district',
            'food_feed_type',
            'sub_type',
            'collection_date',
            'received_at',
            'status',
            'purpose',
            'sample_type',
            'processing_type',
            'additional_info',
            'recorded_by',
        )
        extra_kwargs = {
            'sample_id': {'required': False, 'allow_blank': True},
            'food_feed_type': {'required': True},
            'sub_type': {'required': True},
        }
        read_only_fields = ('received_at', 'recorded_by')

    def to_internal_value(self, data):
        """Accept legacy import payloads while registering new samples with Food/Feed."""
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if not data.get('sub_type') and data.get('vegetation_variety'):
            data['sub_type'] = data['vegetation_variety']
        if not data.get('food_feed_type') and data.get('sub_type'):
            data['food_feed_type'] = 'food'
        return super().to_internal_value(data)

    def validate_collection_date(self, value):
        """Validate and normalize collection date"""
        if value is None:
            raise serializers.ValidationError("Collection date is required")

        if isinstance(value, str):
            # Try to parse if it's a string
            from datetime import datetime
            try:
                return datetime.strptime(value, '%Y-%m-%d').date()
            except ValueError:
                raise serializers.ValidationError(f"Date '{value}' must be in YYYY-MM-DD format")
        return value

    def validate_sample_id(self, value):
        """Validate sample ID format and ensure TEST- prefix is reserved."""
        if value in (None, ''):
            return ''
        if not isinstance(value, str):
            raise serializers.ValidationError("Sample ID must be a string")
        clean_value = value.strip()
        if clean_value.startswith("TEST-"):
            if not self.instance or self.instance.sample_id != clean_value:
                raise serializers.ValidationError(
                    "The 'TEST-' prefix is reserved for system-generated test data."
                )
        return clean_value

    def validate_province(self, value):
        """Validate province is not empty"""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("Province is required")
        return value.strip()

    def validate_district(self, value):
        """Validate district is not empty"""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("District is required")
        return value.strip()

    def validate_sub_type(self, value):
        """Validate food/feed subtype is not empty."""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("Sub-type is required")
        return value.strip()

    def validate_food_feed_type(self, value):
        if value not in {'food', 'feed'}:
            raise serializers.ValidationError("Type must be either food or feed")
        return value

    def validate_region(self, value):
        """Validate region is not empty"""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("Region is required")
        return value.strip()

    def validate_sample_type(self, value):
        """Validate sample_type only if provided"""
        if value:  # Only validate if a value is provided
            valid_choices = ['field', 'market', 'storage', 'export']
            if value.lower() not in valid_choices:
                raise serializers.ValidationError(f"Invalid choice. Valid options: {', '.join(valid_choices)}")
        return value if value else None  # Return None if empty, which allows the create() method to set default

    def validate_processing_type(self, value):
        """Validate processing_type only if provided"""
        if value:  # Only validate if a value is provided
            valid_choices = ['raw', 'dried', 'milled', 'processed', 'fermented']
            if value.lower() not in valid_choices:
                raise serializers.ValidationError(f"Invalid choice. Valid options: {', '.join(valid_choices)}")
        return value if value else None  # Return None if empty, which allows the create() method to set default

    def create(self, validated_data):
        with transaction.atomic():
            sample_id = (validated_data.get('sample_id') or '').strip()
            collection_date = validated_data.get('collection_date')
            if not sample_id:
                generated_id, sequence_number = generate_sequential_sample_id(
                    collection_date, validated_data['sub_type']
                )
                validated_data['sample_id'] = generated_id
                validated_data['sequence_number'] = sequence_number
            else:
                parsed_seq = extract_sequence_from_sample_id(
                    sample_id, collection_date.year if collection_date else None
                )
                if parsed_seq > 0:
                    validated_data['sequence_number'] = parsed_seq

            # Keep the legacy analytics field in sync until reporting is
            # migrated to use sub_type directly.
            validated_data['vegetation_variety'] = validated_data['sub_type']
            if not validated_data.get('additional_info'):
                validated_data['additional_info'] = ''

            return super().create(validated_data)

    def update(self, instance, validated_data):
        # Keep historical reporting that still reads vegetation_variety in sync
        # when an editor changes the new sub-type field.
        if 'sub_type' in validated_data:
            validated_data['vegetation_variety'] = validated_data['sub_type']
        return super().update(instance, validated_data)


class SampleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    risk_level = serializers.SerializerMethodField()
    process_logs = ProcessLogSerializer(many=True, read_only=True)
    mycotoxin_results = MycotoxinResultSerializer(many=True, read_only=True)
    results_count = serializers.SerializerMethodField()
    recorded_by = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = Sample
        fields = (
            'id',
            'sample_id',
            'region',
            'province',
            'district',
            'food_feed_type',
            'sub_type',
            'vegetation_variety',
            'collection_date',
            'received_at',
            'recorded_by',
            'status',
            'risk_level',
            'results_count',
            'mycotoxin_results',
            'process_logs',
        )

    def get_risk_level(self, obj):
        # Optimization: Use pre-fetched data to avoid DB hits per row (Django Expert)
        results = list(obj.mycotoxin_results.all())
        if not results:
            return 'safe'

        risk_levels = {result.risk_level for result in results}
        if risk_levels.intersection({'critical', 'high'}):
            return 'high'
        if 'detected' in risk_levels:
            return 'low'
        return 'safe'

    def get_results_count(self, obj):
        # Optimization: Use pre-fetched list to avoid DB hit (Django Expert)
        return len(obj.mycotoxin_results.all())
