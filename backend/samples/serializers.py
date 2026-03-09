from rest_framework import serializers
from .models import Sample, ProcessLog, MycotoxinResult


class MycotoxinResultSerializer(serializers.ModelSerializer):
    method = serializers.SerializerMethodField()

    class Meta:
        model = MycotoxinResult
        fields = ('id', 'name', 'intensity', 'dangerous', 'threshold', 'unit', 'test_method', 'sop_link', 'method', 'created_at')
        read_only_fields = ('id', 'created_at', 'method')

    def get_method(self, obj):
        return {
            'name': obj.test_method,
            'sopLink': obj.sop_link
        } if obj.test_method else None


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
        if not value or not isinstance(value, str):
            raise serializers.ValidationError("Sample ID is required and must be a string")
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
            'process_logs',
        )

    def get_risk_level(self, obj):
        if not obj.mycotoxin_results.exists():
            return 'safe'
        has_dangerous = obj.mycotoxin_results.filter(dangerous=True).exists()
        if has_dangerous:
            return 'high'
        max_intensity = obj.mycotoxin_results.values_list('intensity', flat=True)
        if max_intensity:
            max_val = max(max_intensity)
            if max_val >= 7:
                return 'medium'
            elif max_val >= 4:
                return 'low'
        return 'safe'
