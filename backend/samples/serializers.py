from rest_framework import serializers
from .models import Sample, ProcessLog, MycotoxinResult
from .utils import generate_sequential_sample_id, extract_sequence_from_sample_id


class MycotoxinResultSerializer(serializers.ModelSerializer):
    method = serializers.SerializerMethodField()

    class Meta:
        model = MycotoxinResult
        fields = ('id', 'name', 'intensity', 'is_detected', 'dangerous', 'threshold', 'unit', 'test_method', 'sop_link', 'method', 'created_at')
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
        sample_id = (validated_data.get('sample_id') or '').strip()
        collection_date = validated_data.get('collection_date')
        if not sample_id:
            generated_id, sequence_number = generate_sequential_sample_id(collection_date)
            validated_data['sample_id'] = generated_id
            validated_data['sequence_number'] = sequence_number
        else:
            parsed_seq = extract_sequence_from_sample_id(sample_id, collection_date.year if collection_date else None)
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
            
        has_dangerous = any(r.dangerous for r in results)
        if has_dangerous:
            return 'high'

        max_intensity = max(float(result.intensity) for result in results)
        if max_intensity >= 7:
            return 'medium'
        if max_intensity >= 4:
            return 'low'
        return 'safe'

    def get_results_count(self, obj):
        # Optimization: Use pre-fetched list to avoid DB hit (Django Expert)
        return len(obj.mycotoxin_results.all())
