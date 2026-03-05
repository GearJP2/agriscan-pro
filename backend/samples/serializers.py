from rest_framework import serializers
from .models import Sample, ProcessLog, MycotoxinResult


class MycotoxinResultSerializer(serializers.ModelSerializer):
    method = serializers.SerializerMethodField()

    class Meta:
        model = MycotoxinResult
        fields = ('id', 'name', 'intensity', 'dangerous', 'threshold', 'unit', 'method')

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


class SampleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    risk_level = serializers.SerializerMethodField()

    class Meta:
        model = Sample
        fields = (
            'id',
            'sample_id',
            'region',
            'vegetation_variety',
            'collection_date',
            'status',
            'risk_level',
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
