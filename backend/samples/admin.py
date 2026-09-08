from django.contrib import admin

from .models import MycotoxinResult, PredictionContext, PredictionEstimate, ProcessLog, Sample


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ['sample_id', 'food_feed_type', 'sub_type', 'region', 'status', 'received_at']
    list_filter = ['food_feed_type', 'status', 'region', 'collection_date']
    search_fields = ['sample_id', 'province', 'district', 'sub_type', 'vegetation_variety']
    actions = ['seed_demo_data_action']

    def seed_demo_data_action(self, request, queryset):
        from django.contrib import messages
        from .services.test_data_service import TestDataService
        try:
            result = TestDataService.generate_test_samples(user=request.user)
            self.message_user(
                request,
                f"Successfully generated {result['created']} test samples.",
                messages.SUCCESS,
            )
        except Exception as e:
            self.message_user(request, f"Error generating test data: {str(e)}", messages.ERROR)

    seed_demo_data_action.short_description = "Generate Test Samples"


@admin.register(ProcessLog)
class ProcessLogAdmin(admin.ModelAdmin):
    list_display = ['sample', 'state', 'conducted_by', 'timestamp']
    list_filter = ['state', 'timestamp']
    search_fields = ['sample__sample_id', 'conducted_by']


@admin.register(MycotoxinResult)
class MycotoxinResultAdmin(admin.ModelAdmin):
    list_display = ['sample', 'toxin_type', 'value', 'unit', 'risk_level', 'timestamp']
    list_filter = ['toxin_type', 'risk_level', 'unit']
    search_fields = ['sample__sample_id']
    readonly_fields = ['risk_level', 'eu_threshold_low', 'eu_threshold_high']


@admin.register(PredictionContext)
class PredictionContextAdmin(admin.ModelAdmin):
    list_display = ['sample', 'location_type', 'harvest_date', 'moisture_pct', 'soil_type', 'updated_at']
    list_filter = ['location_type', 'harvest_date']
    search_fields = ['sample__sample_id', 'crop_variety', 'soil_type']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(PredictionEstimate)
class PredictionEstimateAdmin(admin.ModelAdmin):
    list_display = ['sample', 'model_version', 'uses_weather_features', 'requested_by', 'created_at']
    list_filter = ['model_version', 'uses_weather_features', 'created_at']
    search_fields = ['sample__sample_id', 'model_version', 'requested_by__username']
    readonly_fields = [
        'sample',
        'requested_by',
        'model_version',
        'model_family',
        'uses_weather_features',
        'input_payload',
        'predictions_payload',
        'warning',
        'created_at',
    ]
