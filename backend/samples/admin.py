from django.contrib import admin

from .models import MycotoxinResult, ProcessLog, Sample


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ['sample_id', 'region', 'province', 'status', 'collection_date']
    list_filter = ['status', 'region', 'collection_date']
    search_fields = ['sample_id', 'province', 'district', 'vegetation_variety']
    actions = ['seed_demo_data_action']

    def seed_demo_data_action(self, request, queryset):
        from django.core.management import call_command
        from django.contrib import messages
        try:
            call_command('seed_demo_data')
            self.message_user(request, "Successfully seeded 20 demo samples.", messages.SUCCESS)
        except Exception as e:
            self.message_user(request, f"Error seeding data: {str(e)}", messages.ERROR)
    
    seed_demo_data_action.short_description = "Seed 20 Demo Samples"


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
