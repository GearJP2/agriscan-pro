from rest_framework import serializers
from django.db import transaction
from .constants.mycotoxin_constants import (
    TOXIN_LABELS,
    resolve_toxin_type,
)
from .models import Sample, ProcessLog, MycotoxinResult
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


class SampleSerializer(serializers.ModelSerializer):
    process_logs = ProcessLogSerializer(many=True, read_only=True)
    mycotoxin_results = MycotoxinResultSerializer(many=True, read_only=True)

    class Meta:
        model = Sample
        fields = (
            'id',
            'sample_id',
            'region',
            'province',
            'district',
            'vegetation_variety',
            'collection_date',
            'status',
            'purpose',
            'sample_type',
            'processing_type',
            'collected_by',
            'additional_info',
            'process_logs',
            'mycotoxin_results',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class SampleCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sample
        fields = (
            'sample_id',
            'region',
            'province',
            'district',
            'vegetation_variety',
            'collection_date',
            'status',
            'purpose',
            'sample_type',
            'processing_type',
            'collected_by',
            'additional_info',
        )
        extra_kwargs = {
            'sample_id': {'required': False, 'allow_blank': True},
        }

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
        """Validate sample ID format"""
        if value in (None, ''):
            return ''
        if not isinstance(value, str):
            raise serializers.ValidationError("Sample ID must be a string")
        return value.strip()

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

    def validate_vegetation_variety(self, value):
        """Validate vegetation variety is not empty"""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("Vegetation variety is required")
        return value.strip()

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
                generated_id, sequence_number = generate_sequential_sample_id(collection_date)
                validated_data['sample_id'] = generated_id
                validated_data['sequence_number'] = sequence_number
            else:
                parsed_seq = extract_sequence_from_sample_id(
                    sample_id, collection_date.year if collection_date else None
                )
                if parsed_seq > 0:
                    validated_data['sequence_number'] = parsed_seq

            # Set defaults for empty/null fields
            if not validated_data.get('purpose'):
                validated_data['purpose'] = 'routine'
            if not validated_data.get('sample_type'):
                validated_data['sample_type'] = 'field'
            if not validated_data.get('processing_type'):
                validated_data['processing_type'] = 'raw'
            if not validated_data.get('collected_by'):
                validated_data['collected_by'] = 'Imported'
            if not validated_data.get('additional_info'):
                validated_data['additional_info'] = ''

            return super().create(validated_data)


class SampleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    risk_level = serializers.SerializerMethodField()
    process_logs = ProcessLogSerializer(many=True, read_only=True)
    mycotoxin_results = MycotoxinResultSerializer(many=True, read_only=True)
    results_count = serializers.SerializerMethodField()

    class Meta:
        model = Sample
        fields = (
            'id',
            'sample_id',
            'region',
            'province',
            'district',
            'vegetation_variety',
            'collection_date',
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
