from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('samples', '0018_predictioncontext'),
    ]

    operations = [
        migrations.CreateModel(
            name='PredictionEstimate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('model_version', models.CharField(max_length=80)),
                ('model_family', models.CharField(blank=True, max_length=80)),
                ('uses_weather_features', models.BooleanField(default=False)),
                ('input_payload', models.JSONField(default=dict)),
                ('predictions_payload', models.JSONField(default=list)),
                ('warning', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prediction_estimates_requested', to=settings.AUTH_USER_MODEL)),
                ('sample', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prediction_estimates', to='samples.sample')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['sample', 'created_at'], name='samples_pre_sample__45462b_idx'),
                    models.Index(fields=['model_version'], name='samples_pre_model_v_0b1d29_idx'),
                    models.Index(fields=['requested_by', 'created_at'], name='samples_pre_request_6d88ac_idx'),
                ],
            },
        ),
    ]
