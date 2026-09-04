from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('samples', '0017_mycotoxinresult_is_below_lod')]

    operations = [
        migrations.CreateModel(
            name='PredictionContext',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.FloatField(blank=True, null=True)),
                ('longitude', models.FloatField(blank=True, null=True)),
                ('location_type', models.CharField(
                    choices=[
                        ('farm', 'Farm'),
                        ('market', 'Market'),
                        ('storage', 'Storage'),
                        ('unknown', 'Unknown'),
                    ],
                    default='unknown',
                    max_length=20,
                )),
                ('harvest_date', models.DateField(blank=True, null=True)),
                ('sowing_date', models.DateField(blank=True, null=True)),
                ('crop_variety', models.CharField(blank=True, max_length=120)),
                ('crop_season', models.CharField(blank=True, max_length=80)),
                ('storage_duration_days', models.PositiveIntegerField(blank=True, null=True)),
                ('moisture_pct', models.FloatField(blank=True, null=True)),
                ('soil_type', models.CharField(blank=True, max_length=120)),
                ('soil_ph', models.FloatField(blank=True, null=True)),
                ('crop_rotation', models.TextField(blank=True)),
                ('fertiliser_details', models.TextField(blank=True)),
                ('fungicide_details', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('sample', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='prediction_context',
                    to='samples.sample',
                )),
            ],
            options={
                'indexes': [
                    models.Index(fields=['location_type'], name='samples_pre_locatio_a83c8e_idx'),
                    models.Index(fields=['harvest_date'], name='samples_pre_harvest_774036_idx'),
                ],
            },
        ),
    ]
